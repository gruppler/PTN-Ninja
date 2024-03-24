import { firebase, auth, db } from "../../boot/firebase.js";
import { Loading } from "quasar";
import { omit } from "lodash";

import Game from "../../Game";
import { toDate } from "../../Game/PTN/Tag";
import { call } from "../../utilities";
export { LISTEN_DOC, LISTEN_COLLECTION } from "../../utilities";

export const INIT = ({ commit, dispatch, state }) => {
  return new Promise((resolve, reject) => {
    if (state.initialized) {
      resolve();
    }
    auth.onAuthStateChanged((user) => {
      if (user) {
        commit("SET_USER", user);
        // dispatch("LISTEN_CURRENT_GAME");
        commit("INIT");
        resolve();
      } else {
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
  dispatch("UNLISTEN_CURRENT_GAME");
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

const gameConverter = {
  toFirestore(game) {
    game.config = omit(game.config, ["isOnline", "id", "player", "type"]);
    return game.json;
  },
  fromFirestore(snapshot, options) {
    const data = snapshot.data(options);
    data.config.isOnline = true;
    data.config.id = snapshot.id;
    data.config.collection = snapshot.ref.parent.id;
    data.config.player = data.config.players
      ? data.config.players.indexOf(auth.currentUser.uid) + 1
      : 0;
    if (data.tags.date) data.tags.date = toDate(data.tags.date);
    if (data.createdAt) data.createdAt = toDate(data.createdAt);
    if (data.updatedAt) data.updatedAt = toDate(data.updatedAt);
    return data;
  },
};

//  const analysisConverter = {
//   toFirestore(game) {
//     return game.json;
//   },
//   fromFirestore(snapshot, options) {
//     const data = snapshot.data(options);
//     return new Game(snapshot.id, data);
//   },
// };

//  const puzzleConverter = {
//   toFirestore(game) {
//     return game.json;
//   },
//   fromFirestore(snapshot, options) {
//     const data = snapshot.data(options);
//     return new Game(snapshot.id, data);
//   },
// };

export const CREATE_GAME = async ({ dispatch }, { game, config }) => {
  if (!game || !(game instanceof Game)) {
    throw new Error("Invalid game");
  }
  const state = game.JSONState;
  const tags = game.JSONTags;
  const response = await call("createGame", { config, state, tags });
  console.log(response);
  return response;
  // dispatch("LISTEN_CURRENT_GAME");
};

export const REMOVE_GAME = async ({ commit }, game) => {
  if (!game || !game.config || !game.config.id) {
    throw new Error("Invalid game");
  }
  const gameDoc = db
    .collection(game.config.isPrivate ? "gamesPrivate" : "gamesPublic")
    .doc(game.config.id);
  await gameDoc.delete();
  commit(
    game.config.isPrivate ? "REMOVE_PLAYER_GAME" : "REMOVE_PUBLIC_GAME",
    game.config.id
  );
};

export const JOIN_GAME = async ({ dispatch, getters, state }, game) => {
  // Join as player if still open
  const player = game.openPlayer;
  const playerName = getters.playerName(game.config.isPrivate);
  const gameDoc = db
    .collection(game.config.isPrivate ? "gamesPrivate" : "gamesPublic")
    .doc(game.config.id);
  Loading.show();
  // let gamesSnapshot = await gameDoc.get();
  // // Check that the player is still open
  // let gameData = gamesSnapshot.data();
  // if (gameData.config.players[player - 1]) {
  //   Loading.hide();
  //   throw new Error("Player position already filled");
  // }

  // // Update game config and tags
  // let config = {
  //   ...game.config,
  //   ...gameData.config,
  //   players: [...gameData.config.players],
  // };
  // config.players[player - 1] = state.user.uid;

  // let tags = { ["player" + player]: playerName, ...now() };
  // game.setTags(tags, false);
  // dispatch("SAVE_CONFIG", { game, config }, { root: true });
  // dispatch("SAVE_PTN", game.toString(), { root: true });
  // game.clearHistory();

  // let changes = {
  //   config: configToDB(config),
  //   tags: game.JSONTags,
  // };

  // // Update name
  // if (game.isDefaultName) {
  //   changes.name = game.generateName();
  //   game.name = changes.name;
  // }

  // await gameDoc.update(changes);
  Loading.hide();
};

export const LOAD_GAMES = async function ({ state }, { gameIDs, isPrivate }) {
  const collection = isPrivate ? "gamesPrivate" : "gamesPublic";
  const games = [];

  try {
    Loading.show();

    // Fetch games
    await Promise.all(
      gameIDs.map(async (id) => {
        const ref = db
          .collection(collection)
          .doc(id)
          .withConverter(gameConverter);
        const game = (await ref.get()).data();

        if (!game) {
          throw new Error(`Failed to get game ${collection}/${id}`);
        }

        games.push(game);
        console.log(game);

        // Load moves
        // let moveDocs = await gameDoc.collection("branches").get();
        // gameJSON.moves = [];
        // moveDocs.forEach((move) => (gameJSON.moves[move.id] = move.data()));
      })
    );

    // Add games
    // this.dispatch("game/ADD_GAMES", games);

    Loading.hide();
    return games;
  } catch (error) {
    Loading.hide();
    throw error;
  }
};

export const LISTEN_PUBLIC_GAMES = async function (
  { dispatch },
  { listenerPath, where, limit, pagination, next, error, unlisten }
) {
  const converter = gameConverter;
  const path = "gamesPublic";
  const stateKey = "gamesPublic";
  await dispatch("UNLISTEN", path);
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
    unlisten,
  });
};

export const LISTEN_PRIVATE_GAMES = async function (
  { dispatch },
  { listenerPath, where, limit, pagination, next, error, unlisten }
) {
  const converter = gameConverter;
  const path = "gamesPrivate";
  const stateKey = "gamesPrivate";
  await dispatch("UNLISTEN", path);
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
    unlisten,
  });
};

// export const LISTEN_ANALYSES = async ({ dispatch }) => {
//   const converter = analysisConverter;
//   const path = "analyses";
//   const stateKey = "analyses";
//   await dispatch("UNLISTEN", path);
//   return dispatch("LISTEN_COLLECTION", {
//     converter,
//     path,
//     stateKey,
//     listenerPath,
//     where,
//     limit,
//     pagination,
//     next,
//     error,
//     unlisten,
//   });
// };

// export const LISTEN_PUZZLES = async ({ dispatch }) => {
//   const converter = puzzleConverter;
//   const path = "puzzles";
//   const stateKey = "puzzles";
//   await dispatch("UNLISTEN", path);
//   return dispatch("LISTEN_COLLECTION", {
//     converter,
//     path,
//     stateKey,
//     listenerPath,
//     where,
//     limit,
//     pagination,
//     next,
//     error,
//     unlisten,
//   });
// };

export const UNLISTEN = ({ commit, state }, path) => {
  if (state.listeners[path]) {
    state.listeners[path].unsubscribe();
    commit("UNLISTEN", path);
  }
};
