import Vue from "vue";
import { Loading, Platform } from "quasar";
import { i18n } from "../../boot/i18n";
import { compact, isEmpty, isString, throttle } from "lodash";
import { notifyError, notifyWarning, notifyUndo } from "../../utilities";
import { TPStoPNG, TPStoSVGString } from "tps-ninja";
import { openLocalDB } from "./db";
import Game from "../../Game";
import TPS from "../../Game/PTN/TPS";
import Ply from "../../Game/PTN/Ply";
import Linenum from "../../Game/PTN/Linenum";
import Tag from "../../Game/PTN/Tag";
import router from "../../router";
import { parseURLparams } from "../../router/routes";
import {
  fetchPlaytakOngoingGames,
  followPlaytakGame,
  formatPlaytakClockTag,
  getPlaytakFollowSessionID,
  getPlaytakIDFromGame,
  isPlaytakGameMainlineEnded,
  isPlaytakFollowSessionActive,
  PLAYTAK_API_BASE_URL,
  stopPlaytakOngoingGamesSession,
  stopPlaytakFollowSession,
} from "./playtak";
import {
  annotateGame as annotateGameTak,
  checkPliesForTak,
  checkPlyForTak,
  checkAppendPlyForTak,
} from "../../bots/tak-annotator";

let gamesDB;

const isHtmlResponseText = (text) => {
  const trimmed = String(text || "").trim();
  return /^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);
};

const parseJsonSafe = (text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};

const scheduleNotesSaveCurrentGame = throttle(
  (dispatch) => {
    dispatch("SAVE_CURRENT_GAME", true);
  },
  1000,
  { leading: false, trailing: true }
);

const saveCurrentGameForNotes = (dispatch, immediate = false) => {
  if (immediate) {
    scheduleNotesSaveCurrentGame.cancel();
    dispatch("SAVE_CURRENT_GAME", true);
    return;
  }
  scheduleNotesSaveCurrentGame(dispatch);
};

const preservesProtectedMainlineForBranchMutation = (game, mutation, arg) => {
  if (!game || !game.getProtectedMainlinePlies().length) {
    return true;
  }

  const candidate = new Game({
    ptn: game.ptn,
    state: game.minState,
    config: game.config,
  });
  mutation(candidate, arg);
  return game.preservesProtectedMainline(candidate.ptn);
};

const getPlayTakLoadedPTN = (text) => {
  if (!isString(text)) {
    return "";
  }

  const value = text.trim();
  if (!/^https?:\/\/(?:(?:www|beta)\.)?playtak\.com\/?/i.test(value)) {
    return "";
  }

  try {
    const url = new URL(value);
    const load = url.searchParams.get("load");
    return load ? load.replace(/\r\n/g, "\n").trim() : "";
  } catch (error) {
    return "";
  }
};

export const INIT = function ({ commit }) {
  if (!Platform.within.iframe) {
    openLocalDB()
      .then(async (db) => {
        gamesDB = db;
        commit(
          "INIT",
          (await db.getAllFromIndex("games", "lastSeen")).reverse()
        );
      })
      .catch(notifyError);
  }
};

export const SET_GAME = function ({ commit, dispatch }, game) {
  // If a follow session is active for a different PlayTak game (or for any
  // game when the new active game is not playtakLive), stop it now so the
  // auto-follow check below can start a fresh session for the incoming
  // game. Compare by playtak id rather than gameName because gameName is
  // populated only after Observe arrives — between SET_GAME and Observe,
  // a switch to another playtakLive game would otherwise see a "running"
  // session and silently skip auto-follow, leaving the new game without a
  // live connection until the user clicks Reconnect.
  const activeSessionID = getPlaytakFollowSessionID();
  if (activeSessionID) {
    const newGamePlaytakID = parseInt(
      String((game && game.config && game.config.playtakID) || "").trim(),
      10
    );
    if (
      !Number.isFinite(newGamePlaytakID) ||
      newGamePlaytakID !== activeSessionID
    ) {
      dispatch("STOP_PLAYTAK_FOLLOW");
    }
  }

  const title = game.name + " — " + i18n.t("app_title");
  commit("SET_GAME", game);
  if (this.state.analysis) {
    // Drop any pending analysis-selection writes from the previously-loaded
    // game so they don't clobber the new game's stored selection. The restore
    // action itself falls back to the default (preferSavedResults=true +
    // SYNC_SAVED_ENGINE) when the stored selection is missing or no longer
    // valid (e.g. references an engine that has been deleted).
    this.dispatch("analysis/CANCEL_PENDING_ANALYSIS_SELECTION_PERSIST");
    const savedSelection =
      Vue.prototype.$game &&
      Vue.prototype.$game.config &&
      Vue.prototype.$game.config.analysis;
    this.dispatch("analysis/RESTORE_ANALYSIS_SELECTION", savedSelection);
  }

  const currentGame = Vue.prototype.$game;
  const playtakID =
    currentGame && currentGame.config
      ? String(currentGame.config.playtakID || "").trim()
      : "";
  const playtakLive = Boolean(
    currentGame && currentGame.config && currentGame.config.playtakLive
  );
  if (playtakID && playtakLive) {
    if (
      !isPlaytakGameMainlineEnded(currentGame) &&
      !isPlaytakFollowSessionActive()
    ) {
      dispatch("FOLLOW_PLAYTAK_GAME", {
        id: playtakID,
        state: currentGame ? currentGame.minState : null,
      }).catch(() => {});
    } else if (isPlaytakGameMainlineEnded(currentGame)) {
      commit("MARK_PLAYTAK_ENDED");
    }
  }

  setTimeout(() => (document.title = title), 200);
};

export const ADD_GAME = async function ({ commit, dispatch, getters }, game) {
  const newGame = { lastSeen: game.lastSeen || new Date() };
  newGame.name = getters.uniqueName(game.name);
  newGame.ptn = game.ptn;
  if (game.board || game.state) {
    newGame.state = game.minState || game.state;
  }
  if (game.config) {
    newGame.config = game.config;
  }
  if (game.history) {
    newGame.history = game.history;
    newGame.historyIndex = game.historyIndex;
  }
  if (game.editingTPS !== undefined) {
    newGame.editingTPS = game.editingTPS;
  }
  if (game.highlighterSquares !== undefined) {
    newGame.highlighterSquares = game.highlighterSquares;
  }

  try {
    Loading.show();
    await gamesDB.add("games", newGame);
  } catch (error) {
    Loading.hide();
    notifyError(error);
    return;
  }

  return new Promise((resolve) => {
    setTimeout(async () => {
      await dispatch("SET_GAME", newGame);
      this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
        commit("ADD_GAME", newGame);
        Loading.hide();
        resolve();
      });
    }, 200);
  });
};

export const ADD_GAMES = async function (
  { commit, dispatch, getters, state },
  { games, index }
) {
  const now = new Date().getTime();
  const additionalNames = [];
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const uniqueGameName = getters.uniqueName(
      game.name,
      false,
      additionalNames
    );
    additionalNames.push(uniqueGameName);
    game.name = uniqueGameName;
    const newGame = {
      name: uniqueGameName,
      ptn: game.ptn,
      lastSeen: game.lastSeen || new Date(now - i),
    };
    if (game.board || game.state) {
      newGame.state = game.minState || game.state;
    }
    if (game.config) {
      newGame.config = game.config;
    }
    if (game.history) {
      newGame.history = game.history;
      newGame.historyIndex = game.historyIndex;
    }
    if (game.editingTPS !== undefined) {
      newGame.editingTPS = game.editingTPS;
    }

    try {
      await gamesDB.add("games", newGame);
    } catch (error) {
      notifyError(error);
      games.length = i;
      break;
    }
  }
  if (games.length) {
    commit("ADD_GAMES", { games, index });
    if (!index) {
      this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
        dispatch("SET_GAME", state.list[0]);
      });
    }
  }
};

