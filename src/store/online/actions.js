import { firebase, auth, db } from "../../boot/firebase.js";
import { Loading } from "quasar";
import Game from "../../Game";
import { generateName, isDefaultName } from "../../Game/base";
import { cloneDeep, isEqual, omit, pick } from "lodash";
import {
  call,
  notifyError,
  notifyHint,
  gameConverter,
  branchConverter,
  commentConverter,
} from "../../utilities";
export { LISTEN_DOC, LISTEN_COLLECTION } from "../../utilities";

// One init promise per store instance (`this` in an action is the store)
const initPromises = new WeakMap();

export const INIT = function ({ commit, dispatch, rootState }) {
  if (initPromises.has(this)) {
    return initPromises.get(this);
  }
  let unsubscribe = null;
  const promise = new Promise((resolve, reject) => {
    unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        commit("SET_USER", user);
        // Update player status for all online games
        commit("game/UPDATE_ONLINE_PLAYERS", user.uid, { root: true });
        const config = rootState.game && rootState.game.config;
        if (config && config.isOnline && config.id) {
          dispatch("LISTEN_GAME", {
            id: config.id,
            isPrivate:
              "isPrivate" in config
                ? config.isPrivate
                : config.collection === "gamesPrivate",
          });
        }
        commit("INIT");
        resolve();
      } else {
        // Update player status for all online games (no user = spectator)
        commit("game/UPDATE_ONLINE_PLAYERS", null, { root: true });
        dispatch("ANONYMOUS")
          .then(() => {
            commit("INIT");
            resolve();
          })
          .catch(reject);
      }
    });
  });
  initPromises.set(this, promise);
  // On failure, drop the listener and the cache so the next INIT retries
  promise.catch(() => {
    if (typeof unsubscribe === "function") unsubscribe();
    if (initPromises.get(this) === promise) initPromises.delete(this);
  });
  return promise;
};

export const ANONYMOUS = async ({ commit }) => {
  await auth.signInAnonymously();
  return commit("SET_USER", auth.currentUser);
};

export const USER_EXISTS = async (context, name) => {
  let nameSnapshot = await db
    .collection("names")
    .doc(name.trim().toLowerCase())
    .get();
  return nameSnapshot.exists;
};

export const REGISTER = async (context, { email, password, name }) => {
  // Check name uniqueness
  const nameDoc = db.collection("names").doc(name.trim().toLowerCase());
  let nameSnapshot = await nameDoc.get();
  if (nameSnapshot.exists) {
    throw new Error("Player exists");
  } else {
    // Create account
    const credential = firebase.auth.EmailAuthProvider.credential(
      email,
      password
    );
    let { user } = await auth.currentUser.linkWithCredential(credential);
    // Refresh the token so rules see the new (non-anonymous) provider
    await user.getIdToken(true);
    // Set name
    await nameDoc.set({ uid: user.uid });
    await user.updateProfile({
      displayName: name,
    });
  }
};

export const LOG_IN = async (context, { email, password }) => {
  let { user } = await auth.signInWithEmailAndPassword(email, password);
  return user;
};

export const LOG_OUT = async ({ dispatch }) => {
  await auth.signOut();
  return dispatch("ANONYMOUS");
};

export const UPDATE_ACCOUNT = async ({ commit }, { email, password }) => {
  if (email) {
    await auth.currentUser.updateEmail(email);
    commit("SET_USER", auth.currentUser);
  }
  if (password) {
    await auth.currentUser.updatePassword(password);
  }
};

export const RESET_PASSWORD = (context, email) => {
  return auth.sendPasswordResetEmail(email);
};

export const VERIFY = () => {
  return auth.currentUser.sendEmailVerification();
};

export const VERIFY_EMAIL = (context, oobCode) => {
  return auth.applyActionCode(oobCode);
};

export const VERIFY_PASSWORD_RESET_CODE = (context, oobCode) => {
  return auth.verifyPasswordResetCode(oobCode);
};

export const RECOVER_EMAIL = async ({ commit }, oobCode) => {
  const oldEmail = auth.currentUser.email;
  const email = (await auth.checkActionCode(oobCode)).data.email;
  if (email !== oldEmail) {
    await auth.currentUser.updateEmail(email);
    commit("SET_USER", auth.currentUser);
  }
  return email;
};

