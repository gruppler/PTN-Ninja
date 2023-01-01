import Vue from "vue";
import { isEmpty, pick } from "lodash";
export { SET, REMOVE, LISTEN, UNLISTEN } from "../../utilities";

export const INIT = (state) => {
  state.initialized = true;
};

export const SET_USER = (state, user) => {
  if (!user || isEmpty(user)) {
    state.user = null;
    return;
  }
  state.user = Object.freeze(
    pick(user, ["uid", "email", "emailVerified", "displayName", "isAnonymous"])
  );
  state.playerGames = {};
  state.gamesPrivate = {};
};

export const SET_PLAYER_GAME = (state, game) => {
  Vue.set(state.playerGames, game.config.id, game);
  if (game.config.isPrivate) {
    Vue.set(state.gamesPrivate, game.config.id, game);
  }
};

export const REMOVE_PLAYER_GAME = (state, id) => {
  Vue.delete(state.playerGames, id);
  Vue.delete(state.gamesPrivate, id);
};

export const SET_PUBLIC_GAME = (state, game) => {
  Vue.set(state.gamesPublic, game.config.id, game);
};

export const REMOVE_PUBLIC_GAME = (state, id) => {
  Vue.delete(state.gamesPublic, id);
};
