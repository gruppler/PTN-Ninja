import { firebase, auth, db } from "../../boot/firebase.js";
import { Loading } from "quasar";

import { compact, isArray, isEqual, isEqualWith, omit } from "lodash";

import Game from "../../PTN/Game";
import { toDate, now } from "../../PTN/Tag";

const configToDB = (config) => omit(config, ["id", "player", "unseen"]);

const snapshotToGameJSON = (doc) => {
  let game = doc.data();
  game.config.id = doc.id;
  game.config.player = game.config.players
    ? game.config.players.indexOf(auth.currentUser.uid) + 1
    : 0;
  game.tags.date = toDate(game.tags.date);
  return game;
};

export const INIT = ({ commit, dispatch, state }) => {
  return new Promise((resolve, reject) => {
    if (state.initialized) {
      resolve();
    }
    auth.onAuthStateChanged((user) => {
      if (user) {
        commit("SET_USER", user);
        dispatch("LISTEN_CURRENT_GAME");
        commit("INIT");
        resolve();
      } else {
        commit("UNLISTEN_CURRENT_GAME");
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

export const ANONYMOUS = () => {
  return auth.signInAnonymously();
};

export const CHECK_USERNAME = async (context, name) => {
  let nameSnapshot = await db.collection("names").doc(name.toLowerCase()).get();
  return !nameSnapshot.exists;
};

export const REGISTER = async (context, { email, password, name }) => {
  // Check name uniqueness
  const nameDoc = db.collection("names").doc(name.toLowerCase());
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
  dispatch("ANONYMOUS");
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

export const RELOAD_USER = async ({ commit }) => {
  await auth.currentUser.reload();
  commit("SET_USER", auth.currentUser);
};

export const CREATE_GAME = async (
  { dispatch, getters, state },
  { game, players, isPrivate, disableRoads }
) => {
  const playerName = getters.playerName(isPrivate);
  const player = players[1] === state.user.uid ? 1 : 2;
  let tags = {
    player1: "",
    player2: "",
    rating1: "",
    rating2: "",
    ...now(),
  };
  tags["player" + player] = playerName;
  game.setTags(tags, false);
  game.clearHistory();
  dispatch("SAVE_PTN", game.text(), { root: true });

  if (game.isDefaultName) {
    game.name = game.generateName();
  }

  let json = game.json;
  let config = Object.assign(json.config, {
    isOnline: true,
    players: [players[1] || null, players[2] || null],
    isPrivate,
    disableRoads,
  });

  // Add game to DB
  let gameDoc = await db.collection("games").add(omit(json, "moves"));
  config.id = gameDoc.id;
  dispatch("SAVE_CONFIG", { game, config }, { root: true });

  // Add moves to game in DB
  if (json.moves.length) {
    let batch = db.batch();
    const moves = gameDoc.collection("moves");
    json.moves.forEach((move, i) => batch.set(moves.doc("" + i), move));
    await batch.commit();
  }

  dispatch("LISTEN_CURRENT_GAME");
};

export const JOIN_GAME = async ({ dispatch, getters, state }, game) => {
  // Join as player if still open
  const player = game.openPlayer;
  const playerName = getters.playerName(game.config.isPrivate);
  const gameDoc = db.collection("games").doc(game.config.id);
  Loading.show();
  let gamesSnapshot = await gameDoc.get();
  // Check that the player is still open
  let gameData = gamesSnapshot.data();
  if (gameData.config.players[player - 1]) {
    Loading.hide();
    throw new Error("Player position already filled");
  }

  // Update game config and tags
  let config = {
    ...game.config,
    ...gameData.config,
    players: [...gameData.config.players],
  };
  config.players[player - 1] = state.user.uid;

  let tags = { ["player" + player]: playerName, ...now() };
  game.setTags(tags, false);
  dispatch("SAVE_CONFIG", { game, config }, { root: true });
  dispatch("SAVE_PTN", game.text(), { root: true });
  game.clearHistory();

  let changes = {
    config: configToDB(config),
    tags: game.JSONTags,
  };

  // Update name
  if (game.isDefaultName) {
    changes.name = game.generateName();
    game.name = changes.name;
  }

  await gameDoc.update(changes);
  Loading.hide();
};

export const LOAD_GAME = async ({ dispatch, state }, id) => {
  if (!id) {
    throw new Error("Missing game ID");
  }

  Loading.show();
  const gameDoc = db.collection("games").doc(id);
  let gameJSON;

  // Load game
  try {
    let gameSnapshot = await gameDoc.get();
    if (!gameSnapshot.exists) {
      throw new Error("Game does not exist");
    } else {
      gameJSON = snapshotToGameJSON(gameSnapshot, state);

      // Load moves
      let moveDocs = await gameDoc.collection("moves").get();
      gameJSON.moves = [];
      moveDocs.forEach((move) => (gameJSON.moves[move.id] = move.data()));

      // Add game
      let game = new Game(false, gameJSON);
      dispatch(
        "ADD_GAME",
        {
          ptn: game.ptn,
          name: game.name,
          state: game.minState,
          config: game.config,
        },
        { root: true }
      );

      Loading.hide();
      return game;
    }
  } catch (error) {
    Loading.hide();
    throw error;
  }
};

export const LISTEN_CURRENT_GAME = function ({ commit, dispatch, state }) {
  dispatch("UNLISTEN_CURRENT_GAME");
  const gameIDs = compact(this.state.game.list.map((game) => game.config.id));
  if (!gameIDs.length) {
    return;
  }
  let unsubscribe = db
    .collection("games")
    .where(firebase.firestore.FieldPath.documentId(), "in", gameIDs)
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const currentGame = this.state.game.list[0];
          let game, stateGame, isActive;
          let isChanged = false;
          switch (change.type) {
            case "added":
            case "modified":
              game = snapshotToGameJSON(change.doc, state);
              stateGame = this.state.game.list.find(
                (g) => g.config.id === game.config.id
              );
              isActive =
                currentGame && game.config.id === currentGame.config.id;
              if (stateGame) {
                if (!isEqual(game.name, stateGame.name)) {
                  isChanged = true;
                  console.log("UPDATED NAME", game, game.name, stateGame.name);
                  this.dispatch("game/SET_NAME", {
                    oldName: stateGame.name,
                    newName: game.name,
                  });
                }
                if (!isEqual(game.state, stateGame.state)) {
                  isChanged = true;
                  console.log(
                    "UPDATED STATE",
                    game,
                    game.state,
                    stateGame.state
                  );
                  this.dispatch("game/SAVE_STATE", {
                    game,
                    gameState: game.state,
                  });
                }
                if (
                  (isChanged && !isActive) ||
                  game.config.player !== stateGame.config.player ||
                  !isEqualWith(
                    configToDB(game.config),
                    configToDB(stateGame.config),
                    (a, b) => {
                      if (isArray(a) && isArray(b)) {
                        return isEqual(a, b);
                      }
                    }
                  )
                ) {
                  console.log(
                    "UPDATED CONFIG",
                    game,
                    game.config,
                    stateGame.config
                  );
                  this.dispatch("game/SAVE_CONFIG", {
                    game,
                    config: { ...game.config, unseen: !isActive },
                  });
                }
              }
              break;
          }
        });
      },
      (error) => {
        console.error(error);
      }
    );
  commit("LISTEN_CURRENT_GAME", unsubscribe);
};

export const UNLISTEN_CURRENT_GAME = ({ commit, state }) => {
  if (state.currentGameListener) {
    state.currentGameListener();
    commit("UNLISTEN_CURRENT_GAME");
  }
};

export const LISTEN_PLAYER_GAMES = ({ commit, dispatch, state }) => {
  dispatch("UNLISTEN_PLAYER_GAMES");
  let unsubscribe = db
    .collection("games")
    .where("config.players", "array-contains", state.user.uid)
    .orderBy("tags.date", "desc")
    .limit(100)
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          let game;
          switch (change.type) {
            case "added":
            case "modified":
              game = snapshotToGameJSON(change.doc, state);
              commit("SET_PLAYER_GAME", game);
              break;
            case "removed":
              commit("REMOVE_PLAYER_GAME", change.doc.id);
              break;
          }
        });
      },
      (error) => {
        console.error(error);
      }
    );
  commit("LISTEN_PLAYER_GAMES", unsubscribe);
};