export const IMPORT_FROM_CLIPBOARD = async function ({ dispatch, getters }) {
  let ptn;
  try {
    ptn = await this.dispatch("ui/PASTE");
  } catch (error) {
    console.error(error);
  }
  let games = [];
  if (ptn) {
    ptn = ptn.trim();

    const loadedPTN = getPlayTakLoadedPTN(ptn);
    if (loadedPTN) {
      ptn = loadedPTN;
    }

    if (/^\d+$/.test(ptn)) {
      // PlayTak game ID
      router.push({
        name: "add",
        params: { tab: "load", type: "playtak" },
      });
      return false;
    } else if (/^https:\/\/ptn.ninja\/.+/.test(ptn)) {
      // PTN Ninja url
      let route = router.match(ptn.substring(17));
      if (route && route.name === "local") {
        if (route.params.id) {
          Loading.show();
          const data = await this.getters["ui/urlUnshort"](route.params.id);
          if (!data) {
            Loading.hide();
            return false;
          }
          route = {
            name: "local",
            params: {
              ptn: data.ptn,
              state: data.params,
            },
          };
        }
        if (!isEmpty(route.params)) {
          try {
            const params = parseURLparams(route);
            games[0] = new Game(params);
            await dispatch("ADD_GAME", game);
            return true;
          } catch (error) {
            console.error(error);
            return false;
          }
        }
      }
    } else if (Game.validate(ptn, true, true) === true) {
      // PTN
      games = Game.split(ptn);
      games = games.map((ptn, i) => {
        const game = new Game({ ptn });
        if (games.length > 1) {
          game.name += " - " + i18n.tc("Game x", i + 1);
        }
        game.name = getters.uniqueName(game.name);
        return game;
      });
    } else if (Ply.test(ptn) || Linenum.test(ptn)) {
      // Plies
      dispatch("INSERT_PLIES", { plies: ptn });
      return true;
    } else {
      // TPS
      let tps = new TPS(ptn);
      if (tps.isValid) {
        tps = tps.text;
        games[0] = new Game({ tags: { tps } });
      } else {
        // JSON
        try {
          let tags = JSON.parse(ptn);
          games[0] = new Game({ tags });
        } catch (error) {}
      }
      if (games[0]) {
        games[0].name = getters.uniqueName(games[0].name);
      }
    }
  }
  if (ptn && games && games.length) {
    await dispatch("ADD_GAMES", { games });
    return true;
  } else {
    router.push({ name: "add", params: { tab: "load", type: "ptn" } });
    return false;
  }
};

export const REPLACE_GAME = function (
  { commit, dispatch, state },
  { index, ptn, gameState }
) {
  if (index < 0) {
    throw new Error("Cannot replace a game that is not open");
  }
  if (index > 0) {
    // If game isn't current, select it
    dispatch("SELECT_GAME", { index, immediate: true });
  }

  // Clone the current game, overriding state with gameState
  const game = new Game({
    ...state.list[0],
    state: gameState || state.list[0].state,
  });

  if (game.ptn !== ptn) {
    if (!game.preservesProtectedMainline(ptn)) {
      notifyWarning("editSyncedMainline");
      return game;
    }

    if (!gameState) {
      gameState = game.minState;
    }
    game.replacePTN(ptn, gameState);
    commit("SET_GAME", game);
    dispatch("SAVE_CURRENT_GAME", true);

    Vue.nextTick(() => {
      notifyUndo({
        message: i18n.t("success.replacedExistingGame"),
        handler: () => {
          dispatch("UNDO", game);
        },
        options: {
          actions: [
            {
              icon: "open_in_new",
              label: i18n.t("Duplicate"),
              color: "primary",
              handler: () => {
                dispatch("UNDO", game);
                dispatch("ADD_GAME", game);
              },
            },
          ],
        },
      });
    });
  } else {
    commit("SET_GAME", game);
    commit("SAVE_STATE", { game, gameState });
    dispatch("SAVE_CURRENT_GAME_STATE");
  }
  return game;
};

export const REMOVE_GAME = async function (
  { commit, dispatch, state, getters },
  index
) {
  const game = state.list[index];
  if (!game) {
    new Error(`Invalid index: ${index}`);
  }
  try {
    await gamesDB.delete("games", game.name);
  } catch (error) {
    notifyError(error);
  }

  const finish = () => {
    commit("REMOVE_GAME", index);
    Vue.nextTick(() => {
      if (index === 0) {
        dispatch("SET_GAME", state.list[0]);
      }
      const icon = game.config.isOnline
        ? getters.playerIcon(game.config.player, game.config.isPrivate)
        : "file";
      notifyUndo({
        icon,
        message: i18n.t("Game x closed", { game: game.name }),
        handler: () => {
          if (index === 0) {
            Loading.show();
            setTimeout(() => {
              this.dispatch("ui/WITHOUT_BOARD_ANIM", async () => {
                await dispatch("ADD_GAMES", { games: [game], index });
                Loading.hide();
              });
            }, 200);
          } else {
            dispatch("ADD_GAMES", { games: [game], index });
          }
        },
      });
    });
  };

  if (index === 0) {
    Loading.show();
    setTimeout(() => {
      this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
        finish();
        Loading.hide();
      });
    }, 200);
  } else {
    finish();
  }
};

export const REMOVE_MULTIPLE_GAMES = async function (
  { commit, dispatch, state },
  { start, count }
) {
  const games = state.list.slice(start, start + count);
  const names = games.map((game) => game.name);
  try {
    await Promise.all(names.map((name) => gamesDB.delete("games", name)));
  } catch (error) {
    notifyError(error);
  }

  const finish = () => {
    commit("REMOVE_MULTIPLE_GAMES", { start, count });
    Vue.nextTick(() => {
      if (start === 0) {
        dispatch("SET_GAME", state.list[0]);
      }
      notifyUndo({
        icon: "close_multiple",
        message: i18n.tc("success.closedMultipleGames", count),
        handler: () => {
          if (start === 0) {
            Loading.show();
            setTimeout(() => {
              this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
                dispatch("ADD_GAMES", { games, index: start });
                Loading.hide();
              });
            }, 200);
          } else {
            dispatch("ADD_GAMES", { games, index: start });
          }
        },
      });
    });
  };

  if (start === 0) {
    Loading.show();
    setTimeout(() => {
      this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
        finish();
        Loading.hide();
      });
    }, 200);
  } else {
    finish();
  }
};

export const EXPORT_PNG = function ({ state }) {
  const game = state;
  const options = {
    ...this.state.ui.pngConfig,
    font: "Roboto",
    komi: game.config.komi,
    opening: game.config.opening,
    tps: game.position.tps,
    theme: this.getters["ui/theme"](this.state.ui.pngConfig.themeID),
    hlSquares:
      this.state.ui.pngConfig.highlightSquares && !state.highlighterEnabled,
    transform: this.state.ui.boardTransform,
  };

  // Highlights
  if (
    state.highlighterEnabled &&
    Object.keys(state.highlighterSquares).length
  ) {
    options.highlighter = state.highlighterSquares;
  }

  // Analysis suggestions
  if (options.showAnalysisBoard) {
    const suggestions = this.getters["analysis/pngSuggestions"];
    if (suggestions) {
      options.suggestions = suggestions;
    }
  }

  const ply = game.position.ply;
  if (ply) {
    if (game.position.plyIsDone) {
      const getSuffix = this.getters["analysis/plyEvalSuffix"];
      const evalSuffix = options.evalText && getSuffix ? getSuffix(ply) : "";
      options.ply = ply.text + evalSuffix;
      options.tps = ply.tpsBefore;
    } else if (options.hlSquares) {
      options.hl = ply.text;
    }
  }

  // Add player names
  if (options.includeNames) {
    options.player1 = game.ptn.tags.player1;
    options.player2 = game.ptn.tags.player2;
  }

  // Game Tags
  ["caps", "flats", "caps1", "flats1", "caps2", "flats2"].forEach((tagName) => {
    options[tagName] = game.ptn.tags[tagName];
  });

  const filename = this.getters["ui/imageFilename"]({
    name: game.name,
    plyID: game.position.plyID,
    plyIsDone: game.position.plyIsDone,
    svg: options.svgFormat,
  });

  if (options.svgFormat) {
    const svgString = TPStoSVGString(options);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    this.dispatch(
      "ui/DOWNLOAD_FILES",
      new File([blob], filename, { type: "image/svg+xml" })
    );
  } else {
    TPStoPNG(options).toBlob((blob) => {
      this.dispatch(
        "ui/DOWNLOAD_FILES",
        new File([blob], filename, { type: "image/png" })
      );
    });
  }
};

