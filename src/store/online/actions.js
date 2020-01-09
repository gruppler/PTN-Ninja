import { firebase, auth, db /* , messaging */ } from "../../boot/firebase.js";
import { Loading, LocalStorage } from "quasar";

import { omit } from "lodash";

import Game from "../../PTN/Game";
import { toDate, now } from "../../PTN/Tag";

export const INIT = ({ commit, dispatch }) => {
  auth.onAuthStateChanged(user => {
    if (user) {
      db.collection("users")
        .doc(user.uid)
        .get()
        .then(userSnapshot => {
          let userData = userSnapshot.data() || {};
          user.publicGames = userData.publicGames || [];
          user.privateGames = userData.privateGames || [];
          commit("SET_USER", user);
          dispatch("LISTEN_GAMES");
        });
    } else {
      commit("UNLISTEN_GAMES");
      dispatch("ANONYMOUS");
    }
  });
};

export const ANONYMOUS = () => {
  auth.signInAnonymously().catch(error => {
    console.error(error);
  });
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
          reject(new Error("Player exists"));
        } else {
          // Create account
          const credential = firebase.auth.EmailAuthProvider.credential(
            email,
            password
          );
          auth.currentUser
            .linkWithCredential(credential)
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
        }
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
  auth
    .signOut()
    .then(() => {
      dispatch("ANONYMOUS");
    })
    .catch(error => {
      console.error(error);
    });
};

export const RESET_PASSWORD = (context, email) => {
  return auth.sendPasswordResetEmail(email);
};

export const ADD_GAME = ({ commit }, game) => {
  let games = LocalStorage.getItem("games") || [];
  if (game instanceof Game) {
    game = game.json;
  } else if (game.tags && game.tags.date) {
    game.tags.date = toDate(game.tags.date, game.tags.time);
  }
  if (!games.find(g => g.config.id === game.config.id)) {
    commit("ADD_GAME", game);
  }
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
    let config = Object.assign({}, json.config, {
      isOnline: true,
      player1: players[1] || null,
      player2: players[2] || null,
      isPrivate,
      disableRoads
    });

    db.collection("games")
      .add(omit(json, "moves"))
      .then(gameDoc => {
        // Add game to DB
        config.id = gameDoc.id;

        // Add moves to game in DB
        if (json.moves.length) {
          let batch = db.batch();
          const moves = gameDoc.collection("moves");
          json.moves.forEach((move, i) => batch.set(moves.doc("" + i), move));
          batch.commit().catch(error => {
            console.error("Error adding moves: ", error);
          });
        }

        // Add game to user's appropriate list
        db.collection("users")
          .doc(state.user.uid)
          .collection(isPrivate ? "privateGames" : "publicGames")
          .add({
            game: config.id,
            player: config.player
          })
          .then(keyDoc => {
            config.playerKey = keyDoc.id;

            // Save local config
            dispatch("SET_CONFIG", { game, config }, { root: true });
            dispatch("ADD_GAME", game);
            resolve({ game, config });
          })
          .catch(reject);
      })
      .catch(reject);
  });
};

export const JOIN_GAME = ({ dispatch }, { game, player, playerName }) => {
  // Join as player if still open
  const gameDoc = db.collection("games").doc(game.config.id);

  return new Promise((resolve, reject) => {
    if (!player) {
      resolve();
      return;
    }

    Loading.show();
    gameDoc
      .get()
      .then(gamesSnapshot => {
        // Check that the player is still open
        let tags = gamesSnapshot.data().tags;
        if (tags["player" + player]) {
          Loading.hide();
          reject(new Error("Player position already filled"));
          return;
        }

        // Update game tags and name
        tags = { ["player" + player]: playerName, ...now() };
        let changes = { tags };

        game.setTags(tags, false);
        game.clearHistory();
        dispatch("UPDATE_PTN", game.text(), { root: true });

        if (game.isDefaultName) {
          changes.name = game.generateName();
          game.name = changes.name;
        }

        gameDoc
          .update(changes)
          .then(() => {
            // Generate player key
            gameDoc
              .collection("playerKeys")
              .add({
                game: game.config.id,
                player
              })
              .then(keyDoc => {
                // Save local config
                dispatch(
                  "SET_CONFIG",
                  {
                    game,
                    config: { ...game.config, player, playerKey: keyDoc.id }
                  },
                  { root: true }
                );
                Loading.hide();
                resolve();
              })
              .catch(error => {
                Loading.hide();
                reject(error);
              });
          })
          .catch(reject);
      })
      .catch(error => {
        Loading.hide();
        reject(error);
      });
  });
};