export const UNLISTEN_PLAYER_GAMES = ({ commit, state }) => {
  if (state.playerGamesListener) {
    state.playerGamesListener();
    commit("UNLISTEN_PLAYER_GAMES");
  }
};

export const LISTEN_PUBLIC_GAMES = ({ commit, dispatch, state }) => {
  dispatch("UNLISTEN_PUBLIC_GAMES");
  let unsubscribe = db
    .collection("games")
    .where("config.isPrivate", "==", false)
    .orderBy("tags.date", "desc")
    .limit(100)
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          let game;
          switch (change.type) {
            case "added":
            case "modified":
              game = snapshotToGameJSON(change.doc, state);
              commit("SET_PUBLIC_GAME", game);
              break;
            case "removed":
              commit("REMOVE_PUBLIC_GAME", change.doc.id);
              break;
          }
        });
      },
      (error) => {
        console.error(error);
      }
    );
  commit("LISTEN_PUBLIC_GAMES", unsubscribe);
};

export const UNLISTEN_PUBLIC_GAMES = ({ commit, state }) => {
  if (state.publicGamesListener) {
    state.publicGamesListener();
    commit("UNLISTEN_PUBLIC_GAMES");
  }
};

export const UPDATE_GAME = (context, gameJSON) => {
  let config = configToDB(gameJSON.config);
  return db
    .collection("games")
    .doc(gameJSON.config.id)
    .update({ ...gameJSON, config });
};