export const OPEN_FILES = async function ({ dispatch, state }, files) {
  return new Promise((resolve) => {
    const games = [];
    let count = 0;
    const finish = () => {
      if (--count === 0) {
        Loading.hide();
        dispatch("ADD_GAMES", { games, index: 0 });
        resolve;
      }
    };

    const onInit = (game) => {
      games.push(game);
      finish();
    };

    const parseGame = (ptn, name) => {
      const onError = (error, plyID) => {
        console.warn(
          `Encountered an error in "${name}" at plyID:`,
          plyID,
          error
        );
        notifyError(`${name}: ${error.message}`);
        finish();
      };

      const index = state.list.findIndex((g) => g.name === name);
      if (index < 0 || this.state.ui.openDuplicate !== "replace") {
        try {
          new Game({
            ptn,
            name,
            onError,
            onInit,
          });
        } catch (error) {
          console.error("Invalid game:", name, error);
        }
      } else {
        dispatch("REPLACE_GAME", { index, ptn });
        finish();
      }
    };

    files = Array.from(files);
    files = files.filter((file) => file && /(\.ptn|\.txt)+$/i.test(file.name));
    if (!files.length) {
      return false;
    }

    Loading.show();
    setTimeout(() => {
      count = files.length;
      files.forEach((file) => {
        let reader = new FileReader();
        reader.onload = (event) => {
          const name = file.name.replace(/(\.ptn|\.txt)+$/, "");
          const games = Game.split(event.target.result);
          games.forEach((ptn, i) => {
            parseGame(
              ptn,
              games.length > 1 ? name + " - " + i18n.tc("Game x", i + 1) : name
            );
          });
        };
        reader.onerror = notifyError;
        reader.readAsText(file);
      });
    }, 200);
  });
};

export async function FETCH_PLAYTAK_GAME({}, { id, state = null }) {
  const response = await fetch(
    `${PLAYTAK_API_BASE_URL}/games-history/ptn/${id}`
  );
  if (response && response.ok) {
    const ptn = await response.text();
    if (isHtmlResponseText(ptn)) {
      throw "Unexpected PlayTak API response";
    }
    let game = new Game({ ptn, state });
    const idStr = String(id);
    if (idStr && game.tag("playtakid") !== idStr) {
      game.setTags({ playtakid: idStr }, false, true);
    }
    return game;
  } else {
    if (response) {
      if (response.status === 404) {
        throw "Game does not exist";
      } else {
        const responseText = await response.text().catch(() => "");
        if (isHtmlResponseText(responseText)) {
          throw "Unexpected PlayTak API response";
        }
        const errorData = parseJsonSafe(responseText);
        throw errorData && errorData.message ? errorData.message : "unknown";
      }
    } else {
      throw "unknown";
    }
  }
}

export async function FETCH_PLAYTAK_ONGOING_GAMES() {
  return fetchPlaytakOngoingGames();
}

export const STOP_PLAYTAK_ONGOING_GAMES = function () {
  stopPlaytakOngoingGamesSession();
};

export async function FETCH_PLAYTAK_PAST_GAMES(
  {},
  { page = 0, limit = 25, player = "", gameType = "" } = {}
) {
  const requestPastGames = async (params) => {
    const response = await fetch(
      `${PLAYTAK_API_BASE_URL}/games-history?${params}`
    );

    if (response && response.ok) {
      const responseText = await response.text().catch(() => "");
      if (isHtmlResponseText(responseText)) {
        throw "Unexpected PlayTak API response";
      }
      const data = parseJsonSafe(responseText);
      if (data !== null) {
        return data;
      }
      throw "Unexpected PlayTak API response";
    }

    if (response) {
      const responseText = await response.text().catch(() => "");
      if (isHtmlResponseText(responseText)) {
        throw "Unexpected PlayTak API response";
      }
      const errorData = parseJsonSafe(responseText);
      throw errorData && errorData.message ? errorData.message : "unknown";
    }

    throw "unknown";
  };

  const params = new URLSearchParams({
    sort: "id",
    order: "DESC",
    skip: String(
      Math.max(0, parseInt(page, 10) || 0) * (parseInt(limit, 10) || 25)
    ),
    limit: String(limit),
  });

  const playerFilter = String(player || "").trim();
  if (playerFilter) {
    params.set("player_white", playerFilter);
    params.set("mirror", "true");
  }

  const typeFilter = String(gameType || "").trim();
  const normalizedType =
    typeFilter === "Tournament"
      ? "tournament"
      : typeFilter === "Unrated"
      ? "unrated"
      : typeFilter === "Normal"
      ? "normal"
      : "";
  if (normalizedType) {
    params.set("type", normalizedType);
  }

  const paramsWithoutType = new URLSearchParams(params.toString());
  paramsWithoutType.delete("type");

  try {
    return await requestPastGames(params);
  } catch (error) {
    if (params.has("type")) {
      try {
        return await requestPastGames(paramsWithoutType);
      } catch (retryError) {
        error = retryError;
      }
    }

    throw error;
  }
}

import { OPENING_DB_API } from "../../constants";

export async function FETCH_TAKEXPLORER_GAME({}, { id, state = null }) {
  const response = await fetch(`${OPENING_DB_API}/game/${id}`);
  if (response && response.ok) {
    const text = await response.text();
    const ptn = JSON.parse(text).ptn;
    let game = new Game({ ptn, state });
    const idStr = String(id);
    if (idStr && game.tag("playtakid") !== idStr) {
      game.setTags({ playtakid: idStr }, false, true);
    }
    return game;
  } else {
    if (response) {
      if (response.status === 404) {
        throw "Game does not exist";
      } else {
        const errorData = await response.json().catch(() => null);
        throw errorData && errorData.message ? errorData.message : "unknown";
      }
    } else {
      throw "unknown";
    }
  }
}

export const ADD_TAKEXPLORER_GAME = async function (
  { dispatch },
  { id, state }
) {
  try {
    const game = await dispatch("FETCH_TAKEXPLORER_GAME", { id, state });
    game.warnings.forEach((warning) => notifyWarning(warning));
    dispatch("ADD_GAME", game);
  } catch (error) {
    notifyError(error);
    throw error;
  }
};

export const OPEN_TAKEXPLORER_GAME = async function (
  { dispatch },
  { id, state }
) {
  try {
    const game = await dispatch("FETCH_TAKEXPLORER_GAME", { id, state });
    game.warnings.forEach((warning) => notifyWarning(warning));
    window.open(
      this.getters["ui/url"](game, {
        name: game.name,
        origin: true,
        state: true,
      }),
      "_blank"
    );
  } catch (error) {
    notifyError(error);
    throw error;
  }
};

