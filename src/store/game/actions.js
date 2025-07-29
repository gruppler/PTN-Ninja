import Vue from "vue";
import { Loading, Platform } from "quasar";
import { i18n } from "../../boot/i18n";
import { compact, isEmpty, isString, throttle } from "lodash";
import { notifyError, notifyWarning } from "../../utilities";
import { TPStoPNG } from "tps-ninja";
import { openLocalDB } from "./db";
import Game from "../../Game";
import TPS from "../../Game/PTN/TPS";
import Ply from "../../Game/PTN/Ply";
import Linenum from "../../Game/PTN/Linenum";
import router from "../../router";
import { parseURLparams } from "../../router/routes";

let gamesDB;

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

export const SET_GAME = function ({ commit }, game) {
  const title = game.name + " — " + i18n.t("app_title");
  commit("SET_GAME", game);
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

  try {
    Loading.show();
    await gamesDB.add("games", newGame);
  } catch (error) {
    Loading.hide();
    notifyError(error);
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
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const newGame = {
      name: getters.uniqueName(game.name),
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
      games[0].name = getters.uniqueName(games[0].name);
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
    if (!gameState) {
      gameState = game.minState;
    }
    game.replacePTN(ptn, gameState);
    commit("SET_GAME", game);
    dispatch("SAVE_CURRENT_GAME", true);

    Vue.nextTick(() => {
      Vue.prototype.notify({
        message: i18n.t("success.replacedExistingGame"),
        timeout: 1e4,
        progress: true,
        multiLine: false,
        actions: [
          {
            label: i18n.t("Undo"),
            color: "primary",
            handler: () => {
              dispatch("UNDO", game);
            },
          },
          { icon: "close" },
        ],
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
      Vue.prototype.notify({
        icon,
        message: i18n.t("Game x closed", { game: game.name }),
        timeout: 1e4,
        progress: true,
        multiLine: false,
        actions: [
          {
            label: i18n.t("Undo"),
            color: "primary",
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
          },
          { icon: "close" },
        ],
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
      Vue.prototype.notify({
        icon: "close_multiple",
        message: i18n.tc("success.closedMultipleGames", count),
        timeout: 1e4,
        progress: true,
        actions: [
          {
            label: i18n.t("Undo"),
            color: "primary",
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
          },
          { icon: "close" },
        ],
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
      this.state.ui.pngConfig.highlightSquares &&
      !this.state.ui.highlighterEnabled,
    transform: this.state.ui.boardTransform,
  };

  // Highlights
  if (
    this.state.ui.highlighterEnabled &&
    Object.keys(this.state.ui.highlighterSquares).length
  ) {
    options.highlighter = this.state.ui.highlighterSquares;
  }

  const ply = game.position.ply;
  if (ply) {
    if (game.position.plyIsDone) {
      options.ply =
        ply.text +
        (options.evalText && ply.evaluation ? ply.evaluation.text : "");
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

  TPStoPNG(options).toBlob((blob) => {
    this.dispatch(
      "ui/DOWNLOAD_FILES",
      new File(
        [blob],
        this.getters["ui/pngFilename"]({
          name: game.name,
          plyID: game.position.plyID,
          plyIsDone: game.position.plyIsDone,
        }),
        {
          type: "image/png",
        }
      )
    );
  });
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

export const ADD_PLAYTAK_GAME = async function ({ dispatch }, { id, state }) {
  try {
    const response = await fetch(
      `https://api.playtak.com/v1/games-history/ptn/${id}`
      // `https://api.beta.playtak.com/v1/games-history/ptn/${id}`
    );
    if (response && response.ok) {
      const ptn = await response.text();
      console.log(ptn);
      let game = new Game({ ptn, state });
      game.warnings.forEach((warning) => notifyWarning(warning));
      return dispatch("ADD_GAME", game);
    } else {
      if (response) {
        if (response.status === 404) {
          throw "Game does not exist";
        } else {
          response = await response.json();
          console.log(response);
          throw response && response.message ? response.message : "unknown";
        }
      } else {
        throw "unknown";
      }
    }
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
        editingTPS: game.editingTPS,
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
  commit("SET_NAME", { oldName, newName });
};

export const SET_TAGS = function ({ commit, dispatch }, tags) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("SET_TAGS", tags);
    dispatch("SAVE_CURRENT_GAME", true);
  });
};

export const SET_PLAYER = function ({ commit }, player) {
  const game = Vue.prototype.$game;
  player = Number(player) || null;
  const config = { ...game.config, player };
  Object.assign(game.config, config);
  if (!this.state.ui.embed) {
    commit("SAVE_CONFIG", { game, config });
  }
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
};

export const HIGHLIGHT_SQUARES = function ({ commit }, args) {
  commit("HIGHLIGHT_SQUARES", args);
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

export const DELETE_PLY = function ({ commit, dispatch }, plyID) {
  commit("DELETE_PLY", plyID);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const APPEND_PLY = function ({ commit, dispatch }, ply) {
  commit("APPEND_PLY", ply);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const INSERT_PLY = function ({ commit, dispatch }, ply) {
  commit("INSERT_PLY", ply);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const INSERT_PLIES = function ({ commit, dispatch }, { plies, prev }) {
  if (isString(plies)) {
    plies = plies.split(/\s+/);
  }
  plies = compact(plies);
  commit("INSERT_PLIES", { plies, prev });
  dispatch("SAVE_CURRENT_GAME", true);
};

export const DELETE_BRANCH = function ({ commit, dispatch }, branch) {
  commit("DELETE_BRANCH", branch);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const UNDO = function ({ commit, dispatch }) {
  if (this.state.ui.disableUndo || this.state.ui.disableBoard) {
    return;
  }
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("UNDO");
    dispatch("SAVE_CURRENT_GAME", true);
  });
};

export const REDO = function ({ commit, dispatch }) {
  if (this.state.ui.disableUndo || this.state.ui.disableBoard) {
    return;
  }
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
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_TO_BOARD");
    dispatch("SAVE_CURRENT_GAME", true);
  });
};

export const TRIM_TO_PLY = function ({ commit, dispatch }) {
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
  commit("PROMOTE_BRANCH", args);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const MAKE_BRANCH_MAIN = function ({ commit, dispatch }, args) {
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

export const EDIT_NOTE = ({ commit, dispatch }, { plyID, index, message }) => {
  commit("EDIT_NOTE", { plyID, index, message });
  dispatch("SAVE_CURRENT_GAME", true);
};

export const ADD_NOTE = ({ commit, dispatch }, { message, plyID }) => {
  commit("ADD_NOTE", { message, plyID });
  dispatch("SAVE_CURRENT_GAME", true);
};

export const ADD_NOTES = ({ commit, dispatch }, messages) => {
  commit("ADD_NOTES", messages);
  dispatch("SAVE_CURRENT_GAME", true);
};

export const REMOVE_NOTE = ({ commit, dispatch }, { plyID, index }) => {
  commit("REMOVE_NOTE", { plyID, index });
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