export const SET_PASSWORD = (context, { oobCode, password }) => {
  return auth.confirmPasswordReset(oobCode, password);
};

// GAMES

// Client config createGame accepts; the server derives the rest
const CREATE_CONFIG = [
  "isPrivate",
  "playerSeat",
  "opponentName",
  "scratchboard",
  "showRoads",
  "flatCounts",
  "stackCounts",
];
const NUMERIC_TAGS = [
  "size",
  "komi",
  "flats",
  "caps",
  "flats1",
  "caps1",
  "flats2",
  "caps2",
];

// Create an online game from the setup tags and a starting position (by
// default the empty board), then open it. Server refusals are thrown as they
// come, with the server's message.
export const CREATE_GAME = async function (
  { dispatch, state },
  { config = {}, tags = {}, tps }
) {
  const input = { config: pick(config, CREATE_CONFIG), tags: {} };
  input.config.isPrivate = !!input.config.isPrivate;
  if (typeof input.config.opponentName === "string") {
    input.config.opponentName = input.config.opponentName.trim();
  }
  if (!input.config.opponentName) {
    delete input.config.opponentName;
  }
  if (!state.user || state.user.isAnonymous) {
    // A guest's name is the one they type
    input.config.playerName = (config.playerName || "").trim();
  }
  Object.entries(tags).forEach(([key, value]) => {
    if (key === "tps" || value === null || value === undefined) {
      return;
    }
    if (typeof value === "string") {
      value = value.trim();
      if (!value) {
        return;
      }
      if (NUMERIC_TAGS.includes(key) && !isNaN(Number(value))) {
        value = Number(value);
      }
    }
    input.tags[key] = value;
  });
  input.tps = tps || tags.tps;
  if (!input.tps) {
    const size = Number(input.tags.size);
    if (!Number.isInteger(size) || size < 3 || size > 8) {
      throw new Error("Invalid size");
    }
    input.tps = emptyTPS(size);
  }

  const { id, isPrivate } = await call("createGame", input);
  // The creator must always get the new game, whatever else opens meanwhile
  await dispatch("OPEN_GAME", { id, isPrivate, force: true });
  return { id, isPrivate };
};

// Server refusals that sending again won't change; anything else (an outage,
// a timeout, a network error, a lapsed sign-in) is worth retrying
const REFUSALS = [
  "failed-precondition",
  "invalid-argument",
  "not-found",
  "permission-denied",
];