export const FOLLOW_PLAYTAK_GAME = async function (
  { commit, dispatch, state: gameState },
  { id, state = null }
) {
  try {
    return await followPlaytakGame({
      id,
      state,
      dispatch,
      rootDispatch: this.dispatch.bind(this),
      notifyWarning,
    });
  } catch (error) {
    const msg = error && error.message ? error.message : error;
    if (msg === "Game does not exist") {
      const currentGame = Vue.prototype.$game;
      if (
        currentGame &&
        String(currentGame.config?.playtakID || "") === String(id)
      ) {
        // The game has ended since this local copy was last synced
        // (PlayTak returns "Game does not exist" once an Observe
        // target is no longer ongoing). Pull the final PTN from the
        // history API so any moves we missed while the tab was closed
        // — plus the Result tag — get filled in, then freeze with
        // clearTimes=true since the cached clocks are stale and we
        // have no way to recover the final values.
        let backfillGame = null;
        try {
          const finalGame = await dispatch("FETCH_PLAYTAK_GAME", { id });
          if (finalGame && finalGame.ptn) {
            // Build the replacement off a clone of the current slot
            // (mirrors REPLACE_GAME). Mutating Vue.prototype.$game
            // directly trips Vuex strict-mode because the game object
            // is registered in reactive state. Keep the viewer's
            // current plyIndex rather than jumping to the start.
            const currentSlot = gameState.list[0] || {};
            const preservedState = state || currentGame.minState;
            backfillGame = new Game({
              ...currentSlot,
              state: preservedState,
            });
            backfillGame.replacePTN(finalGame.ptn, preservedState);
          }
        } catch (fetchError) {
          // History API may not have this id yet; fall back to the
          // cached PTN and just mark ended.
          console.warn(
            "Could not fetch final PTN for ended PlayTak game:",
            fetchError
          );
        }
        if (backfillGame) {
          // Install the backfilled game first so MARK_PLAYTAK_ENDED
          // operates on the new config, then persist the combined
          // result to IndexedDB so the next refresh sees both the
          // backfilled PTN and the cleared clocks.
          commit("SET_GAME", backfillGame);
          commit("MARK_PLAYTAK_ENDED", { clearTimes: true });
          dispatch("SAVE_CURRENT_GAME", true);
          // Treat this as a successful load rather than a follow
          // error so callers (e.g. ADD_PLAYTAK_GAME) don't surface
          // an error toast.
          return;
        }
        commit("MARK_PLAYTAK_ENDED");
      }
    }
    throw error;
  }
};

export const STOP_PLAYTAK_FOLLOW = function () {
  stopPlaytakFollowSession();
};

export const ADD_PLAYTAK_GAME = async function ({ dispatch }, { id, state }) {
  try {
    dispatch("STOP_PLAYTAK_FOLLOW");
    const game = await dispatch("FETCH_PLAYTAK_GAME", { id, state });
    game.warnings.forEach((warning) => notifyWarning(warning));
    dispatch("ADD_GAME", game);
  } catch (error) {
    if (
      error === "Game does not exist" ||
      (error && error.message === "Game does not exist")
    ) {
      try {
        await dispatch("FOLLOW_PLAYTAK_GAME", { id, state });
        return;
      } catch (followError) {
        notifyError(followError);
        throw followError;
      }
    }

    notifyError(error);
    throw error;
  }
};

export const ADD_PLAYTAK_GAMES = async function (
  { dispatch, state },
  { ids = [], state: boardState = null, ongoing = false, meta = {} } = {}
) {
  const targetIDs = (Array.isArray(ids) ? ids : [ids])
    .map((id) => String(id || "").trim())
    .filter((id) => /^\d+$/.test(id))
    .filter((id, index, array) => array.indexOf(id) === index);

  if (!targetIDs.length) {
    return 0;
  }

  const metaForID = (id) => {
    if (!meta || typeof meta !== "object") return null;
    return meta[id] || meta[String(id)] || null;
  };

  // Augment a freshly fetched/observed Game's Clock tag with the
  // extra-time-at-move suffix from PlayTak list metadata. The history API
  // returns the shorter "MM:SS +I" form, so we replace it whenever the meta
  // describes a time control with an "@move +bonus" trigger that the
  // existing tag doesn't already capture.
  const augmentClockTagFromMeta = (game, info) => {
    if (!game || !info) return;
    const observedClock = formatPlaytakClockTag(info);
    if (!observedClock || !observedClock.includes("@")) return;
    const existingClock = String(game.tag("clock") || "");
    if (existingClock.includes("@")) return;
    try {
      game.setTags({ clock: observedClock }, false, true);
    } catch (error) {
      console.warn(error);
    }
  };

  // Build a placeholder Game from PlayTak list metadata for an ongoing id
  // the history API can't serve (it returns "Game does not exist" until
  // the game ends). Mirrors the initial tag/config shape that
  // followPlaytakGame sets up on the Observe response, so the subsequent
  // FOLLOW_PLAYTAK_GAME call can attach to the already-loaded game in
  // place instead of creating a duplicate entry.
  const buildPlaceholderOngoingGame = (id, info) => {
    if (!info || !info.player1 || !info.player2 || !info.size) {
      return null;
    }
    const tags = {
      ...Tag.now(),
      site: "PlayTak.com",
      event: "Online Play",
      player1: info.player1,
      player2: info.player2,
      size: info.size,
      komi: (Number(info.komiHalf) || 0) / 2,
      flats: info.flats,
      caps: info.caps,
    };
    if (Number(info.rating1) > 0) {
      tags.rating1 = info.rating1;
    }
    if (Number(info.rating2) > 0) {
      tags.rating2 = info.rating2;
    }
    const clockValue = formatPlaytakClockTag({
      time: info.time,
      increment: info.increment,
      extraMove: info.extraMove,
      extraTime: info.extraTime,
    });
    if (clockValue) {
      tags.clock = clockValue;
    }
    try {
      return new Game({
        tags,
        state: boardState,
        config: {
          playtakID: String(id),
          playtakLive: true,
          playtakSyncedMainline: 0,
        },
      });
    } catch (error) {
      console.warn(error);
      return null;
    }
  };

  dispatch("STOP_PLAYTAK_FOLLOW");

  const results = await Promise.all(
    targetIDs.map(async (id) => {
      try {
        const game = await dispatch("FETCH_PLAYTAK_GAME", {
          id,
          state: boardState,
        });
        augmentClockTagFromMeta(game, metaForID(id));
        return { id, game };
      } catch (error) {
        return { id, error };
      }
    })
  );

  // Reconcile fetched results in the order the user selected so that the
  // first selected id lands at state.list[0] and becomes the active game.
  // Entries with neither a fetched game nor placeholder are dropped here
  // (unexpected errors are also surfaced below).
  const resultsByID = new Map();
  for (const result of results) {
    if (result && result.id) {
      resultsByID.set(String(result.id), result);
    }
  }

  const games = [];
  const followableIDs = [];

  for (const id of targetIDs) {
    const result = resultsByID.get(id);
    if (result && result.game) {
      result.game.warnings.forEach((warning) => notifyWarning(warning));
      games.push(result.game);
      if (ongoing) {
        followableIDs.push(id);
      }
      continue;
    }

    const error = result && result.error;
    const isMissing =
      error === "Game does not exist" ||
      (error && error.message === "Game does not exist");

    if (isMissing) {
      if (ongoing) {
        const placeholder = buildPlaceholderOngoingGame(id, metaForID(id));
        if (placeholder) {
          placeholder.warnings.forEach((warning) => notifyWarning(warning));
          games.push(placeholder);
          followableIDs.push(id);
          continue;
        }
        // No meta available — fall back to a single FOLLOW attempt below.
        followableIDs.push(id);
      }
      continue;
    }

    if (error) {
      notifyError(error);
    }
  }

  // For ongoing follows, reuse any existing library entry for the same
  // PlayTakID rather than adding a duplicate (mirrors the previous
  // ongoing-only behavior). Past-game imports still allow duplicates.
  // ADD_GAMES below activates state.list[0] and dispatches SET_GAME —
  // same title update path as any other import — and we explicitly
  // re-activate the first selected id afterwards if it was an existing
  // entry.
  const gamesToAdd = [];
  const existingByID = new Map();

  for (const game of games) {
    const gameID = getPlaytakIDFromGame(game);
    const existingIndex =
      ongoing && gameID
        ? state.list.findIndex((g) => getPlaytakIDFromGame(g) === gameID)
        : -1;
    if (existingIndex >= 0) {
      existingByID.set(gameID, state.list[existingIndex]);
      continue;
    }
    gamesToAdd.push(game);
  }

  const firstSelectedID = targetIDs[0];
  const firstSelectedExisting = firstSelectedID
    ? existingByID.get(firstSelectedID)
    : null;

  if (gamesToAdd.length) {
    await dispatch("ADD_GAMES", { games: gamesToAdd });
  }

  // Make the first selected id the active game so the window title and
  // live-follow attachment both target the user's primary selection.
  // ADD_GAMES already activates state.list[0] (the first newly added
  // game), so we only need to override when the first selection was
  // already in the library or when nothing new was added at all.
  if (firstSelectedExisting) {
    await dispatch("SET_GAME", firstSelectedExisting);
  } else if (!gamesToAdd.length && existingByID.size) {
    const fallback = existingByID.values().next().value;
    if (fallback) {
      await dispatch("SET_GAME", fallback);
    }
  }

  // Fold in the meta-derived Clock tag if it adds the extra-time-at-move
  // suffix that the previously-loaded copy is missing.
  if (firstSelectedExisting && firstSelectedID) {
    const info = metaForID(firstSelectedID);
    if (info) {
      const observedClock = formatPlaytakClockTag(info);
      const existingClock = String(
        (Vue.prototype.$game && Vue.prototype.$game.tag("clock")) || ""
      );
      if (
        observedClock &&
        observedClock.includes("@") &&
        !existingClock.includes("@")
      ) {
        dispatch("SET_TAGS", { clock: observedClock });
      }
    }
  }

  const loadedCount = gamesToAdd.length + existingByID.size;

  if (ongoing) {
    // SET_GAME auto-starts a follow session whenever the active game is
    // playtakLive and not ended (see SET_GAME above), so when we've
    // activated a playtakLive entry via ADD_GAMES or SET_GAME above, the
    // follow is already in flight. Issuing a second explicit FOLLOW
    // here would race and tear down the in-flight WebSocket, which
    // PlayTak sees as a failed connection ("Could not connect to
    // PlayTak"). Only follow explicitly when nothing was activated
    // (e.g. no meta available to build a placeholder).
    if (isPlaytakFollowSessionActive()) {
      return loadedCount || 1;
    }

    const followID = followableIDs[0] || firstSelectedID;
    if (followID) {
      try {
        await dispatch("FOLLOW_PLAYTAK_GAME", {
          id: followID,
          state: boardState,
        });
        return loadedCount || 1;
      } catch (followError) {
        notifyError(followError);
        return loadedCount;
      }
    }
    return loadedCount;
  }

  return loadedCount;
};

