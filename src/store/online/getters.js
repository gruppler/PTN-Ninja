import { LocalStorage } from "quasar";
import Vue from "vue";
import { parseTPS } from "tps-ninja/src/Board.js";
import { getPlayer } from "../../Game/online";

export const playerName =
  (state) =>
  (isPrivate = false) => {
    let name = "";
    if (state.user && !state.user.isAnonymous) {
      name = state.user.displayName;
    }
    return isPrivate ? LocalStorage.getItem("playerName") || name : name;
  };

export const currentState = (state) =>
  (state.currentGame &&
    state.currentGame.game &&
    state.currentGame.game.state) ||
  null;

export const hasEnded = (state, getters) =>
  !!(getters.currentState && getters.currentState.hasEnded);

export const mySeat = (state) => {
  const game = state.currentGame && state.currentGame.game;
  return state.user ? getPlayer(game, state.user.uid) : 0;
};

export const player = (state, getters) => getters.mySeat;

export const syncedPlyCount = (state) => {
  const root = state.currentGame && state.currentGame.root;
  return root && root.plies ? root.plies.length : 0;
};

export const canEdit = (state) => (game) => {
  // TODO: Actually check permissions
  return !game.config.isOnline;
};

export const isPlayer = (state, getters, rootState, rootGetters) => {
  const config = rootState.game.config;
  if (!config || !config.players) {
    return false;
  }

  const userUid = state.user && state.user.uid;
  return config.players.includes(userUid);
};

export const isMyTurn = (state, getters) => {
  if (!getters.currentState || !getters.mySeat || getters.hasEnded) {
    return false;
  }
  const tps = getters.currentState.tps;
  return !!tps && parseTPS(tps).player === getters.mySeat;
};