const isRefusal = (error) =>
  Boolean(
    error &&
      typeof error.code === "string" &&
      REFUSALS.includes(error.code.replace(/^functions\//, ""))
  );

// Send my next move: the first ply past the server's main line on the
// current line. It's "sending" until the server's main line reaches it. If
// the server refuses it, it's removed; if it can't be sent, it's "failed",
// to be retried.
export const SEND_PLY = async ({ commit, dispatch, getters, state }) => {
  const ply = getters.unsentPly;
  const current = state.currentGame;
  if (!ply || !current) {
    return;
  }
  const plyIndex = getters.syncedPlyCount;
  if (getters.sendStatus(plyIndex) === "sending") {
    return;
  }
  const sent = { plyIndex, plyID: ply.id, text: ply.text };
  commit("SET_SEND_STATUS", { ...sent, status: "sending" });
  try {
    await call("insertPly", {
      id: current.id,
      isPrivate: current.isPrivate,
      ply: ply.text,
      plyIndex,
    });
  } catch (error) {
    notifyError(error);
    const isSameGame = state.currentGame && state.currentGame.id === current.id;
    if (!isSameGame || getters.syncedPlyCount > plyIndex) {
      return;
    }
    const unsentPly = getters.unsentPly;
    const isSameMove = Boolean(
      unsentPly && unsentPly.id === sent.plyID && unsentPly.text === sent.text
    );
    if (isRefusal(error)) {
      commit("SET_SEND_STATUS", { plyIndex });
      if (isSameMove) {
        dispatch("game/DELETE_PLY", sent.plyID, { root: true });
      }
    } else {
      commit("SET_SEND_STATUS", { ...sent, status: "failed" });
    }
  }
};

// Auto-send the ply the player just completed, if it's their next move. Only
// a newly made ply counts: a previously unsent move (`previous`: the unsent
// ply before the player acted) stays held for Submit, even when the player
// changes its stone type.
export const SEND_COMPLETED_PLY = async (
  { dispatch, getters, rootState },
  previous
) => {
  const ply = getters.unsentPly;
  const position = rootState.game.position;
  if (
    rootState.ui.onlineSendMode === "submit" ||
    !ply ||
    !getters.isMyTurn ||
    (previous && previous.id === ply.id) ||
    position.plyID !== ply.id ||
    !position.plyIsDone
  ) {
    return;
  }
  const plyIndex = getters.syncedPlyCount;
  await dispatch("SEND_PLY");

  // A one-time tip after the first auto-sent move
  if (
    !rootState.ui.onlineAutoSendTipShown &&
    (getters.syncedPlyCount > plyIndex ||
      getters.sendStatus(plyIndex) === "sending")
  ) {
    dispatch("ui/SET_UI", ["onlineAutoSendTipShown", true], { root: true });
    notifyHint("autoSend", { timeout: 10e3 });
  }
};

export const RESIGN = async function (context) {
  const game = this.state.game;

  if (!game || !game.config || !game.config.id) {
    throw new Error("No active game");
  }

  if (game.config.hasEnded) {
    throw new Error("Game has already ended");
  }

  try {
    const response = await call("resign", {
      gameId: game.config.id,
      isPrivate: game.config.isPrivate,
    });
    return response;
  } catch (error) {
    console.error("Failed to resign:", error);
    throw error;
  }
};

export const REMOVE_GAME = async function ({ commit, dispatch }, game) {
  if (!game || !game.config || !game.config.id) {
    throw new Error("Invalid game");
  }

  try {
    // Delete the game document - cloud function will automatically delete subcollections
    const gameDoc = db
      .collection(game.config.isPrivate ? "gamesPrivate" : "gamesPublic")
      .doc(game.config.id);
    await gameDoc.delete();

    // Remove from local online store
    commit(
      game.config.isPrivate ? "REMOVE_PLAYER_GAME" : "REMOVE_PUBLIC_GAME",
      game.config.id
    );

    // Also close the game from the game selector if it's open
    await dispatch("game/CLOSE_GAME_BY_ID", game.config.id, { root: true });
  } catch (error) {
    console.error("Failed to delete game:", error);
    throw error;
  }
};

// Take the open seat. The game's listeners bring the change to the local
// game.
export const JOIN_GAME = async function (
  { state },
  { id, isPrivate, playerName }
) {
  const data = { id, isPrivate: !!isPrivate };
  if (!state.user || state.user.isAnonymous) {
    data.playerName = (playerName || "").trim();
  }
  return call("joinGame", data);
};

// Helper function to load a single game document
const loadGameDocument = async (id, isPrivate) => {
  const collection = isPrivate ? "gamesPrivate" : "gamesPublic";

  const ref = db.collection(collection).doc(id).withConverter(gameConverter);
  const gameDoc = await ref.get();
  const gameData = gameDoc.data();

  if (!gameData) {
    throw new Error(`Failed to get game ${collection}/${id}`);
  }

  return new Game(gameData);
};

export const LOAD_GAME = async function ({ state, commit }, { id, isPrivate }) {
  try {
    Loading.show();
    const game = await loadGameDocument(id, isPrivate);

    // Add the single game to the local game store
    this.dispatch("game/ADD_GAME", game);

    // Also add to the online store for the GameTable
    if (isPrivate) {
      commit("SET_PLAYER_GAME", game);
    } else {
      commit("SET_PUBLIC_GAME", game);
    }

    Loading.hide();
    return game;
  } catch (error) {
    Loading.hide();
    throw error;
  }
};

//#region Current game

const gamePath = (id, isPrivate) =>
  `${isPrivate ? "gamesPrivate" : "gamesPublic"}/${id}`;

const emptyTPS = (size) => `${Array(size).fill(`x${size}`).join("/")} 1 1`;

// The server keeps the starting position as tags.tps. For games created
// before it did, fall back to the current position (state.tps) if no ply has
// been played, else to the empty board.
const getStartingTPS = (game, root) => {
  const tags = game.tags || {};
  if (tags.tps) {
    return tags.tps;
  }
  const state = game.state || {};
  const plies = (root && root.plies) || [];
  if (state.tps && !plies.length && !state.plyIndex) {
    return state.tps;
  }
  return emptyTPS(Number(tags.size));
};

// Tags for a new local copy of the game
const getLocalTags = (game, root) => {
  const tags = {};
  Object.entries(game.tags || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      tags[key] = value;
    }
  });
  if (!tags.tps) {
    const tps = getStartingTPS(game, root);
    if (tps !== emptyTPS(Number(tags.size))) {
      tags.tps = tps;
    }
  }
  return tags;
};

