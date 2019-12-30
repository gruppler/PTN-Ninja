import { db /* , messaging */ } from "../../boot/firebase.js";
import { Loading, LocalStorage } from "quasar";
import { omit, pick } from "lodash";

import Game from "../../PTN/Game";
import { now } from "../../PTN/Tag";

const LOCAL_CONFIG_KEYS = ["id", "player", "playerKey"];
const ONLINE_GAME_PROPS = ["name", "config", "tags"];

export const ADD_ONLINE_GAME = ({ commit }, game) => {
  let games = LocalStorage.getItem("onlineGames") || [];
  game = pick("json" in game ? game.json : game, ONLINE_GAME_PROPS);
  if (!games.find(g => g.config.id === game.config.id)) {
    games.unshift(game);
    LocalStorage.set("onlineGames", games);
    commit("ADD_ONLINE_GAME", game);
  }
};

export const UPDATE_ONLINE_GAME = ({ commit }, game) => {
  let games = LocalStorage.getItem("onlineGames") || [];
  let index = games.findIndex(g => g.config.id === game.config.id);
  game = pick("json" in game ? game.json : game, ONLINE_GAME_PROPS);

  if (index >= 0) {
    games[index] = game;
    LocalStorage.set("onlineGames", games);
    commit("UPDATE_ONLINE_GAME", { game, index });
  }
};

export const REMOVE_ONLINE_GAME = ({ commit }, game) => {
  let games = LocalStorage.getItem("onlineGames") || [];
  let index = games.findIndex(g => g.config.id === game.config.id);

  if (index >= 0) {
    games.splice(index, 1);
    LocalStorage.set("onlineGames", games);
    commit("REMOVE_ONLINE_GAME", index);
  }
};

export const CREATE_GAME = ({ dispatch }, { game, tags, config }) => {
  tags = { ...tags, ...now() };
  game.setTags(tags, false);
  game.clearHistory();
  dispatch("UPDATE_PTN", game.text(), { root: true });

  if (game.isDefaultName) {
    game.name = game.generateName();
  }

  let json = game.json;
  config = Object.assign({}, json.config, config);
  json.config = omit(config, LOCAL_CONFIG_KEYS);
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

      // Generate player key
      db.collection("playerKeys")
        .add({
          game: config.id,
          player: config.player
        })
        .then(keyDoc => {
          config.playerKey = keyDoc.id;

          // Save local config
          dispatch("SET_CONFIG", { game, config }, { root: true });
          dispatch("ADD_ONLINE_GAME", game);
        })
        .catch(error => {
          console.error("Error joining game: ", error);
        });
    })
    .catch(error => {
      console.error("Error adding game: ", error);
    });
};

export const JOIN_GAME = ({ dispatch }, { game, player, playerName }) => {
  if (!player) {
    // Spectate
    dispatch("ADD_ONLINE_GAME", game);
  } else {
    // Join as player
    let tags = { ["player" + player]: playerName, ...now() };
    let changes = { tags };

    game.setTags(tags, false);
    game.clearHistory();
    dispatch("UPDATE_PTN", game.text(), { root: true });

    if (game.isDefaultName) {
      changes.name = game.generateName();
      game.name = changes.name;
    }

    Loading.show();
    db.collection("games")
      .doc(game.config.id)
      .update(changes)
      .then(() => {
        // Generate player key
        db.collection("playerKeys")
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
            dispatch("ADD_ONLINE_GAME", game);
            Loading.hide();
          })
          .catch(error => {
            console.error("Error joining game: ", error);
            Loading.hide();
          });
      })
      .catch(error => {
        console.error("Error updating game: ", error);
        Loading.hide();
      });
  }
};

export const UPDATE = ({ commit }, game) => {
  let json = omit(game.json, "moves");
  db.collection("games")
    .doc(json.config.id)
    .set(json)
    .then(() => {
      commit("UPDATE", json);
    })
    .catch(error => {
      console.error(error);
    });
};

export const LOAD_GAMES = ({ commit }, pagination) => {
  let games = [];

  pagination;

  db.collection("games")
    .orderBy("tags.date", "desc")
    .where("config.isUnlisted", "==", false)
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
  if (state.onlineGames.length === 0) {
    return;
  }
  let games = state.onlineGames.slice(0, 10);
  let unsubscribe = db
    .collection("games")
    .where("id", "in", games.map(game => game.config.id))
    .onSnapshot(
      snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.doc.metadata.hasPendingWrites) {
            return;
          }
          console.log(change.type, change.doc.data());
          switch (change.type) {
            case "added":
              dispatch("ADD_ONLINE_GAME", change.doc.data());
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

export const LOAD = ({ dispatch }, game) => {
  const finish = (gameJSON, player = 0, key = "") => {
    gameJSON.config.id = game.config.id;
    gameJSON.config.player = player;
    if (key) {
      gameJSON.config.playerKey = key;
    } else {
      delete gameJSON.config.playerKey;
    }
    dispatch("ADD_ONLINE_GAME", gameJSON);

    gameJSON.ptn = new Game(false, gameJSON).ptn;
    dispatch("ADD_GAME", gameJSON, { root: true });
    Loading.hide();
  };

  if (game.config.id) {
    Loading.show();
    loadGame(game.config.id, game.config.playerKey).then(finish);
  } else if (game.config.playerKey) {
    Loading.show();
    getPlayerKey(game.config.playerKey)
      .then(key => {
        loadGame(key.game, game.config.playerKey, key.player).then(finish);
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

function loadGame(id, playerKey = "", player = false) {
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
                  resolve(gameJSON, player, playerKey);
                } else {
                  // Verify player key
                  getPlayerKey(playerKey, gameDoc.id)
                    .then(key => {
                      // Success
                      resolve(gameJSON, key.player, playerKey);
                    })
                    .catch(error => {
                      console.error(error);
                      resolve(gameJSON);
                    });
                }
              } else {
                // Spectator
                resolve(gameJSON);
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
