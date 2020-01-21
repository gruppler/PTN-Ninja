import { isEmpty, omit, pick } from "lodash";

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

export const LISTEN_PLAYER_GAMES = (state, unsubscribe) => {
  state.playerGamesListener = unsubscribe;
};

export const UNLISTEN_PLAYER_GAMES = state => {
  state.playerGamesListener = null;
};

export const SET_PLAYER_GAME = (state, game) => {
  state.playerGames = { ...state.playerGames, [game.config.id]: game };
  if (game.config.isPrivate) {
    state.privateGames = {
      ...state.privateGames,
      [game.config.id]: game
    };
  }
};

export const REMOVE_PLAYER_GAME = (state, id) => {
  state.playerGames = omit(state.playerGames, id);
  state.privateGames = omit(state.privateGames, id);
};

export const SET_PUBLIC_GAME = (state, game) => {
  state.publicGames = { ...state.publicGames, [game.config.id]: game };
};

export const REMOVE_PUBLIC_GAME = (state, id) => {
  state.publicGames = omit(state.publicGames, id);
};

export const LISTEN_PUBLIC_GAMES = (state, unsubscribe) => {
  state.publicGamesListener = unsubscribe;
};

export const UNLISTEN_PUBLIC_GAMES = state => {
  state.publicGamesListener = null;
};
