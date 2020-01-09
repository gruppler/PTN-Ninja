import { isEmpty, pick } from "lodash";

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
    "isAnonymous",
    "publicGames",
    "privateGames"
  ]);
  state.user.games = state.user.privateGames.concat(state.user.publicGames);
};

export const LOAD_GAMES = (state, games) => {
  state.games = games;
};

export const LISTEN_GAMES = (state, unsubscribe) => {
  state.gamesListener = unsubscribe;
};

export const UNLISTEN_GAMES = state => {
  if (state.gamesListener) {
    state.gamesListener();
    state.gamesListener = null;
  }
};
