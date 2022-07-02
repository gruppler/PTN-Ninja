import Vue from "vue";
import { Loading, LocalStorage } from "quasar";
import { i18n } from "../../boot/i18n";
import { throttle } from "lodash";
import { notifyError } from "../../utilities";
import Game from "../../Game";

export const SET_GAME = function ({ commit }, game) {
  document.title = game.name + " — " + i18n.t("app_title");
  commit("SET_GAME", game);
  if (game.config.unseen) {
    dispatch("SAVE_CONFIG", {
      game,
      config: { ...game.config, unseen: false },
    });
  }
};

export const ADD_GAME = function ({ commit, dispatch, getters }, game) {
  const gameNames = LocalStorage.getItem("games") || [];

  game.name = getters.uniqueName(game.name);
  gameNames.unshift(game.name);
  LocalStorage.set("games", gameNames);
  LocalStorage.set("ptn-" + game.name, game.ptn);
  if (game.board || game.state) {
    LocalStorage.set("state-" + game.name, game.minState || game.state);
  }
  if (game.config) {
    LocalStorage.set("config-" + game.name, game.config);
  } else {
    game.config = {};
  }
  if (game.history) {
    LocalStorage.set("history-" + game.name, game.history);
    LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
  }
  if (game.editingTPS !== undefined) {
    LocalStorage.set("editingTPS-" + game.name, game.editingTPS);
  } else {
    LocalStorage.remove("editingTPS-" + game.name);
  }

  Loading.show();
  setTimeout(async () => {
    await dispatch("SET_GAME", game);
    this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
      commit("ADD_GAME", game);
      Loading.hide();
    });
  }, 200);
};

