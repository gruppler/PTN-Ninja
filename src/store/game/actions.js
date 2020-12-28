import Vue from "vue";
import { Loading, LocalStorage } from "quasar";
import { i18n } from "../../boot/i18n";

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

  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => commit("ADD_GAME", game));
};

export const ADD_GAMES = function (
  { commit, dispatch, getters },
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

  this.dispatch("ui/WITHOUT_BOARD_ANIM", () =>
    commit("ADD_GAMES", { games, index })
  );
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

export const UPDATE_PTN = function ({ state, commit }, ptn) {
  LocalStorage.set("ptn-" + state.list[0].name, ptn);
  commit("UPDATE_PTN", ptn);
};

export const SET_NAME = function (
  { state, commit, getters },
  { oldName, newName }
) {
  let index = state.list.findIndex((game) => game.name === oldName);
  if (index < 0) {
    throw new Error("Game not found: " + oldName);
  }
  let games = LocalStorage.getItem("games");
  let name = getters.uniqueName(newName, true);
  games[index] = name;
  LocalStorage.set("games", games);
  LocalStorage.remove("ptn-" + oldName);
  LocalStorage.set("ptn-" + name, state.list[index].ptn);
  LocalStorage.remove("state-" + oldName);
  LocalStorage.set("state-" + name, state.list[index].state);
  if (state.list[index].config) {
    LocalStorage.remove("config-" + oldName);
    LocalStorage.set("config-" + name, state.list[index].config);
  }
  if (state.list[index].history) {
    LocalStorage.remove("history-" + oldName);
    LocalStorage.set(
      "history-" + state.list[index].name,
      state.list[index].history
    );
    LocalStorage.remove("historyIndex-" + oldName);
    LocalStorage.set(
      "historyIndex-" + state.list[index].name,
      state.list[index].historyIndex
    );
  }
  commit("SET_NAME", { oldName, newName });
};

export const SET_STATE = function ({ commit, state }, { game, gameState }) {
  if (!state.list.some((g) => g.name === game.name)) {
    throw new Error("Game not found: " + game.name);
  }
  LocalStorage.set("state-" + game.name, gameState);
  commit("SET_STATE", { game, gameState });
};

export const SET_CONFIG = function ({ commit, state }, { game, config }) {
  if (!state.list.some((g) => g.name === game.name)) {
    throw new Error("Game not found: " + game.name);
  }
  LocalStorage.set("config-" + game.name, config);
  commit("SET_CONFIG", { game, config });
};

export const SELECT_GAME = function (
  { commit, dispatch },
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
        Loading.hide();
      });
    }, 200);
  }
};

export const CANCEL_MOVE = function ({ commit }, game) {
  commit("CANCEL_MOVE", game);
};

export const UNDO = function ({ commit, dispatch }, game) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("UNDO", game);
  });
};

export const REDO = function ({ commit, dispatch }, game) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("REDO", game);
  });
};

export const TRIM_BRANCHES = function ({ commit, dispatch }, game) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_BRANCHES", game);
  });
};

export const TRIM_TO_BOARD = function ({ commit, dispatch }, game) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_TO_BOARD", game);
  });
};

export const TRIM_TO_PLY = function ({ commit, dispatch }, game) {
  this.dispatch("ui/WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_TO_PLY", game);
  });
};

export const SAVE_UNDO_HISTORY = function ({ commit }, game) {
  LocalStorage.set("history-" + game.name, game.history);
  commit("SAVE_UNDO_HISTORY", game);
};

export const SAVE_UNDO_INDEX = function ({ commit }, game) {
  LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
  commit("SAVE_UNDO_INDEX", game);
};