export const LOAD_GAME = ({ dispatch }, { id, playerKey }) => {
  const finish = ({ gameJSON, player = 0, key = "" }) => {
    gameJSON.config.id = id;
    gameJSON.config.player = player;
    if (key) {
      gameJSON.config.playerKey = key;
    } else {
      delete gameJSON.config.playerKey;
    }
    dispatch("ADD_GAME", gameJSON);

    gameJSON.ptn = new Game(false, gameJSON).ptn;
    dispatch("ADD_GAME", gameJSON, { root: true });
    Loading.hide();
  };

  if (id) {
    Loading.show();
    loadGame({ id, playerKey }).then(finish);
  } else if (playerKey) {
    Loading.show();
    getPlayerKey(playerKey)
      .then(key => {
        loadGame({
          id: key.game,
          player: key.player,
          playerKey
        }).then(finish);
      })
      .catch(error => {
        console.error("Error loading game:", error);
      });
  }
};

function getPlayerKey(playerKey, id = false) {
  return new Promise((resolve, reject) => {
    db.collection("playerKeys")
      .doc(playerKey)
      .get()
      .then(keyDoc => {
        const key = keyDoc.data();
        if (keyDoc.exists && (!id || key.game === id)) {
          resolve(key);
        } else {
          reject(new Error("Invalid player key"));
        }
      })
      .catch(error => {
        reject(error);
      });
  });
}

function loadGame({ id, playerKey = "", player = false }) {
  return new Promise((resolve, reject) => {
    const gameRef = db.collection("games").doc(id);

    // Load game
    gameRef
      .get()
      .then(gameDoc => {
        if (gameDoc.exists) {
          let gameJSON = gameDoc.data();

          // Load moves
          gameRef
            .collection("moves")
            .get()
            .then(moveDocs => {
              gameJSON.moves = [];
              moveDocs.forEach(move => (gameJSON.moves[move.id] = move.data()));

              if (playerKey) {
                if (player) {
                  // Trusted key
                  resolve({ gameJSON, player, playerKey });
                } else {
                  // Verify player key
                  getPlayerKey(playerKey, gameDoc.id)
                    .then(key => {
                      // Success
                      resolve({ gameJSON, player: key.player, playerKey });
                    })
                    .catch(error => {
                      console.error(error);
                      resolve({ gameJSON });
                    });
                }
              } else {
                // Spectator
                resolve({ gameJSON });
              }
            })
            .catch(error => {
              console.error(error);
              reject(new Error("Error getting moves"));
            });
        } else {
          reject(new Error("Game does not exist"));
        }
      })
      .catch(error => {
        console.error(error);
        reject(new Error("Error getting game:"));
      });
  });
}

export const LOAD_GAMES = ({ commit }, pagination) => {
  let games = [];

  pagination;

  db.collection("games")
    .orderBy("tags.date", "desc")
    .where("config.isPrivate", "==", false)
    .get()
    .then(gamesSnapshot => {
      gamesSnapshot.forEach(gameDoc => {
        let game = gameDoc.data();
        game.config.id = gameDoc.id;
        game.tags.date = new Date(game.tags.date.seconds * 1e3);
        games.push(game);
      });
      commit("LOAD_GAMES", games);
    });
};

export const LISTEN_GAMES = ({ dispatch, commit, state }) => {
  const games = state.user.games.slice(0, 10);
  if (games.length === 0) {
    return;
  }
  let unsubscribe = db
    .collection("games")
    .where("id", "in", games.map(game => game.config.id))
    .onSnapshot(
      snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.doc.metadata.hasPendingWrites) {
            return;
          }
          console.log(
            "CHANGE_DETECTED",
            change.type,
            change.doc.data(),
            change
          );
          switch (change.type) {
            case "added":
              dispatch("ADD_GAME", change.doc.data());
              break;
            case "modified":
              dispatch("UPDATE_ONLINE_GAME", change.doc.data());
              break;
            case "removed":
              dispatch("REMOVE_ONLINE_GAME", change.doc.data());
              break;
          }
        });
      },
      error => {
        console.error(error);
      }
    );
  commit("LISTEN_GAMES", unsubscribe);
};

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
