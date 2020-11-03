import {
  copyToClipboard,
  exportFile,
  Loading,
  LocalStorage,
  Dialog,
  Notify
} from "quasar";
import { i18n } from "../../../src/boot/i18n";

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

export const ADD_GAME = ({ commit, getters }, game) => {
  let games = LocalStorage.getItem("games") || [];
  game.name = getters.uniqueName(game.name);
  games.unshift(game.name);
  LocalStorage.set("games", games);
  LocalStorage.set("ptn-" + game.name, game.ptn);
  if (game.state) {
    LocalStorage.set("state-" + game.name, game.minState || game.state);
  }
  if (game.config) {
    LocalStorage.set("config-" + game.name, game.config);
  }
  if (game.history) {
    LocalStorage.set("history-" + game.name, game.history);
    LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
  }
  commit("ADD_GAME", game);
};

export const REMOVE_GAME = ({ commit }, index) => {
  let games = LocalStorage.getItem("games") || [];
  const name = games.splice(index, 1);
  LocalStorage.set("games", games);
  LocalStorage.remove("ptn-" + name);
  LocalStorage.remove("state-" + name);
  LocalStorage.remove("config-" + name);
  LocalStorage.remove("history-" + name);
  LocalStorage.remove("historyIndex-" + name);
  commit("REMOVE_GAME", index);
};

export const UPDATE_PTN = ({ state, commit }, ptn) => {
  LocalStorage.set("ptn-" + state.games[0].name, ptn);
  commit("UPDATE_PTN", ptn);
};

export const SET_NAME = ({ state, commit, getters }, { oldName, newName }) => {
  let index = state.games.findIndex(game => game.name === oldName);
  if (index < 0) {
    throw new Error("Game not found: " + oldName);
  }
  let games = LocalStorage.getItem("games");
  let name = getters.uniqueName(newName, true);
  games[index] = name;
  LocalStorage.set("games", games);
  LocalStorage.remove("ptn-" + oldName);
  LocalStorage.set("ptn-" + name, state.games[index].ptn);
  LocalStorage.remove("state-" + oldName);
  LocalStorage.set("state-" + name, state.games[index].state);
  if (state.games[index].config) {
    LocalStorage.remove("config-" + oldName);
    LocalStorage.set("config-" + name, state.games[index].config);
  }
  if (state.games[index].history) {
    LocalStorage.remove("history-" + oldName);
    LocalStorage.set(
      "history-" + state.games[index].name,
      state.games[index].history
    );
    LocalStorage.remove("historyIndex-" + oldName);
    LocalStorage.set(
      "historyIndex-" + state.games[index].name,
      state.games[index].historyIndex
    );
  }
  commit("SET_NAME", { oldName, newName });
};

export const SET_STATE = ({ commit, state }, { game, gameState }) => {
  if (!state.games.some(g => g.name === game.name)) {
    throw new Error("Game not found: " + game.name);
  }
  LocalStorage.set("state-" + game.name, gameState);
  commit("SET_STATE", { game, gameState });
};

export const SET_CONFIG = ({ commit, state }, { game, config }) => {
  if (!state.games.some(g => g.name === game.name)) {
    throw new Error("Game not found: " + game.name);
  }
  LocalStorage.set("config-" + game.name, config);
  commit("SET_CONFIG", { game, config });
};

export const SELECT_GAME = ({ commit }, index) => {
  let games = LocalStorage.getItem("games") || [];
  games.unshift(games.splice(index, 1)[0]);
  LocalStorage.set("games", games);
  commit("SELECT_GAME", index);
};

export const CANCEL_MOVE = ({ commit }, game) => {
  commit("CANCEL_MOVE", game);
};

export const UNDO = ({ commit }, game) => {
  commit("UNDO", game);
};

export const REDO = ({ commit }, game) => {
  commit("REDO", game);
};

export const TRIM_BRANCHES = ({ commit }, game) => {
  commit("TRIM_BRANCHES", game);
};

export const TRIM_TO_BOARD = ({ commit }, game) => {
  commit("TRIM_TO_BOARD", game);
};

export const TRIM_TO_PLY = ({ commit }, game) => {
  commit("TRIM_TO_PLY", game);
};

export const SAVE = (context, games) => {
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

  const files = games.map(game => new File([game.ptn], game.name + ".ptn"));
  if (navigator.canShare && navigator.canShare({ files })) {
    const title =
      games.length === 1 ? games[0].name + ".ptn" : i18n.t("Multiple Games");

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
  files.forEach(file => {
    if (file && /\.ptn$|\.txt$/i.test(file.name)) {
      let reader = new FileReader();
      reader.onload = event => {
        dispatch("ADD_GAME", {
          name: file.name.replace(/\.ptn$|\.txt$/, ""),
          ptn: event.target.result,
          config: { isOnline: false }
        });
        if (!--count) {
          Loading.hide();
        }
      };
      reader.onerror = error => console.error(error);
      if (!count++) {
        Loading.show();
      }
      reader.readAsText(file);
    }
  });
};

export const SAVE_UNDO_HISTORY = ({ commit }, game) => {
  LocalStorage.set("history-" + game.name, game.history);
  commit("SAVE_UNDO_HISTORY", game);
};

export const SAVE_UNDO_INDEX = ({ commit }, game) => {
  LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
  commit("SAVE_UNDO_INDEX", game);
};

export const COPY = function(context, text) {
  function copy() {
    copyToClipboard(text)
      .then(() => {
        Notify.create({
          icon: "copy",
          type: "positive",
          color: "secondary",
          classes: "text-grey-2",
          timeout: 1,
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
            model: text,
            filled: true,
            type: text.includes("\n") ? "textarea" : "text"
          },
          cancel: false
        });
      });
  }

  if (navigator.canShare) {
    navigator.share({ text }).catch(error => {
      console.error(error);
      if (!/canceled|abort/i.test(error)) {
        copy();
      }
    });
  } else {
    copy();
  }
};
