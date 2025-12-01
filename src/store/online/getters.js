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
  const config = rootState.game.config;
  if (!config || !config.players) {
    return false;
  }

  const userUid = state.user && state.user.uid;
  return config.players.includes(userUid);
};

export const isMyTurn = (state, getters, rootState, rootGetters) => {
  const config = rootState.game.config;
  const gameState = rootState.game.position;
  if (!config || !config.players) {
    return false;
  }

  const playerIndex = config.players.indexOf(state.user && state.user.uid);
  if (playerIndex === -1) {
    return false; // Not a player
  }

  const playerNumber = playerIndex + 1;

  // Use TPS from position to determine current turn
  if (gameState && gameState.tps) {
    const tpsMatch = gameState.tps.match(/(\d+)\s+(\d+)\s+(\d+)$/);
    if (tpsMatch) {
      return parseInt(tpsMatch[2]) === playerNumber;
    }
  }

  return false;
};
