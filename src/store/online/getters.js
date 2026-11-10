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

// The server's result of the current game once it has ended
export const result = (state, getters) =>
  (getters.hasEnded && getters.currentState.result) || "";

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

// Whether both seats of the current game are taken
export const hasOpponent = (state) => {
  const game = state.currentGame && state.currentGame.game;
  const players = (game && game.config && game.config.players) || [];
  return players.length === 2 && players.every(Boolean);
};

//#region Draw offers and takeback requests

// The pending draw offer or takeback request ({ type, player, plyIndex,
// createdAt }), mirrored from the server's state.request
export const pendingRequest = (state, getters) =>
  (!getters.hasEnded && getters.currentState && getters.currentState.request) ||
  null;

// The pending request, if I made it
export const myRequest = (state, getters) => {
  const request = getters.pendingRequest;
  return request && getters.mySeat && request.player === getters.mySeat
    ? request
    : null;
};

// The pending request, if it's mine to answer
export const opponentRequest = (state, getters) => {
  const request = getters.pendingRequest;
  return request && getters.mySeat && request.player !== getters.mySeat
    ? request
    : null;
};

// Whether I can make a request: a player in a game that's under way, with
// none pending
export const canRequest = (state, getters) =>
  Boolean(
    getters.mySeat &&
      getters.hasOpponent &&
      !getters.hasEnded &&
      !getters.pendingRequest
  );

// How many plies a takeback of mine would remove: my last move on the
// server's main line, and the opponent's reply if there is one. Zero if I
// have no move there.
export const takebackCount = (state, getters) => {
  if (!getters.mySeat || !getters.currentState || getters.hasEnded) {
    return 0;
  }
  const count = getters.isMyTurn ? 2 : 1;
  return getters.syncedPlyCount >= count ? count : 0;
};

export const canRequestTakeback = (state, getters) =>
  Boolean(getters.canRequest && getters.takebackCount);

//#endregion

// Whether the local game is the online game the store follows
const isCurrentOnlineGame = (state, rootState) => {
  const config = rootState.game.config;
  return Boolean(
    config &&
      config.isOnline &&
      state.currentGame &&
      config.id === state.currentGame.id
  );
};

export const isCurrentGame = (state, getters, rootState) =>
  isCurrentOnlineGame(state, rootState);

const plyList = (plies) =>
  Array.isArray(plies) ? plies.filter((ply) => ply && ply.text !== "--") : [];

// IDs of the local main-line plies that are on the server, in order
export const syncedPlyIDs = (state, getters, rootState) => {
  const config = rootState.game.config;
  if (!isCurrentOnlineGame(state, rootState)) {
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
  if (!isCurrentOnlineGame(state, rootState) || !getters.mySeat) {
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
  if (!isCurrentOnlineGame(state, rootState)) {
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

// Whether the board refuses input: at the end of an ended game's main line;
// otherwise, without a scratchboard, a player may
// only play their next move, and nothing further until it's sent
export const blocksInput = (state, getters, rootState) => {
  if (!isCurrentOnlineGame(state, rootState)) {
    return false;
  }
  // Once the game has ended its main line is final, but analysis is open
  // everywhere else
  if (getters.hasEnded) {
    return getters.isAtSyncedFrontier;
  }
  if (!getters.mySeat || rootState.game.config.scratchboard) {
    return false;
  }
  return (
    !!getters.unsentPly || !getters.isMyTurn || !getters.isAtSyncedFrontier
  );
};

// Send status of the move at a main-line ply index, if that move is still my
// next move: a status never carries over to a different move
export const sendStatus = (state, getters) => (plyIndex) => {
  const entry = state.sendStatus[plyIndex];
  const ply = getters.unsentPly;
  return entry &&
    ply &&
    plyIndex === getters.syncedPlyCount &&
    entry.plyID === ply.id &&
    entry.text === ply.text
    ? entry.status
    : null;
};

// My next move, if it's waiting to be sent: not one being sent
export const heldPly = (state, getters) =>
  getters.unsentPly &&
  getters.isMyTurn &&
  getters.sendStatus(getters.syncedPlyCount) !== "sending"
    ? getters.unsentPly
    : null;
