import Vue from "vue";
import { isEmpty, pick } from "lodash";
import { deepFreeze } from "../../utilities";
export { SET, REMOVE, LISTEN, UNLISTEN } from "../../utilities";

export const INIT = (state) => {
  state.initialized = true;
};

export const SET_CURRENT_GAME = (state, payload) => {
  const previousID = state.currentGame && state.currentGame.id;
  state.currentGame = payload ? deepFreeze(payload) : null;

  // Forget the send status of another game's moves, and of moves the
  // server's main line has reached
  if (!payload || payload.id !== previousID) {
    state.sendStatus = {};
    return;
  }
  const synced =
    payload.root && payload.root.plies ? payload.root.plies.length : 0;
  Object.keys(state.sendStatus).forEach((plyIndex) => {
    if (Number(plyIndex) < synced) {
      Vue.delete(state.sendStatus, plyIndex);
    }
  });
};

export const CLEAR_CURRENT_GAME = (state) => {
  state.currentGame = null;
  state.sendStatus = {};
};

// The status of sending a move ({ plyID, text }) at a main-line ply index
export const SET_SEND_STATUS = (state, { plyIndex, plyID, text, status }) => {
  if (status) {
    Vue.set(state.sendStatus, plyIndex, Object.freeze({ plyID, text, status }));
  } else {
    Vue.delete(state.sendStatus, plyIndex);
  }
};

export const SET_USER = (state, user) => {
  if (!user || isEmpty(user)) {
    state.user = null;
    state.gamesMinePublic = {};
    state.gamesMinePrivate = {};
    return;
  }
  state.user = Object.freeze(
    pick(user, ["uid", "email", "emailVerified", "displayName", "isAnonymous"])
  );
  state.playerGames = {};
  state.gamesPrivate = {};
  state.gamesMinePublic = {};
  state.gamesMinePrivate = {};
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
  Vue.delete(state.playerGames, id);
  Vue.delete(state.gamesPublic, id);
};

// Empty a list's bucket, e.g. before its listener is recreated: a new
// snapshot never reports docs that left the query while it was unlistened
export const CLEAR_LIST = (state, stateKey) => {
  state[stateKey] = {};
};
