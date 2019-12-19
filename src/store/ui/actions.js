import {
  copyToClipboard,
  exportFile,
  Loading,
  LocalStorage,
  Notify
} from "quasar";

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
    LocalStorage.set("state-" + game.name, game.state);
  }
  LocalStorage.set("options-" + game.name, game.options);
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
  LocalStorage.remove("options-" + name);
  LocalStorage.remove("history-" + name);
  LocalStorage.remove("historyIndex-" + name);
  commit("REMOVE_GAME", index);
};

export const UPDATE_PTN = ({ state, commit }, ptn) => {
  LocalStorage.set("ptn-" + state.games[0].name, ptn);
  commit("UPDATE_PTN", ptn);
};

export const SET_NAME = ({ state, commit, getters }, name) => {
  let oldName = state.games[0].name;
  let games = LocalStorage.getItem("games", true);
  name = getters.uniqueName(name);
  games[0] = name;
  LocalStorage.set("games", games);
  LocalStorage.remove("ptn-" + oldName);
  LocalStorage.set("ptn-" + name, state.games[0].ptn);
  LocalStorage.remove("state-" + oldName);
  LocalStorage.set("state-" + name, state.games[0].state);
  if (state.games[0].options) {
    LocalStorage.remove("options-" + oldName);
    LocalStorage.set("options-" + name, state.games[0].options);
  }
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

export const SAVE = (context, game) => {
  exportFile(game.name + ".ptn", game.ptn, "text/plain;charset=utf-8");
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
          ptn: event.target.result
        });
        if (!--count) {
          Loading.hide();
        }
      };
      if (!count++) {
        Loading.show();
      }
      reader.readAsText(file);
    }
  });
};

export const SAVE_OPTIONS = ({ commit }, game) => {
  LocalStorage.set("options-" + game.name, game.options);
  commit("SAVE_OPTIONS", game);
};

export const SAVE_UNDO_HISTORY = ({ commit }, game) => {
  LocalStorage.set("history-" + game.name, game.history);
  commit("SAVE_UNDO_HISTORY", game);
};

export const SAVE_UNDO_INDEX = ({ commit }, game) => {
  LocalStorage.set("historyIndex-" + game.name, game.historyIndex);
  commit("SAVE_UNDO_INDEX", game);
};

export const COPY = function(context, { text, message }) {
  copyToClipboard(text);
  Notify.create({
    icon: "file_copy",
    type: "positive",
    color: "white",
    classes: "text-grey-10",
    timeout: 1,
    position: "bottom",
    message
  });
};