export const ADD_GAMES = function (
  { commit, dispatch, getters, state },
  { games, index }
) {
  const gameNames = LocalStorage.getItem("games") || [];

  games.forEach((game, i) => {
    game.name = getters.uniqueName(game.name);
    gameNames.splice(index + i, 0, game.name);
    LocalStorage.set("games", gameNames);
    LocalStorage.set("ptn-" + game.name, game.ptn);
    if (game.board || game.state) {
      LocalStorage.set("state-" + game.name, game.minState || game.state);
    }
    if (game.config) {
      LocalStorage.set("config-" + game.name, game.config);
    } else {
      game.config = {};
    }
    if (game.history) {
      LocalStorage.set("history-" + game.name, game.history);
      LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
    }
    if (game.editingTPS !== undefined) {
      LocalStorage.set("editingTPS-" + game.name, game.editingTPS);
    } else {
      LocalStorage.remove("editingTPS-" + game.name);
    }
  });

  commit("ADD_GAMES", { games, index });
  if (!index) {
    this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
      dispatch("SET_GAME", state.list[0]);
    });
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
    dispatch("SAVE_UNDO_INDEX");
    dispatch("SAVE_UNDO_HISTORY");
    dispatch("SAVE_PTN", ptn);
    dispatch("SAVE_STATE", { game, gameState });

    Vue.nextTick(() => {
      Vue.prototype.notify({
        message: i18n.t("success.replacedExistingGame"),
        timeout: 5000,
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
    dispatch("SAVE_STATE", { game, gameState });
  }
  return game;
};

export const REMOVE_GAME = function (
  { commit, dispatch, state, getters },
  index
) {
  const game = state.list[index];
  const games = LocalStorage.getItem("games") || [];
  const name = games.splice(index, 1);
  LocalStorage.set("games", games);
  LocalStorage.remove("ptn-" + name);
  LocalStorage.remove("state-" + name);
  LocalStorage.remove("config-" + name);
  LocalStorage.remove("history-" + name);
  LocalStorage.remove("historyIndex-" + name);
  LocalStorage.remove("editingTPS-" + name);

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
        timeout: 5000,
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
                  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
                    dispatch("ADD_GAMES", { games: [game], index });
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

export const REMOVE_MULTIPLE_GAMES = function (
  { commit, dispatch, state },
  { start, count }
) {
  const games = state.list.slice(start, start + count);
  const gameNames = LocalStorage.getItem("games") || [];
  const names = gameNames.splice(start, count);
  LocalStorage.set("games", gameNames);
  names.forEach((name) => {
    LocalStorage.remove("ptn-" + name);
    LocalStorage.remove("state-" + name);
    LocalStorage.remove("config-" + name);
    LocalStorage.remove("history-" + name);
    LocalStorage.remove("historyIndex-" + name);
    LocalStorage.remove("editingTPS-" + name);
  });

  const finish = () => {
    commit("REMOVE_MULTIPLE_GAMES", { start, count });
    Vue.nextTick(() => {
      if (start === 0) {
        dispatch("SET_GAME", state.list[0]);
      }
      Vue.prototype.notify({
        icon: "close_multiple",
        message: i18n.tc("success.closedMultipleGames", count),
        timeout: 5000,
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
  const game = Vue.prototype.$game;
  const options = { tps: game.board.tps, ...this.state.ui.pngConfig };

  // Game Tags
  ["caps", "flats", "caps1", "flats1", "caps2", "flats2"].forEach((tagName) => {
    const tag = game.tags[tagName];
    if (tag && tag.value) {
      options[tagName] = tag.value;
    }
  });

  game.board.render(options).toBlob((blob) => {
    this.dispatch(
      "ui/DOWNLOAD_FILES",
      new File([blob], game.pngFilename, {
        type: "image/png",
      })
    );
  });
};

export const OPEN_FILES = function ({ commit, dispatch, state }, files) {
  const games = [];
  let count = 0;
  files = Array.from(files);
  if (!files.length) {
    return false;
  }
  Loading.show();
  setTimeout(
    () =>
      files.forEach((file) => {
        if (file && /(\.ptn|\.txt)+$/i.test(file.name)) {
          let reader = new FileReader();
          reader.onload = (event) => {
            const name = file.name.replace(/(\.ptn|\.txt)+$/, "");
            const index = state.list.findIndex((g) => g.name === name);
            const ptn = event.target.result;
            const onError = (error, plyID) => {
              console.warn(
                `Encountered an error in "${name}" at plyID:`,
                plyID
              );
              console.error(error);
            };
            if (index < 0 || this.state.ui.openDuplicate !== "replace") {
              games.push(new Game({ ptn, name, onError }));
            } else {
              dispatch("REPLACE_GAME", { index, ptn });
            }
            if (!--count) {
              Loading.hide();
              dispatch("ADD_GAMES", { games, index: 0 });
            }
          };
          reader.onerror = notifyError;
          ++count;
          reader.readAsText(file);
        }
      }),
    200
  );
};

export const RENAME_CURRENT_GAME = function (
  { commit, dispatch, state },
  newName
) {
  const oldName = Vue.prototype.$game.name;
  commit("RENAME_CURRENT_GAME", newName);
  dispatch("SET_NAME", { oldName, newName });
  setTimeout(() => {
    document.title = newName + " — " + i18n.t("app_title");
  }, 200);
};

export const SET_CURRENT_PTN = function ({ commit, dispatch }, ptn) {
  commit("SET_CURRENT_PTN", ptn);
  dispatch("SAVE_CURRENT_GAME");
};

export const SAVE_CURRENT_GAME = function ({ commit, state }) {
  const game = Vue.prototype.$game;
  if (game && !this.state.ui.embed) {
    LocalStorage.set("ptn-" + game.name, game.ptn);
    LocalStorage.set("state-" + game.name, game.minState);
    LocalStorage.set("history-" + game.name, game.history);
    LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
  }
  commit("SAVE_CURRENT_GAME");
};

export const SAVE_CURRENT_GAME_STATE = throttle(function ({ commit, state }) {
  const game = Vue.prototype.$game;
  if (game && !this.state.ui.embed) {
    LocalStorage.set("state-" + game.name, game.minState);
  }
  commit("SAVE_CURRENT_GAME_STATE");
}, 300);

export const SAVE_UNDO_HISTORY = throttle(function ({ commit, state }) {
  const game = Vue.prototype.$game;
  if (game && !this.state.ui.embed) {
    LocalStorage.set("history-" + game.name, game.history);
  }
  commit("SAVE_UNDO_HISTORY");
}, 300);

export const SAVE_UNDO_INDEX = throttle(function ({ commit, state }) {
  const game = Vue.prototype.$game;
  if (game && !this.state.ui.embed) {
    LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
  }
  commit("SAVE_UNDO_INDEX");
}, 300);

export const SAVE_PTN = throttle(function ({ state, commit }, ptn) {
  LocalStorage.set("ptn-" + state.list[0].name, ptn);
  commit("SAVE_PTN", ptn);
}, 300);

export const SET_NAME = function (
  { state, commit, getters },
  { oldName, newName }
) {
  const index = state.list.findIndex((game) => game.name === oldName);
  if (index < 0) {
    throw new Error("Game not found: " + oldName);
  }
  const game = state.list[index];
  const games = LocalStorage.getItem("games");
  const name = getters.uniqueName(newName, true);
  games[index] = name;
  LocalStorage.set("games", games);
  LocalStorage.remove("ptn-" + oldName);
  LocalStorage.set("ptn-" + name, game.ptn);
  LocalStorage.remove("state-" + oldName);
  LocalStorage.set("state-" + name, game.board || game.state);
  if (game.config) {
    LocalStorage.remove("config-" + oldName);
    LocalStorage.set("config-" + name, game.config);
  }
  if (game.history) {
    LocalStorage.remove("history-" + oldName);
    LocalStorage.set("history-" + game.name, game.history);
    LocalStorage.remove("historyIndex-" + oldName);
    LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
  }
  commit("SET_NAME", { oldName, newName });
};

export const SAVE_STATE = function ({ commit, state }, { game, gameState }) {
  if (!state.list.some((g) => g.name === game.name)) {
    throw new Error("Game not found: " + game.name);
  }
  LocalStorage.set("state-" + game.name, gameState);
  commit("SAVE_STATE", { game, gameState });
};

export const SAVE_CONFIG = function ({ commit, state }, { game, config }) {
  if (!state.list.some((g) => g.name === game.name)) {
    throw new Error("Game not found: " + game.name);
  }
  LocalStorage.set("config-" + game.name, config);
  commit("SAVE_CONFIG", { game, config });
};

export const SET_TAGS = function ({ commit, dispatch }, tags) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("SET_TAGS", tags);
    dispatch("SAVE_CURRENT_GAME");
  });
};

export const SELECT_GAME = function (
  { commit, dispatch, state },
  { index, immediate }
) {
  let games = LocalStorage.getItem("games") || [];
  games.unshift(games.splice(index, 1)[0]);
  LocalStorage.set("games", games);
  if (immediate) {
    commit("SELECT_GAME", index);
  } else {
    Loading.show();
    setTimeout(() => {
      this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
        commit("SELECT_GAME", index);
        dispatch("SET_GAME", state.list[0]);
        Loading.hide();
      });
    }, 200);
  }
};

export const SELECT_SQUARE = function ({ commit, dispatch }, args) {
  commit("SELECT_SQUARE", args);
  dispatch("SAVE_CURRENT_GAME");
};

export const SELECT_PIECE = function ({ commit }, args) {
  commit("SELECT_PIECE", args);
};

export const CANCEL_MOVE = function ({ commit }) {
  commit("CANCEL_MOVE");
};

export const DELETE_PLY = function ({ commit, dispatch }, plyID) {
  commit("DELETE_PLY", plyID);
  dispatch("SAVE_CURRENT_GAME");
};

export const DELETE_BRANCH = function ({ commit, dispatch }, branch) {
  commit("DELETE_BRANCH", branch);
  dispatch("SAVE_CURRENT_GAME");
};

export const UNDO = function ({ commit, dispatch }) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("UNDO");
    dispatch("SAVE_CURRENT_GAME");
  });
};