export const OPEN_PLAYTAK_GAME = async function ({ dispatch }, { id, state }) {
  try {
    const game = await dispatch("FETCH_PLAYTAK_GAME", { id, state });
    game.warnings.forEach((warning) => notifyWarning(warning));
    window.open(
      this.getters["ui/url"](game, {
        name: game.name,
        origin: true,
        state: true,
      }),
      "_blank"
    );
  } catch (error) {
    notifyError(error);
    throw error;
  }
};

export const RENAME_CURRENT_GAME = function ({ commit, dispatch }, newName) {
  const oldName = Vue.prototype.$game.name;
  if (oldName === newName) {
    return;
  }
  commit("RENAME_CURRENT_GAME", newName);
  dispatch("SET_NAME", { oldName, newName });
  setTimeout(() => {
    document.title = newName + " — " + i18n.t("app_title");
  }, 200);
};

export const SET_CURRENT_PTN = function ({ commit, dispatch }, ptn) {
  const game = Vue.prototype.$game;
  if (game && !game.preservesProtectedMainline(ptn)) {
    notifyWarning("editSyncedMainline");
    return;
  }

  commit("SET_CURRENT_PTN", ptn);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const SAVE_CURRENT_GAME = function ({ commit }, rebuildState) {
  const game = Vue.prototype.$game;
  if (game && !this.state.ui.embed) {
    try {
      gamesDB.put("games", {
        name: game.name,
        ptn: game.ptn,
        state: game.minState,
        config: game.config,
        ptnUI: this.state.game.ptnUI,
        editingTPS: game.editingTPS,
        highlighterEnabled: game.highlighterEnabled,
        highlighterSquares: game.highlighterSquares,
        history: game.history,
        historyIndex: game.historyIndex,
        lastSeen: new Date(),
      });
    } catch (error) {
      notifyError(error);
    }
  }
  if (rebuildState) {
    commit("SAVE_CURRENT_GAME");
  }
};

export const SET_BRANCH_POINT_OVERRIDES = async function (
  { commit, state, dispatch },
  overrides
) {
  commit("SET_BRANCH_POINT_OVERRIDES", overrides);
  if (this.state.ui.embed) {
    return;
  }
  const game = { ...state.list[0] };
  try {
    game.ptnUI = {
      ...(game.ptnUI || {}),
      branchPointOverrides: overrides || {},
    };
    await gamesDB.put("games", game);
  } catch (error) {
    notifyError(error);
  }
  // Ensure ptnUI is saved to the main game object as well
  dispatch("SAVE_CURRENT_GAME", false);
  // Also update the in-memory Game object's ptnUI
  if (Vue.prototype.$game) {
    Vue.prototype.$game.ptnUI = {
      ...(Vue.prototype.$game.ptnUI || {}),
      branchPointOverrides: overrides || {},
    };
  }
};

export const SAVE_CURRENT_GAME_STATE = throttle(function ({
  commit,
  dispatch,
}) {
  dispatch("SAVE_CURRENT_GAME", false);
  commit("SAVE_CURRENT_GAME_STATE");
},
300);

export const SET_NAME = async function (
  { commit, getters },
  { oldName, newName }
) {
  if (oldName === newName) {
    return;
  }
  if (!this.state.ui.embed) {
    try {
      const game = await gamesDB.get("games", oldName);
      if (!game) {
        throw new Error("Game not found: " + oldName);
      }
      game.name = getters.uniqueName(newName, true);
      await gamesDB.put("games", game);
      await gamesDB.delete("games", oldName);
    } catch (error) {
      notifyError(error);
    }
  }
  commit("SET_NAME", { oldName, newName });
};

export const SET_TAGS = function ({ commit, dispatch }, tags) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("SET_TAGS", tags);
    dispatch("SAVE_CURRENT_GAME", true);
  });
};

export const SET_PLAYTAK_LIVE_CONFIG = function ({ commit }, payload) {
  commit("SET_PLAYTAK_LIVE_CONFIG", payload);
};

export const SET_GAME_TIMER_TURN = function ({ commit }, turn) {
  commit("SET_GAME_TIMER_TURN", turn);
};

export const SET_GAME_TIME = function ({ commit }, payload) {
  commit("SET_GAME_TIME", payload);
};

export const SET_TIMER_LIVE = function ({ commit }, live) {
  commit("SET_TIMER_LIVE", live);
};

export const MARK_PLAYTAK_ENDED = function (
  { commit },
  { clearTimes = false } = {}
) {
  commit("MARK_PLAYTAK_ENDED", { clearTimes });
};

export const SET_PLAYTAK_LAST_MAINLINE_RESULT = function (
  { commit, dispatch },
  result
) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("SET_PLAYTAK_LAST_MAINLINE_RESULT", result);
    dispatch("SAVE_CURRENT_GAME", true);
  });
};

export const SET_PLAYER = function ({ commit }, player) {
  const game = Vue.prototype.$game;
  if (!game) {
    return;
  }
  player = Number(player) || null;
  const config = { ...game.config, player };
  Object.assign(game.config, config);
  if (!this.state.ui.embed) {
    commit("SAVE_CONFIG", { game, config });
  }
};

