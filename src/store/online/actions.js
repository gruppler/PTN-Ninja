import { db, messaging } from "../../boot/firebase.js";
import { omit } from "lodash";

import Game from "../../PTN/Game";

export const NOTIFICATION_INIT = context => {
  if (!messaging || !Notification) {
    console.error("Messaging not supported");
  }

  context;

  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      // Get Instance ID token. Initially this makes a network call, once retrieved
      // subsequent calls to getToken will return from cache.
      messaging
        .getToken()
        .then(currentToken => {
          if (currentToken) {
            // sendTokenToServer(currentToken);
            // updateUIForPushEnabled(currentToken);
          } else {
            // Show permission request.
            console.log(
              "No Instance ID token available. Request permission to generate one."
            );
            // Show permission UI.
            // updateUIForPushPermissionRequired();
            // setTokenSentToServer(false);
          }
        })
        .catch(err => {
          console.error("An error occurred while retrieving token. ", err);
          // showToken("Error retrieving Instance ID token. ", err);
          // setTokenSentToServer(false);
        });

      // Callback fired if Instance ID token is updated.
      messaging.onTokenRefresh(() => {
        messaging
          .getToken()
          .then(refreshedToken => {
            console.log("Token refreshed.");
            // Indicate that the new Instance ID token has not yet been sent to the
            // app server.
            // setTokenSentToServer(false);
            // Send Instance ID token to app server.
            // sendTokenToServer(refreshedToken);
            refreshedToken;
          })
          .catch(err => {
            console.error("Unable to retrieve refreshed token ", err);
            // showToken("Unable to retrieve refreshed token ", err);
          });
      });
    } else {
      console.error("Unable to get permission to notify.");
    }
  });
};

const LOCAL_CONFIG_KEYS = ["id", "player", "playerKey"];

export const CREATE = ({ dispatch }, { game, tags, config }) => {
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
          dispatch("SAVE_CONFIG", { game, config }, { root: true });
          dispatch("ADD_ONLINE_GAME", game, { root: true });
        })
        .catch(error => {
          console.error("Error adding game: ", error);
        });
    })
    .catch(error => {
      console.error("Error adding game: ", error);
    });
};

export const LOAD = ({ dispatch }, { gameID, playerKey }) => {
  const finish = (gameJSON, player = 0, key = "") => {
    gameJSON.config.id = gameID;
    gameJSON.config.player = player;
    if (key) {
      gameJSON.config.playerKey = key;
    } else {
      delete gameJSON.config.playerKey;
    }
    dispatch("ADD_ONLINE_GAME", gameJSON, { root: true });

    gameJSON.ptn = new Game(false, gameJSON).ptn;
    dispatch("ADD_GAME", gameJSON, { root: true });
  };

  if (gameID) {
    loadGame(gameID, playerKey).then(finish);
  } else if (playerKey) {
    getPlayerKey(playerKey)
      .then(key => {
        loadGame(key.game, playerKey, key.player).then(finish);
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
              moveDocs.forEach(
                gameDoc => (gameJSON.moves[gameDoc.id] = gameDoc.data())
              );

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
