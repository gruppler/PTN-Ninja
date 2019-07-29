import { LocalStorage } from "quasar";
import { pick } from "lodash";

const GAME_STATE_PROPS = ["targetBranch", "plyID", "plyIsDone"];

export const SET_UI = ({ state, commit }, [key, value]) => {
  if (key in state.defaults) {
    LocalStorage.set(key, value);
    commit("SET_UI", [key, value]);
  }
};

export const ADD_GAME = ({ commit }, game) => {
  let games = LocalStorage.getItem("games") || [];
  games.unshift(game.name);
  LocalStorage.set("games", games);
  LocalStorage.set("ptn-" + game.name, game.ptn);
  if (game.state) {
    game.state = pick(game.state, GAME_STATE_PROPS);
    LocalStorage.set("state-" + game.name, game.state);
  }
  commit("ADD_GAME", game);
};

export const REMOVE_GAME = ({ commit }, index) => {
  let games = LocalStorage.getItem("games") || [];
  const name = games.splice(index, 1);
  LocalStorage.set("games", games);
  LocalStorage.remove("ptn-" + name);
  LocalStorage.remove("state-" + name);
  commit("REMOVE_GAME", index);
};

export const UPDATE_PTN = ({ state, commit }, ptn) => {
  LocalStorage.set("ptn-" + state.games[0].name, ptn);
  commit("UPDATE_PTN", ptn);
};

export const SET_NAME = ({ state, commit }, name) => {
  let oldName = state.games[0].name;
  let games = LocalStorage.getItem("games");
  games[0] = name;
  LocalStorage.set("games", games);
  LocalStorage.remove("ptn-" + oldName);
  LocalStorage.set("ptn-" + name, state.games[0].ptn);
  LocalStorage.remove("state-" + oldName);
  LocalStorage.set(
    "state-" + name,
    pick(state.games[0].state, GAME_STATE_PROPS)
  );
  commit("SET_NAME", name);
};

export const SET_STATE = ({ state, commit }, gameState) => {
  if (!state.embed) {
    LocalStorage.set(
      "state-" + state.games[0].name,
      pick(gameState, GAME_STATE_PROPS)
    );
  }
  commit("SET_STATE", gameState);
};

export const SELECT_GAME = ({ commit }, index) => {
  let games = LocalStorage.getItem("games") || [];
  games.unshift(games.splice(index, 1)[0]);
  LocalStorage.set("games", games);
  commit("SELECT_GAME", index);
};

export const OPEN_FILE = ({ dispatch }, file) => {
  if (file && /\.ptn$|\.txt$/i.test(file.name)) {
    var reader = new FileReader();
    reader.onload = event => {
      dispatch("ADD_GAME", {
        name: file.name.replace(/\.ptn$|\.txt$/, ""),
        ptn: event.target.result
      });
    };
    reader.readAsText(file);
  }
};