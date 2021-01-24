import Vue from "vue";
import { Loading, LocalStorage } from "quasar";
import { i18n } from "../../boot/i18n";

export const SET_GAME = function ({ commit }, game) {
  document.title = game.name + " — " + i18n.t("app_title");
  commit("SET_GAME", game);
};

export const ADD_GAME = function ({ commit, dispatch, getters }, game) {
  const gameNames = LocalStorage.getItem("games") || [];

  game.name = getters.uniqueName(game.name);
  gameNames.unshift(game.name);
  LocalStorage.set("games", gameNames);
  LocalStorage.set("ptn-" + game.name, game.ptn);
  if (game.state) {
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

  Loading.show();
  setTimeout(() => {
    dispatch("SET_GAME", game);
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
    if (game.state) {
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
  });

  commit("ADD_GAMES", { games, index });
  if (!index) {
    this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
      dispatch("SET_GAME", state.list[0]);
    });
  }
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

  const finish = () => {
    commit("REMOVE_GAME", index);
    Vue.nextTick(() => {
      if (index === 0) {
        dispatch("SET_GAME", state.list[0]);
      }
      const icon = game.config.isOnline
        ? getters.playerIcon(game.config.player, game.config.isPrivate)
        : "file";
      this.dispatch("ui/NOTIFY", {
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
  });

  const finish = () => {
    commit("REMOVE_MULTIPLE_GAMES", { start, count });
    Vue.nextTick(() => {
      if (start === 0) {
        dispatch("SET_GAME", state.list[0]);
      }
      this.dispatch("ui/NOTIFY", {
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
  const game = state.current;
  const options = { tps: game.state.tps, ...this.state.ui.pngConfig };

  // Game Tags
  ["caps", "flats", "caps1", "flats1", "caps2", "flats2"].forEach((tagName) => {
    const tag = game.tags[tagName];
    if (tag && tag.value) {
      options[tagName] = tag.value;
    }
  });

  game.render(options).toBlob((blob) => {
    this.dispatch(
      "ui/DOWNLOAD_FILES",
      new File([blob], game.pngFilename, {
        type: "image/png",
      })
    );
  });
};

export const OPEN_FILES = function ({ dispatch }, files) {
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
        if (file && /\.ptn$|\.txt$/i.test(file.name)) {
          let reader = new FileReader();
          reader.onload = (event) => {
            games.push({
              name: file.name.replace(/\.ptn$|\.txt$/, ""),
              ptn: event.target.result,
            });
            if (!--count) {
              Loading.hide();
              dispatch("ADD_GAMES", { games, index: 0 });
            }
          };
          reader.onerror = (error) => console.error(error);
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
  const oldName = state.current.name;
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

export const SAVE_CURRENT_GAME = function ({ dispatch, state }) {
  const game = state.current;
  if (game && !state.embed) {
    dispatch("SAVE_UNDO_INDEX", game);
    dispatch("SAVE_UNDO_HISTORY", game);
    dispatch("SAVE_PTN", game.ptn);
    dispatch("SAVE_STATE", { game, gameState: game.minState });
  }
};

export const SAVE_CURRENT_GAME_STATE = function ({ dispatch, state }) {
  const game = state.current;
  if (game && !state.embed) {
    dispatch("SAVE_UNDO_INDEX", game);
    dispatch("SAVE_UNDO_HISTORY", game);
    dispatch("SAVE_STATE", { game, gameState: game.minState });
  }
};

export const SAVE_UNDO_HISTORY = function ({ commit, state }) {
  if (game && !state.embed) {
    LocalStorage.set("history-" + game.name, game.history);
    commit("SAVE_UNDO_HISTORY");
  }
};

export const SAVE_UNDO_INDEX = function ({ commit, state }) {
  if (game && !state.embed) {
    LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
    commit("SAVE_UNDO_INDEX");
  }
};

export const SAVE_PTN = function ({ state, commit }, ptn) {
  LocalStorage.set("ptn-" + state.list[0].name, ptn);
  commit("SAVE_PTN", ptn);
};

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
  LocalStorage.set("state-" + name, game.state);
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

export const FIRST = function ({ commit }) {
  return commit("FIRST");
  dispatch("SAVE_CURRENT_GAME_STATE");
};

export const LAST = function ({ commit }) {
  return commit("LAST");
  dispatch("SAVE_CURRENT_GAME_STATE");
};

export const PREV = function ({ commit }, half) {
  return commit("PREV", half);
  dispatch("SAVE_CURRENT_GAME_STATE");
};

export const NEXT = function ({ commit }, half) {
  return commit("NEXT", half);
  dispatch("SAVE_CURRENT_GAME_STATE");
};

export const SET_TARGET = function ({ commit }, ply) {
  return commit("SET_TARGET", ply);
  dispatch("SAVE_CURRENT_GAME_STATE");
};

export const GO_TO_PLY = function ({ commit }, { ply, isDone }) {
  return commit("GO_TO_PLY", { ply, isDone });
  dispatch("SAVE_CURRENT_GAME_STATE");
};

export const DO_TPS = function ({ commit }, tps) {
  return commit("DO_TPS", tps);
};

export const SAVE_TPS = function ({ commit, dispatch }, tps) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("SAVE_TPS", tps);
    this.dispatch("ui/SET_UI", ["isEditingTPS", false]);
    this.dispatch("ui/SET_UI", ["editingTPS", ""]);
    dispatch("SAVE_CURRENT_GAME");
  });
};

export const RESET_TPS = function ({ commit }) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("RESET_TPS");
    this.dispatch("ui/SET_UI", ["isEditingTPS", false]);
    this.dispatch("ui/SET_UI", ["editingTPS", ""]);
  });
};

export const RENAME_BRANCH = function ({ commit, dispatch }, args) {
  commit("RENAME_BRANCH", args);
  dispatch("SAVE_CURRENT_GAME");
};