// Persist the analysis selection (source, botID, savedBotName,
// preferSavedResults) into the current game's config so it is restored when
// the game is loaded again. Called (throttled) from analysis/SET.
export const SAVE_ANALYSIS_SELECTION = function (
  { commit, dispatch },
  selection
) {
  const game = Vue.prototype.$game;
  if (!game || this.state.ui.embed) {
    return;
  }
  const analysis = {
    source: selection && selection.source,
    botID: selection && selection.botID,
    savedBotName:
      selection && "savedBotName" in selection ? selection.savedBotName : null,
    preferSavedResults: !!(selection && selection.preferSavedResults),
    collapsedBots:
      selection &&
      selection.collapsedBots &&
      typeof selection.collapsedBots === "object"
        ? { ...selection.collapsedBots }
        : {},
    textTab:
      selection && typeof selection.textTab === "string"
        ? selection.textTab
        : null,
  };
  const config = { ...game.config, analysis };
  Object.assign(game.config, config);
  commit("SAVE_CONFIG", { game, config });
  dispatch("SAVE_CURRENT_GAME", false);
};

export const APPLY_TRANSFORM = function ({ commit, dispatch }, transform) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("APPLY_TRANSFORM", transform);
    this.dispatch("ui/RESET_TRANSFORM");
    dispatch("SAVE_CURRENT_GAME", true);
  });
};

export const SELECT_GAME = function (
  { commit, dispatch, state },
  { index, immediate }
) {
  try {
    const game = { ...state.list[index] };
    game.lastSeen = new Date();
    if (immediate) {
      commit("SELECT_GAME", index);
    } else {
      Loading.show();
      setTimeout(() => {
        this.dispatch("ui/WITHOUT_BOARD_ANIM", async () => {
          commit("SELECT_GAME", index);
          await dispatch("SET_GAME", state.list[0]);
          dispatch("SAVE_CURRENT_GAME", false);
          Loading.hide();
        });
      }, 200);
    }
    return gamesDB.put("games", game);
  } catch (error) {
    notifyError(error);
  }
};

export const SET_HIGHLIGHTER_ENABLED = async ({ commit, state }, enabled) => {
  commit("SET_HIGHLIGHTER_ENABLED", enabled);
  const game = { ...state.list[0] };
  try {
    game.highlighterEnabled = Boolean(enabled);
    await gamesDB.put("games", game);
  } catch (error) {
    notifyError(error);
  }
};

export const SET_HIGHLIGHTER_SQUARES = async ({ commit, state }, squares) => {
  commit("SET_HIGHLIGHTER_SQUARES", squares);
  const game = { ...state.list[0] };
  try {
    game.highlighterSquares = squares || {};
    await gamesDB.put("games", game);
  } catch (error) {
    notifyError(error);
  }
};

export const HIGHLIGHT_SQUARES = function ({ commit }, args) {
  if (Array.isArray(args)) {
    commit("HIGHLIGHT_SQUARES", { squares: args });
  } else {
    commit("HIGHLIGHT_SQUARES", args || {});
  }
};

export const HOVER_SQUARE = function ({ commit }, args) {
  commit("HOVER_SQUARE", args);
};

export const SET_EVAL = function ({ commit }, args) {
  commit("SET_EVAL", args);
};

export const SET_ANALYSIS = function ({ commit }, args) {
  commit("SET_ANALYSIS", args);
};

export const SELECT_SQUARE = function ({ commit, dispatch }, args) {
  commit("SELECT_SQUARE", args);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const SELECT_DROP_PIECES = function ({ commit, dispatch }, args) {
  commit("SELECT_DROP_PIECES", args);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const SELECT_PIECE = function ({ commit }, args) {
  commit("SELECT_PIECE", args);
};

export const CANCEL_MOVE = function ({ commit }) {
  commit("CANCEL_MOVE");
};

export const DELETE_PLY = function ({ commit, dispatch }, payload) {
  const fromServer = Boolean(payload && payload.fromServer);
  const playtakLive =
    payload && typeof payload === "object" ? payload.playtakLive : null;
  const rawPlyID =
    payload && typeof payload === "object" ? payload.plyID : payload;
  const plyID = parseInt(rawPlyID, 10);
  if (!Number.isFinite(plyID)) {
    return;
  }

  const game = Vue.prototype.$game;
  if (!fromServer && game && game.isProtectedMainlinePly(plyID)) {
    notifyWarning("deleteSyncedMoves");
    return;
  }

  commit("DELETE_PLY", { plyID, fromServer, playtakLive });
  dispatch("SAVE_CURRENT_GAME", true);
};

// Pre-check whether an interactively-inserted ply creates a tak threat,
// so the mark can be baked into the same history entry. Only activates
// when the user has auto-annotate-tak enabled.
const preCheckTakMark = async (rootState, ply) => {
  if (!rootState.ui.autoAnnotateTak) return false;
  const game = Vue.prototype.$game;
  if (!game) return false;
  try {
    return await checkPlyForTak(game, ply);
  } catch (e) {
    return false;
  }
};

export const APPEND_PLY = async function (
  { commit, dispatch, rootState },
  payload
) {
  // Preserve legacy shapes: raw string/Ply or { ply, playtakLive }
  const isObj = payload && typeof payload === "object" && "ply" in payload;
  const ply = isObj ? payload.ply : payload;
  const liveSync = isObj ? payload.playtakLive : null;
  // Burst-drain callers (e.g. the PlayTak initial-burst drain inside
  // ui/WITHOUT_BOARD_ANIM) opt out of the per-ply tak pre-check: the
  // wasm-worker round-trip on every iteration yields long enough for
  // Vue to flush intermediate renders, which defeats the batching the
  // burst drain relies on. Callers that set this flag should run a
  // single annotateGameTak sweep after the drain instead.
  const skipTakPreCheck = isObj ? !!payload.skipTakPreCheck : false;

  // Pre-check the tak mark so it can be baked into the same APPEND_PLY
  // mutation that inserts the ply (no separate mutation / history entry).
  // checkAppendPlyForTak picks the right anchor: the playtak synced
  // frontier when `liveSync` is set, otherwise the end of the main branch
  // (matching game.appendPly's goToEndOfMainBranch). This keeps the mark
  // correct regardless of where the user is currently navigated and
  // covers embed-driven APPEND_PLY too.
  let takMark = false;
  if (!skipTakPreCheck && rootState.ui.autoAnnotateTak) {
    const game = Vue.prototype.$game;
    if (game) {
      try {
        takMark = await checkAppendPlyForTak(game, ply, liveSync);
      } catch (e) {
        takMark = false;
      }
    }
  }

  if (liveSync) {
    commit("APPEND_PLY", { ...payload, takMark });
  } else {
    commit("APPEND_PLY", { ply, takMark });
  }
  dispatch("SAVE_CURRENT_GAME", true);
};

export const INSERT_PLY = async function (
  { commit, dispatch, rootState },
  ply
) {
  const takMark = await preCheckTakMark(rootState, ply);
  commit("INSERT_PLY", takMark ? { ply, takMark } : ply);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const INSERT_PLIES = async function (
  { commit, dispatch, rootState },
  { plies, prev }
) {
  if (isString(plies)) {
    plies = plies.split(/\s+/);
  }
  plies = compact(plies);

  let takMarks = null;
  // Pre-check when plies form a clean sequence from the current board
  // state. If a leading linenum/Nop is present, fall back to a post-commit
  // sweep since the insertion starts from a different position.
  if (rootState.ui.autoAnnotateTak && plies.length && !Linenum.test(plies[0])) {
    const game = Vue.prototype.$game;
    if (game) {
      try {
        const flags = await checkPliesForTak(game, plies);
        if (flags.some(Boolean)) {
          takMarks = flags;
        }
      } catch (e) {
        takMarks = null;
      }
    }
  }

  commit("INSERT_PLIES", { plies, prev, takMarks });
  dispatch("SAVE_CURRENT_GAME", true);

  // If we couldn't pre-check (leading linenum/Nop path), fall back to a
  // full-game sweep so marks still land.
  if (!takMarks && rootState.ui.autoAnnotateTak) {
    const game = Vue.prototype.$game;
    if (game) annotateGameTak(game).catch(() => {});
  }
};

// Run a single auto-tak annotation sweep over the currently-mounted game.
// No-ops if autoAnnotateTak is off or the game's size isn't supported.
// Fire-and-forget — the resulting SET_TAK_ANNOTATIONS commit can land
// asynchronously. Used by callers that bulk-inserted plies with the
// per-ply pre-check skipped (e.g. PlayTak historical-burst drain).
export const ANNOTATE_CURRENT_GAME_TAK = function ({ rootState }) {
  if (!rootState.ui.autoAnnotateTak) return;
  const game = Vue.prototype.$game;
  if (!game) return;
  const size = game.config && game.config.size;
  if (![4, 5, 6, 7].includes(size)) return;
  annotateGameTak(game).catch(() => {});
};

export const DELETE_BRANCH = function ({ commit, dispatch }, branch) {
  commit("DELETE_BRANCH", branch);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const UNDO = function ({ commit, dispatch }) {
  const game = Vue.prototype.$game;
  if (game && game.getProtectedMainlinePlies().length && game.canUndo) {
    const undoEntry = game.history[game.historyIndex - 1];
    const undoPTN = undoEntry && undoEntry.beforePTN;
    if (undoPTN && !game.preservesProtectedMainline(undoPTN)) {
      notifyWarning("undoSyncedMainline");
      return;
    }
  }

  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("UNDO");
    dispatch("SAVE_CURRENT_GAME", true);
  });
};

export const REDO = function ({ commit, dispatch }) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("REDO");
    dispatch("SAVE_CURRENT_GAME", true);
  });
};

