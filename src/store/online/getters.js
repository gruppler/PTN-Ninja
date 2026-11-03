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

// Whether the local game is the online game the store follows
const isCurrentGame = (state, rootState) => {
  const config = rootState.game.config;
  return Boolean(
    config &&
      config.isOnline &&
      state.currentGame &&
      config.id === state.currentGame.id
  );
};

const plyList = (plies) =>
  Array.isArray(plies) ? plies.filter((ply) => ply && ply.text !== "--") : [];

// IDs of the local main-line plies that are on the server, in order
export const syncedPlyIDs = (state, getters, rootState) => {
  const config = rootState.game.config;
  if (!config || !config.isOnline) {
    return [];
  }
  // The plies the local game has synced; normally the server's count
  let count = Math.min(
    getters.syncedPlyCount,
    Math.max(0, parseInt(config.syncedMainline, 10) || 0)
  );
  const ids = [];
  const plies = rootState.game.ptn.allPlies;
  if (!Array.isArray(plies)) {
    return ids;
  }
  for (let i = 0; i < plies.length && count; i++) {
    const ply = plies[i];
    if (!ply || ply.branch) {
      continue;
    }
    ids.push(ply.id);
    if (ply.text !== "--") {
      count--;
    }
  }
  return Object.freeze(ids);
};

// Whether a local ply is on the server
export const isSyncedPly = (state, getters) => {
  const ids = new Set(getters.syncedPlyIDs);
  return (plyID) => ids.has(plyID);
};

// The first ply past the server's main line on the current line, if it's
// mine to send
export const unsentPly = (state, getters, rootState) => {
  if (!isCurrentGame(state, rootState) || !getters.mySeat) {
    return null;
  }
  const synced = getters.syncedPlyCount;
  const localSynced =
    Math.max(0, parseInt(rootState.game.config.syncedMainline, 10)) || 0;
  if (localSynced !== synced) {
    // The local game hasn't caught up with the server
    return null;
  }
  const line = plyList(rootState.game.ptn.branchPlies);
  if (line.length <= synced || (synced && line[synced - 1].branch)) {
    return null;
  }
  const ply = line[synced];
  return ply.player === getters.mySeat ? ply : null;
};

// The last ply of the current line, if it isn't on the server
export const lastUnsentPly = (state, getters, rootState) => {
  if (!isCurrentGame(state, rootState)) {
    return null;
  }
  const line = plyList(rootState.game.ptn.branchPlies);
  const ply = line[line.length - 1];
  return ply && !getters.isSyncedPly(ply.id) ? ply : null;
};

// Whether the board shows the end of the server's main line
export const isAtSyncedFrontier = (state, getters, rootState) => {
  const position = rootState.game.position;
  const ids = getters.syncedPlyIDs;
  const lastID = ids.length ? ids[ids.length - 1] : null;
  const prevID = position.prevPly ? position.prevPly.id : null;
  if (lastID === null) {
    return !position.ply || (!position.plyIsDone && prevID === null);
  }
  return position.plyIsDone
    ? position.plyID === lastID
    : prevID === lastID && !!position.ply;
};

// Whether the board refuses input: without a scratchboard, a player may
// only play their next move, and nothing further until it's sent
export const blocksInput = (state, getters, rootState) => {
  if (
    !isCurrentGame(state, rootState) ||
    !getters.mySeat ||
    getters.hasEnded ||
    rootState.game.config.scratchboard
  ) {
    return false;
  }
  return (
    !!getters.unsentPly || !getters.isMyTurn || !getters.isAtSyncedFrontier
  );
};

export const sendStatus = (state) => (plyIndex) =>
  state.sendStatus[plyIndex] || null;
