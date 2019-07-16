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
  games.unshift({ ...game, state: pick(game.state, GAME_STATE_PROPS) });
  LocalStorage.set("games", games);
  commit("ADD_GAME", game);
};

export const REMOVE_GAME = ({ commit }, index) => {
  let games = LocalStorage.getItem("games") || [];
  games.splice(index, 1);
  LocalStorage.set("games", games);
  commit("REMOVE_GAME", index);
};

export const UPDATE_GAMES = ({ state, commit }, games) => {
  LocalStorage.set(
    "games",
    state.games.map(game => ({
      ptn: game.text(),
      name: game.name,
      state: pick(game.state, GAME_STATE_PROPS)
    }))
  );
  commit("UPDATE_GAME", games);
};

export const UPDATE_PTN = ({ commit }, ptn) => {
  let games = LocalStorage.getItem("games") || [];
  games[0].ptn = ptn;
  LocalStorage.set("games", games);
  commit("UPDATE_PTN", ptn);
};

export const SET_NAME = ({ commit }, name) => {
  let games = LocalStorage.getItem("games");
  games[0].name = name;
  LocalStorage.set("games", games);
  commit("SET_NAME", name);
};

export const SET_STATE = ({ state, commit, dispatch }, gameState) => {
  if (!state.embed) {
    dispatch("SAVE_GAME_STATE", pick(gameState, GAME_STATE_PROPS));
  }
  commit("SET_STATE", gameState);
};

export const SAVE_GAME_STATE = (context, gameState) => {
  let games = LocalStorage.getItem("games");
  games[0].state = pick(gameState, GAME_STATE_PROPS);
  LocalStorage.set("games", games);
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
