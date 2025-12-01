import { firebase, auth, db } from "../../boot/firebase.js";
import { Loading } from "quasar";
import Game from "../../Game";
import {
  call,
  gameConverter,
  branchConverter,
  analysisConverter,
  puzzleConverter,
  commentConverter,
} from "../../utilities";
export { LISTEN_DOC, LISTEN_COLLECTION } from "../../utilities";

export const INIT = ({ commit, dispatch, state }) => {
  return new Promise((resolve, reject) => {
    if (state.initialized) {
      resolve();
    }
    auth.onAuthStateChanged((user) => {
      if (user) {
        commit("SET_USER", user);
        // Update player status for all online games
        commit("game/UPDATE_ONLINE_PLAYERS", user.uid, { root: true });
        dispatch("LISTEN_CURRENT_GAME");
        commit("INIT");
        resolve();
      } else {
        // Update player status for all online games (no user = spectator)
        commit("game/UPDATE_ONLINE_PLAYERS", null, { root: true });
        // commit("UNLISTEN_CURRENT_GAME");
        dispatch("ANONYMOUS")
          .then(() => {
            commit("INIT");
            resolve();
          })
          .catch(reject);
      }
    });
  });
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
    // Set name
    nameDoc.set({ uid: user.uid });
    user.updateProfile({
      displayName: name,
    });
  }
};

export const LOG_IN = async (context, { email, password }) => {
  let { user } = await auth.signInWithEmailAndPassword(email, password);
  return user;
};

export const LOG_OUT = async ({ dispatch }) => {
  // dispatch("UNLISTEN_CURRENT_GAME");
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

export const CREATE_GAME = async (context, { game, config }) => {
  if (!game || !(game instanceof Game)) {
    throw new Error("Invalid game");
  }
  const state = game.JSONState;
  const tags = game.JSONTags;

  try {
    // Clean up any existing online game listener before creating a new one
    await context.dispatch("UNLISTEN_CURRENT_GAME");

    const gameId = await call("createGame", { config, state, tags });

    // Load the created game
    const createdGame = await context.dispatch("LOAD_GAME", {
      id: gameId,
      isPrivate: config.isPrivate,
    });

    // Set up real-time listeners for the game
    await context.dispatch("LISTEN_CURRENT_GAME");

    return gameId;
  } catch (error) {
    console.error("CREATE_GAME error:", error);
    throw new Error("Failed to create game");
  }
};

export const INSERT_PLY = async (context, { gameId, ply, isPrivate }) => {
  try {
    const response = await call("insertPly", { gameId, ply, isPrivate });
    return response;
  } catch (error) {
    console.error(error);
    throw new Error("Failed to make move");
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

export const JOIN_GAME = async function (context, game) {
  if (!game || !game.config || !game.config.id) {
    throw new Error("Invalid game");
  }

  try {
    Loading.show();

    // Call cloud function to join the game
    await call("joinGame", {
      id: game.config.id,
      isPrivate: game.config.isPrivate,
    });

    // Load the game after successfully joining
    const loadedGame = await context.dispatch("LOAD_GAME", {
      id: game.config.id,
      isPrivate: game.config.isPrivate,
    });

    // Set up real-time listeners for the game
    await context.dispatch("LISTEN_CURRENT_GAME");

    return loadedGame;
  } catch (error) {
    console.error("Failed to join game:", error);
    throw error;
  } finally {
    Loading.hide();
  }
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

export const LOAD_GAMES = async function ({ state }, { gameIDs, isPrivate }) {
  const games = [];

  try {
    Loading.show();

    // Fetch games
    await Promise.all(
      gameIDs.map(async (id) => {
        const game = await loadGameDocument(id, isPrivate);
        games.push(game);
      })
    );

    // Add games
    this.dispatch("game/ADD_GAMES", { games });

    Loading.hide();
    return games;
  } catch (error) {
    Loading.hide();
    throw error;
  }
};

export const LISTEN_CURRENT_GAME = async function ({ dispatch, state }) {
  const listeners = [];
  const game = this.state.game;

  if (!game || !game.config.isOnline) {
    return dispatch("UNLISTEN_CURRENT_GAME");
  }

  const path = `${game.config.path}/branches`;
  const stateKey = `${game.config.collection}_branches`;

  // Root branch - contains the main game moves
  listeners.push(
    await dispatch("LISTEN_DOC", {
      converter: branchConverter,
      path: `${path}/root`,
      stateKey,
      listenerPath: "current-root",
      unlisten: true,
    })
  );

  // Player-specific branches (for analyses and variations)
  // Only load branches created by the current user
  if (state.user && state.user.uid) {
    listeners.push(
      await dispatch("LISTEN_COLLECTION", {
        converter: branchConverter,
        path,
        stateKey,
        listenerPath: "current-branches",
        where: ["uid", "==", state.user.uid],
        unlisten: true,
      })
    );
  }

  return listeners;
};

export const UNLISTEN_CURRENT_GAME = ({ dispatch }) => {
  return Promise.all([
    dispatch("UNLISTEN", "current-root"),
    dispatch("UNLISTEN", "current-branches"),
  ]);
};

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
  { listenerPath, where, limit, pagination, next, error }
) {
  const converter = gameConverter;
  const path = "gamesPublic";
  const stateKey = "gamesPublic";
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
  { listenerPath, where, limit, pagination, next, error }
) {
  const converter = gameConverter;
  const path = "gamesPrivate";
  const stateKey = "gamesPrivate";
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

export const LISTEN_ANALYSES = async (
  { dispatch },
  { listenerPath, where, limit, pagination, next, error }
) => {
  const converter = analysisConverter;
  const path = "analyses";
  const stateKey = "analyses";
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

export const LISTEN_PUZZLES = async (
  { dispatch },
  { listenerPath, where, limit, pagination, next, error }
) => {
  const converter = puzzleConverter;
  const path = "puzzles";
  const stateKey = "puzzles";
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

export const UNLISTEN = ({ commit, state }, path) => {
  if (state.listeners[path]) {
    state.listeners[path].unsubscribe();
    commit("UNLISTEN", path);
  }
};