export const TRIM_BRANCHES = function ({ commit, dispatch }) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_BRANCHES");
    dispatch("SAVE_CURRENT_GAME", true);
  });
};

export const TRIM_TO_BOARD = function ({ commit, dispatch }) {
  const game = Vue.prototype.$game;
  if (game && game.getProtectedMainlinePlies().length) {
    notifyWarning("trimToBoard");
    return;
  }

  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_TO_BOARD");
    dispatch("SAVE_CURRENT_GAME", true);
  });
};

export const TRIM_TO_PLY = function ({ commit, dispatch }) {
  const game = Vue.prototype.$game;
  if (game && game.getProtectedMainlinePlies().length) {
    notifyWarning("trimToPly");
    return;
  }

  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_TO_PLY");
    dispatch("SAVE_CURRENT_GAME", true);
  });
};

export const FIRST = function ({ commit, dispatch, state }) {
  commit("FIRST");
  dispatch("SAVE_CURRENT_GAME_STATE");
  return !state.error;
};

export const LAST = function ({ commit, dispatch, state }) {
  commit("LAST");
  dispatch("SAVE_CURRENT_GAME_STATE");
  return !state.error;
};

export const PREV = function ({ commit, dispatch, state }, { half, times }) {
  commit("PREV", { half, times });
  dispatch("SAVE_CURRENT_GAME_STATE");
  return !state.error;
};

export const NEXT = function ({ commit, dispatch, state }, { half, times }) {
  commit("NEXT", { half, times });
  dispatch("SAVE_CURRENT_GAME_STATE");
  return !state.error;
};

export const SET_TARGET = function ({ commit, dispatch, state }, ply) {
  commit("SET_TARGET", ply);
  dispatch("SAVE_CURRENT_GAME_STATE");
  return !state.error;
};

export const GO_TO_PLY = function (
  { commit, dispatch, state },
  { plyID, isDone }
) {
  commit("GO_TO_PLY", { plyID, isDone });
  dispatch("SAVE_CURRENT_GAME_STATE");
  return !state.error;
};

// Branch navigation helpers
const selectBranchPly = function (dispatch, ply) {
  dispatch("SET_TARGET", ply);
  dispatch("GO_TO_PLY", { plyID: ply.id, isDone: true });
};

const canInlineExpand = function (uiState) {
  return uiState.showPTN && uiState.inlineBranches && uiState.showAllBranches;
};

export const PREV_BRANCH = function ({ state, dispatch }) {
  const ptn = state.ptn;
  const positionPly = state.position && state.position.ply;
  if (!ptn || !ptn.allPlies || !positionPly) {
    return;
  }

  // Check if current ply is a branch point (has child branches)
  const isParentPly =
    positionPly.branches &&
    positionPly.branches.length > 1 &&
    positionPly.branches[0] === positionPly.id;

  if (isParentPly) {
    // On parent ply - collapse in inline mode only
    if (canInlineExpand(this.state.ui)) {
      this.commit("ui/SET_COLLAPSE_BRANCH_REQUEST", {
        plyID: positionPly.id,
        nonce: Date.now(),
      });
      return;
    }
  }

  // Only navigate siblings/parent when at the first ply of the branch
  if (!positionPly.branch) {
    return;
  }

  const branchRoot = ptn.branches && ptn.branches[positionPly.branch];
  if (!branchRoot || positionPly.id !== branchRoot.id) {
    return;
  }

  const siblings = branchRoot.branches;
  const hasSiblings = siblings && siblings.length > 1;

  if (hasSiblings) {
    const currentIndex = siblings.indexOf(branchRoot.id);
    if (currentIndex > 1) {
      const prevSiblingPly = ptn.allPlies[siblings[currentIndex - 1]];
      if (prevSiblingPly) {
        selectBranchPly(dispatch, prevSiblingPly);
        return;
      }
    } else if (currentIndex >= 0) {
      const branchPointPly = ptn.allPlies[siblings[0]];
      if (branchPointPly) {
        selectBranchPly(dispatch, branchPointPly);
        return;
      }
    }
  }

  // No siblings - compute parent branch from branch name and go to its branch point
  if (positionPly.branch) {
    const parentBranchName = positionPly.branch
      .split("/")
      .slice(0, -1)
      .join("/");
    const parentBranchRoot = ptn.branches && ptn.branches[parentBranchName];
    const parentSiblings = parentBranchRoot && parentBranchRoot.branches;
    if (parentSiblings && parentSiblings.length > 0) {
      const parentBranchPointPly = ptn.allPlies[parentSiblings[0]];
      if (parentBranchPointPly) {
        selectBranchPly(dispatch, parentBranchPointPly);
        return;
      }
    }
  }
};

export const NEXT_BRANCH = function ({ state, dispatch }) {
  const ptn = state.ptn;
  const positionPly = state.position && state.position.ply;
  if (!ptn || !ptn.allPlies || !positionPly) {
    return;
  }

  // Check if current ply is a branch point (has child branches)
  const isParentPly =
    positionPly.branches &&
    positionPly.branches.length > 1 &&
    positionPly.branches[0] === positionPly.id;

  if (isParentPly) {
    // On parent ply - select first child branch
    const firstChildPly = ptn.allPlies[positionPly.branches[1]];
    if (firstChildPly) {
      if (canInlineExpand(this.state.ui)) {
        const currentOverrides =
          (state.ptnUI && state.ptnUI.branchPointOverrides) || {};
        if (currentOverrides[positionPly.id] !== true) {
          dispatch("SET_BRANCH_POINT_OVERRIDES", {
            ...currentOverrides,
            [positionPly.id]: true,
          });
        }
      }
      selectBranchPly(dispatch, firstChildPly);
      return;
    }
  }

  // Get branch root (first ply of current branch) to find siblings
  const branchRoot = ptn.branches && ptn.branches[positionPly.branch];
  if (!branchRoot || positionPly.id !== branchRoot.id) {
    return;
  }

  const siblings = branchRoot.branches;
  const hasSiblings = siblings && siblings.length > 1;

  if (hasSiblings) {
    const currentIndex = siblings.indexOf(branchRoot.id);
    if (currentIndex >= 0 && currentIndex < siblings.length - 1) {
      const nextSiblingPly = ptn.allPlies[siblings[currentIndex + 1]];
      if (nextSiblingPly) {
        selectBranchPly(dispatch, nextSiblingPly);
        return;
      }
    }
  }
};