export const REDO = function ({ commit, dispatch }) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("REDO");
    dispatch("SAVE_CURRENT_GAME");
  });
};

export const TRIM_BRANCHES = function ({ commit, dispatch }) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_BRANCHES");
    dispatch("SAVE_CURRENT_GAME");
  });
};

export const TRIM_TO_BOARD = function ({ commit, dispatch }) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_TO_BOARD");
    dispatch("SAVE_CURRENT_GAME");
  });
};

export const TRIM_TO_PLY = function ({ commit, dispatch }) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_TO_PLY");
    dispatch("SAVE_CURRENT_GAME");
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

export const EDIT_TPS = function ({ commit, state }, tps) {
  if (tps !== undefined) {
    LocalStorage.set("editingTPS-" + state.list[0].name, tps);
  } else {
    LocalStorage.remove("editingTPS-" + game.name);
  }
  commit("EDIT_TPS", tps);
};

export const SAVE_TPS = function ({ commit, dispatch, state }, tps) {
  LocalStorage.remove("editingTPS-" + state.list[0].name);
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("SAVE_TPS", tps);
    dispatch("SAVE_CURRENT_GAME");
  });
};

export const RESET_TPS = function ({ commit, state }) {
  LocalStorage.remove("editingTPS-" + state.list[0].name);
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("RESET_TPS");
  });
};

export const RENAME_BRANCH = function ({ commit, dispatch }, args) {
  commit("RENAME_BRANCH", args);
  dispatch("SAVE_CURRENT_GAME");
};

export const TOGGLE_EVALUATION = ({ commit, dispatch }, { type, double }) => {
  commit("TOGGLE_EVALUATION", { type, double });
  dispatch("SAVE_CURRENT_GAME");
};

export const EDIT_NOTE = ({ commit, dispatch }, { plyID, index, message }) => {
  commit("EDIT_NOTE", { plyID, index, message });
  dispatch("SAVE_CURRENT_GAME");
};

export const ADD_NOTE = ({ commit, dispatch }, message) => {
  commit("ADD_NOTE", message);
  dispatch("SAVE_CURRENT_GAME");
};

export const REMOVE_NOTE = ({ commit, dispatch }, { plyID, index }) => {
  commit("REMOVE_NOTE", { plyID, index });
  dispatch("SAVE_CURRENT_GAME");
};
