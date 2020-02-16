import { firebase, auth, db /* , messaging */ } from "../../boot/firebase.js";
import { Loading } from "quasar";

import { omit } from "lodash";

import Game from "../../PTN/Game";
import { toDate, now } from "../../PTN/Tag";

export const INIT = ({ commit, dispatch, state }) => {
  return new Promise((resolve, reject) => {
    if (state.initialized) {
      resolve();
    }
    auth.onAuthStateChanged(user => {
      if (user) {
        commit("SET_USER", user);
        dispatch("LISTEN_PLAYER_GAMES");
        commit("INIT");
        resolve();
      } else {
        commit("UNLISTEN_PLAYER_GAMES");
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

export const CHECK_USERNAME = (context, name) => {
  return new Promise((resolve, reject) => {
    db.collection("names")
      .doc(name.toLowerCase())
      .get()
      .then(nameSnapshot => {
        resolve(!nameSnapshot.exists);
      })
      .catch(reject);
  });
};

export const REGISTER = (context, { email, password, name }) => {
  return new Promise((resolve, reject) => {
    // Check name uniqueness
    const nameDoc = db.collection("names").doc(name.toLowerCase());
    nameDoc
      .get()
      .then(nameSnapshot => {
        if (nameSnapshot.exists) {
          throw new Error("Player exists");
        } else {
          // Create account
          const credential = firebase.auth.EmailAuthProvider.credential(
            email,
            password
          );
          return auth.currentUser.linkWithCredential(credential);
        }
      })
      .then(({ user }) => {
        // Set name
        nameDoc.set({ uid: user.uid });
        user
          .updateProfile({
            displayName: name
          })
          .then(() => {
            resolve(user);
          });
      })
      .catch(reject);
  });
};

export const LOG_IN = (context, { email, password }) => {
  return new Promise((resolve, reject) => {
    auth
      .signInWithEmailAndPassword(email, password)
      .then(({ user }) => {
        resolve(user);
      })
      .catch(reject);
  });
};

export const LOG_OUT = ({ dispatch }) => {
  dispatch("UNLISTEN_PLAYER_GAMES");
  return new Promise((resolve, reject) => {
    auth
      .signOut()
      .then(() => {
        dispatch("ANONYMOUS").then(resolve);
      })
      .catch(reject);
  });
};

export const UPDATE_ACCOUNT = async (context, { email, password }) => {
  if (email) {
    await auth.currentUser.updateEmail(email);
  }
  if (password) {
    await auth.currentUser.updatePassword(password);
  }
};

export const RESET_PASSWORD = (context, email) => {
  return auth.sendPasswordResetEmail(email);
};

export const CREATE_GAME = (
  { dispatch, getters, state },
  { game, players, isPrivate, disableRoads }
) => {
  return new Promise((resolve, reject) => {
    const playerName = getters.playerName(isPrivate);
    const player = players[1] === state.user.uid ? 1 : 2;
    let tags = {
      player1: "",
      player2: "",
      rating1: "",
      rating2: "",
      ...now()
    };
    tags["player" + player] = playerName;
    game.setTags(tags, false);
    game.clearHistory();
    dispatch("UPDATE_PTN", game.text(), { root: true });

    if (game.isDefaultName) {
      game.name = game.generateName();
    }

    let json = game.json;
    let config = Object.assign(json.config, {
      isOnline: true,
      players: [players[1] || null, players[2] || null],
      isPrivate,
      disableRoads
    });

    // Add game to DB
    db.collection("games")
      .add(omit(json, "moves"))
      .then(gameDoc => {
        config.id = gameDoc.id;
        dispatch("SET_CONFIG", { game, config }, { root: true });

        // Add moves to game in DB
        if (json.moves.length) {
          let batch = db.batch();
          const moves = gameDoc.collection("moves");
          json.moves.forEach((move, i) => batch.set(moves.doc("" + i), move));
          batch
            .commit()
            .then(resolve)
            .catch(reject);
        } else {
          resolve();
        }
      })
      .catch(reject);
  });
};

export const JOIN_GAME = ({ dispatch, getters, state }, game) => {
  return new Promise((resolve, reject) => {
    // Join as player if still open
    const player = game.openPlayer;
    const playerName = getters.playerName(game.config.isPrivate);
    const gameDoc = db.collection("games").doc(game.config.id);
    Loading.show();
    gameDoc
      .get()
      .then(gamesSnapshot => {
        // Check that the player is still open
        let gameData = gamesSnapshot.data();
        if (gameData.config.players[player - 1]) {
          Loading.hide();
          return reject(new Error("Player position already filled"));
        }

        // Update game config and tags
        let config = {
          ...game.config,
          ...gameData.config,
          players: [...gameData.config.players]
        };
        config.players[player - 1] = state.user.uid;

        let tags = { ["player" + player]: playerName, ...now() };
        game.setTags(tags, false);
        dispatch("SET_CONFIG", { game, config }, { root: true });
        dispatch("UPDATE_PTN", game.text(), { root: true });
        game.clearHistory();

        let changes = {
          config: omit(config, ["id"]),
          tags: game.JSONTags
        };

        // Update name
        if (game.isDefaultName) {
          changes.name = game.generateName();
          game.name = changes.name;
        }

        return gameDoc.update(changes);
      })
      .then(() => {
        Loading.hide();
        resolve();
      });
  });
};

export const LOAD_GAME = ({ dispatch, state }, id) => {
  return new Promise((resolve, reject) => {
    if (!id) {
      return reject();
    }

    Loading.show();
    const gameDoc = db.collection("games").doc(id);
    let gameJSON;

    // Load game
    gameDoc
      .get()
      .then(gameSnapshot => {
        if (!gameSnapshot.exists) {
          reject(new Error("Game does not exist"));
        } else {
          gameJSON = snapshotToGame(gameSnapshot, state);

          // Load moves
          return gameDoc.collection("moves").get();
        }
      })
      .then(moveDocs => {
        gameJSON.moves = [];
        moveDocs.forEach(move => (gameJSON.moves[move.id] = move.data()));

        // Add game
        let game = new Game(false, gameJSON);
        dispatch(
          "ADD_GAME",
          {
            ptn: game.ptn,
            name: game.name,
            state: game.minState,
            config: game.config
          },
          { root: true }
        );

        Loading.hide();
        resolve(game);
      })
      .catch(error => {
        Loading.hide();
        reject(error);
      });
  });
};

export const LISTEN_PLAYER_GAMES = ({ commit, dispatch, state }) => {
  dispatch("UNLISTEN_PLAYER_GAMES");
  let unsubscribe = db
    .collection("games")
    .where("config.players", "array-contains", state.user.uid)
    .orderBy("tags.date", "desc")
    .onSnapshot(
      snapshot => {
        snapshot.docChanges().forEach(change => {
          let game;
          switch (change.type) {
            case "added":
            case "modified":
              game = snapshotToGame(change.doc, state);
              commit("SET_PLAYER_GAME", game);
              break;
            case "removed":
              commit("REMOVE_PLAYER_GAME", change.doc.id);
              break;
          }
        });
      },
      error => {
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
    .limit(100)
    .orderBy("tags.date", "desc")
    .onSnapshot(
      snapshot => {
        snapshot.docChanges().forEach(change => {
          let game;
          switch (change.type) {
            case "added":
            case "modified":
              game = snapshotToGame(change.doc, state);
              commit("SET_PUBLIC_GAME", game);
              break;
            case "removed":
              commit("REMOVE_PUBLIC_GAME", change.doc.id);
              break;
          }
        });
      },
      error => {
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

const snapshotToGame = doc => {
  let game = doc.data();
  game.config.id = doc.id;
  game.tags.date = toDate(game.tags.date);
  return game;
};

// export const UPDATE_GAME = ({ commit, dispatch }, gameJSON) => {};

// export const NOTIFICATION_INIT = context => {
//   if (!messaging || !Notification) {
//     console.error("Messaging not supported");
//   }
//
//   context;
//
//   Notification.requestPermission().then(permission => {
//     if (permission === "granted") {
//       // Get Instance ID token. Initially this makes a network call, once retrieved
//       // subsequent calls to getToken will return from cache.
//       messaging
//         .getToken()
//         .then(currentToken => {
//           if (currentToken) {
//             // sendTokenToServer(currentToken);
//             // updateUIForPushEnabled(currentToken);
//           } else {
//             // Show permission request.
//             console.log(
//               "No Instance ID token available. Request permission to generate one."
//             );
//             // Show permission UI.
//             // updateUIForPushPermissionRequired();
//             // setTokenSentToServer(false);
//           }
//         })
//         .catch(err => {
//           console.error("An error occurred while retrieving token. ", err);
//           // showToken("Error retrieving Instance ID token. ", err);
//           // setTokenSentToServer(false);
//         });
//
//       // Callback fired if Instance ID token is updated.
//       messaging.onTokenRefresh(() => {
//         messaging
//           .getToken()
//           .then(refreshedToken => {
//             console.log("Token refreshed.");
//             // Indicate that the new Instance ID token has not yet been sent to the
//             // app server.
//             // setTokenSentToServer(false);
//             // Send Instance ID token to app server.
//             // sendTokenToServer(refreshedToken);
//             refreshedToken;
//           })
//           .catch(err => {
//             console.error("Unable to retrieve refreshed token ", err);
//             // showToken("Unable to retrieve refreshed token ", err);
//           });
//       });
//     } else {
//       console.error("Unable to get permission to notify.");
//     }
//   });
// };
