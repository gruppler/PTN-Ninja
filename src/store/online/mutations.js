import Vue from "vue";
import { isEmpty, pick } from "lodash";

export const INIT = state => {
  state.initialized = true;
};

export const SET_USER = (state, user) => {
  if (!user || isEmpty(user)) {
    state.user = null;
    return;
  }
  state.user = pick(user, [
    "uid",
    "email",
    "emailVerified",
    "displayName",
    "isAnonymous"
  ]);
  state.playerGames = {};
  state.privateGames = {};
};

export const LISTEN_ACTIVE_GAMES = (state, unsubscribe) => {
  state.activeGamesListener = unsubscribe;
};

export const UNLISTEN_ACTIVE_GAMES = state => {
  state.activeGamesListener = null;
};

export const SET_ACTIVE_GAME = (state, game) => {
  Vue.set(state.activeGames, game.config.id, game);
};

export const REMOVE_ACTIVE_GAME = (state, id) => {
  Vue.delete(state.activeGames, id);
};

export const LISTEN_PLAYER_GAMES = (state, unsubscribe) => {
  state.playerGamesListener = unsubscribe;
};

export const UNLISTEN_PLAYER_GAMES = state => {
  state.playerGamesListener = null;
};

export const SET_PLAYER_GAME = (state, game) => {
  Vue.set(state.playerGames, game.config.id, game);
  if (game.config.isPrivate) {
    Vue.set(state.privateGames, game.config.id, game);
  }
};

export const REMOVE_PLAYER_GAME = (state, id) => {
  Vue.delete(state.playerGames, id);
  Vue.delete(state.privateGames, id);
};

export const SET_PUBLIC_GAME = (state, game) => {
  Vue.set(state.publicGames, game.config.id, game);
};

export const REMOVE_PUBLIC_GAME = (state, id) => {
  Vue.delete(state.publicGames, id);
};

export const LISTEN_PUBLIC_GAMES = (state, unsubscribe) => {
  state.publicGamesListener = unsubscribe;
};

export const UNLISTEN_PUBLIC_GAMES = state => {
  state.publicGamesListener = null;
};