// Server-owned config, mirrored onto the local game
const getRemoteConfig = (game, uid) => {
  const config = game.config || {};
  const players = config.players || [null, null];
  return {
    // Copied: the local game's config becomes reactive, and the snapshot gets
    // frozen as online/currentGame, so they mustn't share objects
    players: [...players],
    player: uid ? players.indexOf(uid) + 1 : 0,
    isOpen: !!config.isOpen,
    reservedFor: config.reservedFor || null,
    hasEnded: !!(game.state && game.state.hasEnded),
  };
};

// Server-owned tags, mirrored onto the local game
const MIRRORED_TAGS = ["player1", "player2", "result"];

const tagText = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return value.text || "";
  }
  return String(value);
};

// The local game's name: its players, size, result and creation time
const gameName = (game, root) =>
  generateName(
    {
      ...getLocalTags(game, root),
      result: (game.state && game.state.result) || "",
    },
    null,
    game.createdAt
  );

const loadDoc = async (path, converter) => {
  const snapshot = await db.doc(path).withConverter(converter).get();
  return snapshot.exists ? snapshot.data() : null;
};

// The latest OPEN_GAME per store (`this` in an action is the store)
const openTokens = new WeakMap();

// What identifies the current local game
const currentGameKey = (rootState) => {
  const config = rootState.game.config;
  return config && config.isOnline && config.id
    ? `online:${config.id}`
    : `local:${rootState.game.name}`;
};

// Load an online game and open it as the current local game, then follow
// the server's main line. Resolves whether the user can join it. A missing
// game, or one the user may not read, is "Game unavailable". If another game
// is opened or selected while it loads, it leaves the current game alone,
// unless `force` (a game the user just created) is set.
export const OPEN_GAME = async function (
  { dispatch, state, rootState },
  { id, isPrivate, force = false }
) {
  isPrivate = !!isPrivate;
  const token = {};
  openTokens.set(this, token);
  const startKey = currentGameKey(rootState);
  const path = gamePath(id, isPrivate);
  let game, root;
  try {
    [game, root] = await Promise.all([
      loadDoc(path, gameConverter),
      loadDoc(`${path}/branches/root`, branchConverter),
    ]);
  } catch (error) {
    if (error && error.code === "permission-denied") {
      throw new Error("Game unavailable");
    }
    throw error;
  }
  if (!game) {
    throw new Error("Game unavailable");
  }
  if (
    !force &&
    (openTokens.get(this) !== token || currentGameKey(rootState) !== startKey)
  ) {
    return { joinable: false };
  }

  const index = rootState.game.list.findIndex(
    (g) => g.config && g.config.isOnline && g.config.id === id
  );
  if (index < 0) {
    const tags = getLocalTags(game, root);
    const uid = state.user && state.user.uid;
    await dispatch(
      "game/ADD_GAME",
      {
        name: gameName(game, root),
        tags,
        config: {
          ...cloneDeep(game.config),
          ...getRemoteConfig(game, uid),
          isOnline: true,
          id,
          isPrivate,
          syncedMainline: 0,
        },
      },
      { root: true }
    );
  } else if (index > 0 || rootState.game.config.id !== id) {
    await dispatch(
      "game/SELECT_GAME",
      { index, immediate: true },
      { root: true }
    );
    await dispatch("game/SET_GAME", rootState.game.list[0], { root: true });
  }

  await dispatch("APPLY_REMOTE", { id, isPrivate, game, root });
  await dispatch("LISTEN_GAME", { id, isPrivate });

  const config = game.config || {};
  const user = state.user;
  const players = config.players || [];
  const joinable = Boolean(
    user &&
      !(game.state && game.state.hasEnded) &&
      !players.includes(user.uid) &&
      players.includes(null) &&
      (!config.reservedFor || config.reservedFor === user.uid) &&
      (isPrivate || !user.isAnonymous)
  );
  return { joinable };
};

