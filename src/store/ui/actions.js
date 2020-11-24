import Vue from "vue";
import {
  copyToClipboard,
  exportFile,
  Loading,
  LocalStorage,
  Dialog,
  Notify
} from "quasar";
import { i18n } from "../../../src/boot/i18n";
import { isArray } from "lodash";

export const SET_UI = ({ state, commit }, [key, value]) => {
  if (key in state.defaults) {
    if (!state.embed) {
      LocalStorage.set(key, value);
    }
    commit("SET_UI", [key, value]);
  }
};

export const TOGGLE_UI = ({ state, commit }, key) => {
  if (key in state.defaults) {
    if (!state.embed) {
      LocalStorage.set(key, !state[key]);
    }
    commit("SET_UI", [key, !state[key]]);
  }
};

export const WITHOUT_BOARD_ANIM = ({ commit, state }, action) => {
  if (state.animateBoard) {
    commit("SET_UI", ["animateBoard", false]);
    action();
    Vue.nextTick(() => {
      commit("SET_UI", ["animateBoard", true]);
    });
  } else {
    action();
  }
};

export const ADD_GAME = ({ commit, dispatch, getters }, game) => {
  let games = LocalStorage.getItem("games") || [];
  game.name = getters.uniqueName(game.name);
  games.unshift(game.name);
  LocalStorage.set("games", games);
  LocalStorage.set("ptn-" + game.name, game.ptn);
  if (game.state) {
    LocalStorage.set("state-" + game.name, game.state);
  }
  if (game.history) {
    LocalStorage.set("history-" + game.name, game.history);
    LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
  }

  dispatch("WITHOUT_BOARD_ANIM", () => commit("ADD_GAME", game));
};

export const REMOVE_GAME = ({ commit, dispatch }, index) => {
  let games = LocalStorage.getItem("games") || [];
  const name = games.splice(index, 1);
  LocalStorage.set("games", games);
  LocalStorage.remove("ptn-" + name);
  LocalStorage.remove("state-" + name);
  LocalStorage.remove("history-" + name);
  LocalStorage.remove("historyIndex-" + name);
  if (index === 0) {
    Loading.show();
    setTimeout(() => {
      dispatch("WITHOUT_BOARD_ANIM", () => {
        commit("REMOVE_GAME", index);
        Loading.hide();
      });
    }, 200);
  } else {
    commit("REMOVE_GAME", index);
  }
};

export const REMOVE_MULTIPLE_GAMES = (
  { commit, dispatch },
  { start, count }
) => {
  let games = LocalStorage.getItem("games") || [];
  const names = games.splice(start, count);
  LocalStorage.set("games", games);
  names.forEach(name => {
    LocalStorage.remove("ptn-" + name);
    LocalStorage.remove("state-" + name);
    LocalStorage.remove("history-" + name);
    LocalStorage.remove("historyIndex-" + name);
  });
  commit("REMOVE_MULTIPLE_GAMES", { start, count });
  if (start === 0 && count > 0 && games.length) {
    dispatch("SELECT_GAME", { index: 0 });
  }
  Vue.nextTick(() => {
    Notify.create({
      icon: "close_multiple",
      type: "positive",
      color: "secondary",
      classes: "text-grey-2",
      timeout: 3000,
      position: "bottom",
      message: i18n.tc("success.closedMultipleGames", count)
    });
  });
};

export const UPDATE_PTN = ({ state, commit }, ptn) => {
  LocalStorage.set("ptn-" + state.games[0].name, ptn);
  commit("UPDATE_PTN", ptn);
};

export const SET_NAME = ({ state, commit, getters }, name) => {
  let oldName = state.games[0].name;
  let games = LocalStorage.getItem("games");
  name = getters.uniqueName(name, true);
  games[0] = name;
  LocalStorage.set("games", games);
  LocalStorage.remove("ptn-" + oldName);
  LocalStorage.set("ptn-" + name, state.games[0].ptn);
  LocalStorage.remove("state-" + oldName);
  LocalStorage.set("state-" + name, state.games[0].state);
  if (state.games[0].history) {
    LocalStorage.remove("history-" + oldName);
    LocalStorage.set("history-" + state.games[0].name, state.games[0].history);
    LocalStorage.remove("historyIndex-" + oldName);
    LocalStorage.set(
      "historyIndex-" + state.games[0].name,
      state.games[0].historyIndex
    );
  }
  commit("SET_NAME", name);
};

export const SET_STATE = ({ state, commit }, gameState) => {
  LocalStorage.set("state-" + state.games[0].name, gameState);
  commit("SET_STATE", gameState);
};