export const PARENT_BRANCH = function ({ state, dispatch }) {
  const ptn = state.ptn;
  const positionPly = state.position && state.position.ply;
  if (!ptn || !ptn.allPlies || !positionPly || !positionPly.branch) {
    return;
  }

  const branchRoot = ptn.branches && ptn.branches[positionPly.branch];
  const parentID =
    branchRoot && branchRoot.branches && branchRoot.branches.length
      ? branchRoot.branches[0]
      : null;
  const parentPly = parentID != null ? ptn.allPlies[parentID] : null;
  if (parentPly) {
    selectBranchPly(dispatch, parentPly);
  }
};

export const PARENT_MAIN_BRANCH = function ({ state, dispatch }) {
  const ptn = state.ptn;
  const positionPly = state.position && state.position.ply;
  if (!ptn || !ptn.allPlies || !positionPly || !positionPly.branch) {
    return;
  }

  let current = positionPly;
  while (current && current.branch) {
    const branchRoot = ptn.branches && ptn.branches[current.branch];
    const parentID =
      branchRoot && branchRoot.branches && branchRoot.branches.length
        ? branchRoot.branches[0]
        : null;
    const parentPly = parentID != null ? ptn.allPlies[parentID] : null;
    if (!parentPly) {
      return;
    }
    if (!parentPly.branch) {
      selectBranchPly(dispatch, parentPly);
      return;
    }
    current = parentPly;
  }
};

export const LAST_CHILD_BRANCH = function ({ state, dispatch }) {
  const ptn = state.ptn;
  const positionPly = state.position && state.position.ply;
  if (!ptn || !ptn.allPlies || !positionPly) {
    return;
  }

  const isParentPly =
    positionPly.branches &&
    positionPly.branches.length > 1 &&
    positionPly.branches[0] === positionPly.id;
  if (!isParentPly) {
    return;
  }

  const childID = positionPly.branches[positionPly.branches.length - 1];
  const childPly = childID != null ? ptn.allPlies[childID] : null;
  if (!childPly) {
    return;
  }

  if (canInlineExpand(this.state.ui)) {
    const currentOverrides =
      (state.ptnUI && state.ptnUI.branchPointOverrides) || {};
    if (currentOverrides[positionPly.id] !== true) {
      dispatch("SET_BRANCH_POINT_OVERRIDES", {
        ...currentOverrides,
        [positionPly.id]: true,
      });
    }
  }

  selectBranchPly(dispatch, childPly);
};

export const EDIT_TPS = async function ({ commit, state }, tps) {
  const game = { ...state.list[0] };
  try {
    game.editingTPS = tps;
    await gamesDB.put("games", game);
  } catch (error) {
    notifyError(error);
  }
  commit("EDIT_TPS", tps);
};

export const SAVE_TPS = function ({ commit, dispatch }, tps) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("SAVE_TPS", tps);
    dispatch("SAVE_CURRENT_GAME", true);
  });
};

export const PROMOTE_BRANCH = function ({ commit, dispatch }, args) {
  const game = Vue.prototype.$game;
  if (
    !preservesProtectedMainlineForBranchMutation(
      game,
      (candidate, branch) => candidate.promoteBranch(branch),
      args
    )
  ) {
    notifyWarning("editSyncedMainline");
    return;
  }

  commit("PROMOTE_BRANCH", args);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const MAKE_BRANCH_MAIN = function ({ commit, dispatch }, args) {
  const game = Vue.prototype.$game;
  if (
    !preservesProtectedMainlineForBranchMutation(
      game,
      (candidate, branch) => candidate.makeBranchMain(branch),
      args
    )
  ) {
    notifyWarning("editSyncedMainline");
    return;
  }

  commit("MAKE_BRANCH_MAIN", args);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const RENAME_BRANCH = function ({ commit, dispatch }, args) {
  commit("RENAME_BRANCH", args);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const TOGGLE_EVALUATION = ({ commit, dispatch }, { type, double }) => {
  commit("TOGGLE_EVALUATION", { type, double });
  dispatch("SAVE_CURRENT_GAME", true);
};

export const REMOVE_EVAL_MARKS = ({ commit, dispatch }) => {
  commit("REMOVE_EVAL_MARKS");
  dispatch("SAVE_CURRENT_GAME", true);
};

export const EDIT_NOTE = ({ commit, dispatch }, { plyID, index, message }) => {
  commit("EDIT_NOTE", { plyID, index, message });
  dispatch("SAVE_CURRENT_GAME", true);
};

export const ADD_NOTE = ({ commit, dispatch }, { message, plyID }) => {
  commit("ADD_NOTE", { message, plyID });
  dispatch("SAVE_CURRENT_GAME", true);
};

export const ADD_NOTES = ({ commit, dispatch }, payload) => {
  const messages =
    payload && payload.messages !== undefined ? payload.messages : payload;
  const immediateSave = !!(payload && payload.immediateSave);
  commit("ADD_NOTES", messages);
  saveCurrentGameForNotes(dispatch, immediateSave);
};

export const REPLACE_NOTES = (
  { commit, dispatch },
  { removals, additions, immediateSave = false }
) => {
  commit("REPLACE_NOTES", { removals, additions });
  saveCurrentGameForNotes(dispatch, immediateSave);
};

export const SET_NOTES = ({ commit, dispatch }, { plyID, messages }) => {
  commit("SET_NOTES", { plyID, messages });
  dispatch("SAVE_CURRENT_GAME", true);
};

export const REMOVE_NOTE = ({ commit, dispatch }, { plyID, index }) => {
  commit("REMOVE_NOTE", { plyID, index });
  dispatch("SAVE_CURRENT_GAME", true);
};

export const REMOVE_ANALYSIS_NOTE = ({ commit, dispatch }, source) => {
  commit("REMOVE_ANALYSIS_NOTE", source);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const REMOVE_POSITION_NOTES = ({ commit, dispatch }, plyID) => {
  commit("REMOVE_POSITION_NOTES", plyID);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const REMOVE_POSITION_USER_NOTES = ({ commit, dispatch }, plyID) => {
  commit("REMOVE_POSITION_USER_NOTES", plyID);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const REMOVE_ALL_USER_NOTES = function ({ commit, dispatch }) {
  commit("REMOVE_ALL_USER_NOTES");
  dispatch("SAVE_CURRENT_GAME", true);
};

export const REMOVE_NOTES = function ({ commit, dispatch }) {
  commit("REMOVE_NOTES");
  dispatch("SAVE_CURRENT_GAME", true);
};

export const REMOVE_ANALYSIS_NOTES = function ({ commit, dispatch }) {
  commit("REMOVE_ANALYSIS_NOTES");
  dispatch("SAVE_CURRENT_GAME", true);
};

export const REMOVE_POSITION_ANALYSIS_NOTES = function (
  { commit, dispatch },
  tps
) {
  commit("REMOVE_POSITION_ANALYSIS_NOTES", tps);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const REMOVE_BOT_ANALYSIS_NOTES = function (
  { commit, dispatch },
  botName
) {
  commit("REMOVE_BOT_ANALYSIS_NOTES", botName);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const REMOVE_POSITION_BOT_ANALYSIS_NOTES = function (
  { commit, dispatch },
  { tps, botName }
) {
  commit("REMOVE_POSITION_BOT_ANALYSIS_NOTES", { tps, botName });
  dispatch("SAVE_CURRENT_GAME", true);
};