// Follow an online game's doc and its main line (the root branch)
export const LISTEN_GAME = async function (
  { dispatch, state },
  { id, isPrivate }
) {
  isPrivate = !!isPrivate;
  const gameKey = `game:${id}`;
  const rootKey = `root:${id}`;
  if (state.listeners[gameKey] && state.listeners[rootKey]) {
    return;
  }
  const path = gamePath(id, isPrivate);
  const collection = isPrivate ? "gamesPrivate" : "gamesPublic";
  // Drop both listeners (e.g. permission denied) so a later LISTEN_GAME can
  // start over
  const error = (reason) => {
    console.error(reason);
    dispatch("UNLISTEN_GAME", id);
  };
  await Promise.all([
    dispatch("LISTEN_DOC", {
      converter: gameConverter,
      path,
      stateKey: collection,
      listenerPath: gameKey,
      unlisten: true,
      next: (game) => game && dispatch("APPLY_REMOTE", { id, isPrivate, game }),
      error,
    }),
    dispatch("LISTEN_DOC", {
      converter: branchConverter,
      path: `${path}/branches/root`,
      stateKey: `${collection}_branches`,
      listenerPath: rootKey,
      unlisten: true,
      next: (root) => root && dispatch("APPLY_REMOTE", { id, isPrivate, root }),
      error,
    }),
  ]);
};

export const UNLISTEN_GAME = function ({ commit, dispatch, state }, id) {
  dispatch("UNLISTEN", `game:${id}`);
  dispatch("UNLISTEN", `root:${id}`);
  if (state.currentGame && state.currentGame.id === id) {
    commit("CLEAR_CURRENT_GAME");
  }
};

// Apply a snapshot of the game doc and/or its root branch: record it as the
// current game, mirror players, tags and result onto the local game, and
// append the server plies it hasn't synced yet.
export const APPLY_REMOTE = function (
  { commit, dispatch, state, rootState, rootGetters },
  { id, isPrivate, game, root }
) {
  const previous =
    state.currentGame && state.currentGame.id === id ? state.currentGame : null;
  game = game || (previous && previous.game) || null;
  root = root || (previous && previous.root) || null;
  commit("SET_CURRENT_GAME", { id, isPrivate: !!isPrivate, game, root });

  const config = rootState.game.config;
  if (!config || !config.isOnline || config.id !== id) {
    return;
  }

  let mirrored = false;
  if (game) {
    const uid = state.user && state.user.uid;
    const remoteConfig = getRemoteConfig(game, uid);
    if (!isEqual(remoteConfig, pick(config, Object.keys(remoteConfig)))) {
      commit("game/SET_CONFIG", { ...config, ...remoteConfig }, { root: true });
      mirrored = true;
    }

    const localTags = (rootState.game.ptn && rootState.game.ptn.tags) || {};
    const remoteTags = {
      ...(game.tags || {}),
      result: (game.state && game.state.result) || "",
    };
    const tags = {};
    MIRRORED_TAGS.forEach((key) => {
      if (tagText(remoteTags[key]) !== tagText(localTags[key])) {
        tags[key] = tagText(remoteTags[key]);
      }
    });
    if (Object.keys(tags).length) {
      commit("game/SET_REMOTE_TAGS", tags, { root: true });
      mirrored = true;
    }

    // A generated name follows the players and result
    const listed = rootState.game.list.find(
      (g) => g.config && g.config.id === id
    );
    if (listed && isDefaultName(listed.name)) {
      const name = rootGetters["game/uniqueName"](gameName(game, root), true);
      if (name !== listed.name) {
        commit("game/RENAME_CURRENT_GAME", name, { root: true });
        commit("game/SET_NAME", { id, newName: name }, { root: true });
        mirrored = true;
      }
    }
  }

  if (root && root.plies) {
    const syncedMainlineCount = Math.max(
      0,
      parseInt(rootState.game.config.syncedMainline, 10) || 0
    );
    const plies = root.plies.slice(syncedMainlineCount).map(({ ply }) => ply);
    if (plies.length) {
      try {
        // APPEND_PLIES advances config.syncedMainline to the server's count,
        // and saves
        appendServerPlies(dispatch, plies, syncedMainlineCount);
        return;
      } catch (error) {
        notifyError(error);
        resyncGame({ commit, dispatch, rootState }, game, root);
        return;
      }
    }
  }

  if (mirrored) {
    dispatch("game/SAVE_CURRENT_GAME", true, { root: true });
  }
};