export const SELECT_GAME = ({ commit, dispatch }, { index, immediate }) => {
  let games = LocalStorage.getItem("games") || [];
  games.unshift(games.splice(index, 1)[0]);
  LocalStorage.set("games", games);
  if (immediate) {
    commit("SELECT_GAME", index);
  } else {
    Loading.show();
    setTimeout(() => {
      dispatch("WITHOUT_BOARD_ANIM", () => {
        commit("SELECT_GAME", index);
        Loading.hide();
      });
    }, 200);
  }
};

export const CANCEL_MOVE = ({ commit }, game) => {
  commit("CANCEL_MOVE", game);
};

export const UNDO = ({ commit, dispatch }, game) => {
  dispatch("WITHOUT_BOARD_ANIM", () => {
    commit("UNDO", game);
  });
};

export const REDO = ({ commit, dispatch }, game) => {
  dispatch("WITHOUT_BOARD_ANIM", () => {
    commit("REDO", game);
  });
};

export const TRIM_BRANCHES = ({ commit, dispatch }, game) => {
  dispatch("WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_BRANCHES", game);
  });
};

export const TRIM_TO_BOARD = ({ commit, dispatch }, game) => {
  dispatch("WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_TO_BOARD", game);
  });
};

export const TRIM_TO_PLY = ({ commit, dispatch }, game) => {
  dispatch("WITHOUT_BOARD_ANIM", () => {
    commit("TRIM_TO_PLY", game);
  });
};

export const SAVE = (context, games) => {
  if (!isArray(games)) {
    games = [games];
  }
  function download() {
    const success = games.map(game =>
      exportFile(game.name + ".ptn", game.ptn, "text/plain;charset=utf-8")
    );

    if (success.some(s => !s)) {
      Notify.create({
        type: "negative",
        timeout: 3000,
        position: "bottom",
        message: i18n.t("error.Unable to download")
      });
    }
  }

  const files = Object.freeze(
    games.map(
      game =>
        new File([game.ptn], game.name + ".txt", {
          type: "text/plain"
        })
    )
  );
  if (navigator.canShare && navigator.canShare({ files })) {
    const title =
      games.length === 1 ? games[0].name + ".txt" : i18n.t("Multiple Games");

    navigator.share({ files, title }).catch(error => {
      console.error(error);
      if (!/canceled|abort/i.test(error)) {
        download();
      }
    });
  } else {
    download();
  }
};

export const OPEN = ({ dispatch }, callback) => {
  let input = document.createElement("INPUT");
  input.type = "file";
  input.accept = ".ptn,.txt";
  input.multiple = true;
  input.hidden = true;
  input.addEventListener("input", event => {
    dispatch("OPEN_FILES", event.target.files);
    if (callback && typeof callback === "function") {
      callback();
    }
  });
  input.click();
};

export const OPEN_FILES = ({ dispatch }, files) => {
  let count = 0;
  files = Array.from(files);
  Loading.show();
  setTimeout(
    () =>
      files.forEach(file => {
        if (file && /\.ptn$|\.txt$/i.test(file.name)) {
          let reader = new FileReader();
          reader.onload = event => {
            dispatch("ADD_GAME", {
              name: file.name.replace(/\.ptn$|\.txt$/, ""),
              ptn: event.target.result
            });
            if (!--count) {
              Loading.hide();
            }
          };
          reader.onerror = error => console.error(error);
          ++count;
          reader.readAsText(file);
        }
      }),
    200
  );
};

export const SAVE_UNDO_HISTORY = ({ commit }, game) => {
  LocalStorage.set("history-" + game.name, game.history);
  commit("SAVE_UNDO_HISTORY", game);
};

export const SAVE_UNDO_INDEX = ({ commit }, game) => {
  LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
  commit("SAVE_UNDO_INDEX", game);
};

export const COPY = function(context, { url, text, title }) {
  function copy() {
    copyToClipboard(text || url)
      .then(() => {
        Notify.create({
          icon: "copy",
          type: "positive",
          color: "secondary",
          classes: "text-grey-2",
          timeout: 1000,
          position: "bottom",
          message: i18n.t("success.copied")
        });
      })
      .catch(() => {
        Notify.create({
          type: "negative",
          timeout: 3000,
          position: "bottom",
          message: i18n.t("error.Unable to copy")
        });
        Dialog.create({
          class: "bg-secondary",
          color: "accent",
          prompt: {
            model: text || url,
            filled: true,
            type: text && text.includes("\n") ? "textarea" : "text"
          },
          cancel: false
        });
      });
  }

  if (navigator.canShare) {
    navigator.share({ url, text, title }).catch(error => {
      console.error(error);
      if (!/canceled|abort/i.test(error)) {
        copy();
      }
    });
  } else {
    copy();
  }
};
