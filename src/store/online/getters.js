import { LocalStorage } from "quasar";
import Vue from "vue";
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

export const player = (state) => {
  return state.user ? getPlayer(this, state.user.uid) : 0;
};

export const canEdit = (state) => (game) => {
  // TODO: Actually check permissions
  return !game.config.isOnline;
};

export const isPlayer = (state, getters, rootState, rootGetters) => {
  const currentGame = Vue.prototype.$game;
  if (!currentGame) {
    return false;
  }
  if (!currentGame.config) {
    return false;
  }
  if (!currentGame.config.players) {
    return false;
  }

  const userUid = state.user && state.user.uid;
  return currentGame.config.players.includes(userUid);
};

export const isMyTurn = (state, getters, rootState, rootGetters) => {
  const currentGame = Vue.prototype.$game;
  if (!currentGame || !currentGame.state) {
    return false;
  }

  const playerIndex = currentGame.config.players.indexOf(
    state.user && state.user.uid
  );
  if (playerIndex === -1) {
    return false; // Not a player
  }

  const playerNumber = playerIndex + 1;

  // Use TPS to determine current turn
  if (currentGame.state.tps) {
    const tpsMatch = currentGame.state.tps.match(/(\d+)\s+(\d+)\s+(\d+)$/);
    if (tpsMatch) {
      return parseInt(tpsMatch[2]) === playerNumber;
    }
  }

  return false;
};