// game/APPEND_PLIES commits synchronously, so a ply that fails to apply
// throws here
const appendServerPlies = (dispatch, plies, syncedMainlineCount) =>
  dispatch(
    "game/APPEND_PLIES",
    { plies, liveSync: { syncedMainlineCount } },
    { root: true }
  );

// Rebuild the local game from the server's snapshot after a ply failed to
// apply. Plies the user added locally are lost.
const resyncGame = ({ commit, dispatch, rootState }, game, root) => {
  if (!game) {
    return;
  }
  commit(
    "game/SET_GAME",
    {
      name: rootState.game.name,
      tags: getLocalTags(game, root),
      config: {
        ...omit(rootState.game.config, ["firstMoveNumber", "firstPlayer"]),
        syncedMainline: 0,
      },
    },
    { root: true }
  );
  try {
    appendServerPlies(
      dispatch,
      root.plies.map(({ ply }) => ply),
      0
    );
  } catch (error) {
    notifyError(error);
  }
  dispatch("game/SAVE_CURRENT_GAME", true, { root: true });
};

//#endregion

// export const LISTEN_PLAYER_GAMES = async function (
//   { dispatch },
//   { next, error }
// ) {
//   const converter = gameConverter;
//   return dispatch("LISTEN_COLLECTION", {
//     converter,
//     path,
//     stateKey: "playerGames",
//     listenerPath: "current-game",
//     where,
//     limit,
//     pagination,
//     next,
//     error,
//     unlisten: true,
//   });
// };

export const LISTEN_PUBLIC_GAMES = async function (
  { dispatch },
  {
    listenerPath,
    where,
    limit,
    pagination,
    next,
    error,
    stateKey = "gamesPublic",
  }
) {
  const converter = gameConverter;
  const path = "gamesPublic";
  return dispatch("LISTEN_COLLECTION", {
    converter,
    path,
    stateKey,
    listenerPath,
    where,
    limit,
    pagination,
    next,
    error,
    unlisten: true,
  });
};

export const LISTEN_PRIVATE_GAMES = async function (
  { dispatch },
  {
    listenerPath,
    where,
    limit,
    pagination,
    next,
    error,
    stateKey = "gamesPrivate",
  }
) {
  const converter = gameConverter;
  const path = "gamesPrivate";
  return dispatch("LISTEN_COLLECTION", {
    converter,
    path,
    stateKey,
    listenerPath,
    where,
    limit,
    pagination,
    next,
    error,
    unlisten: true,
  });
};

// Every game the user is seated in, across both collections. Each query is
// served by the (config.players CONTAINS, updatedAt DESC) index of its
// collection. Returns the listener paths for UNLISTEN.
export const LISTEN_MY_GAMES = async function (
  { dispatch, state },
  { next, error } = {}
) {
  const user = state.user;
  if (!user) {
    return [];
  }
  const where = ["config.players", "array-contains", user.uid];
  const pagination = { sortBy: "updatedAt", descending: true };
  return Promise.all([
    dispatch("LISTEN_PUBLIC_GAMES", {
      listenerPath: "myGames/public",
      stateKey: "gamesMinePublic",
      where,
      pagination,
      next: () => next && next("public"),
      error,
    }),
    dispatch("LISTEN_PRIVATE_GAMES", {
      listenerPath: "myGames/private",
      stateKey: "gamesMinePrivate",
      where,
      pagination,
      next: () => next && next("private"),
      error,
    }),
  ]);
};

export const UNLISTEN = ({ commit, state }, path) => {
  if (state.listeners[path]) {
    state.listeners[path].unsubscribe();
    commit("UNLISTEN", path);
  }
};
