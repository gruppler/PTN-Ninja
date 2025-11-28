"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const hashObject = require("object-hash");
const { isString, pick } = require("lodash");

let firebase;
if (admin.apps.length === 0) {
  firebase = admin.initializeApp();
} else {
  firebase = admin.apps[0];
}
const auth = admin.auth();
const db = admin.firestore();
const messaging = firebase.messaging();

const asyncPool = require("tiny-async-pool");

const httpError = function (type, message) {
  console.error(type, message);
  throw new functions.https.HttpsError(type, message || type);
};

//#region URLs

// URL Shortener
exports.short = functions.https.onRequest(async (request, response) => {
  const now = new Date();
  response.set("Access-Control-Allow-Origin", "*");
  try {
    if (request.method === "OPTIONS") {
      // Send response to OPTIONS requests
      response.set("Access-Control-Allow-Methods", "GET, POST");
      response.set("Access-Control-Allow-Headers", "Content-Type");
      response.status(204).send("");
    } else if (request.method === "POST") {
      const params = pick(
        isString(request.body) ? JSON.parse(request.body) : request.body,
        ["ptn", "params"]
      );
      if (params && params.ptn) {
        const hash = hashObject(params);
        const ref = db.collection("urls").doc(hash);
        const snapshot = await ref.get();
        if (!snapshot.exists) {
          params.created = now;
          params.accessed = null;
          if ("ply" in params) {
            params.ply = String(params.ply);
          }
          await ref.set(params);
        }
        response.send("https://ptn.ninja/s/" + ref.id);
      } else {
        response.status(400).send({ message: "Invalid request" });
        console.log("body", request.body);
        console.log("query", request.query);
      }
    } else if (request.method === "GET" && request.query.id) {
      const ref = db.collection("urls").doc(request.query.id);
      const snapshot = await ref.get();
      if (snapshot.exists) {
        const data = snapshot.data();
        data.created = data.created.toDate();
        if (data.accessed) {
          data.accessed = data.accessed.toDate();
        }
        response.send(data);
        await ref.update({
          accessed: now,
          visits: (data.visits || 0) + 1,
        });
      } else {
        response.status(400).send({ message: "URL alias not found" });
      }
    } else {
      response.status(400).send({ message: "Invalid request" });
      console.log("body", request.body);
      console.log("query", request.query);
    }
  } catch (error) {
    response.status(400).send({ message: error.message });
    console.error(error);
  }
  return true;
});

// Delete expired shortened URLs
exports.urlCleanup = functions.pubsub
  .schedule("every day 00:00")
  .onRun(async () => {
    const LIMIT = new Date(Date.now() - 30 * 864e5);

    // Never accessed, created over 30 days ago
    let expiredURLs = (
      await db
        .collection("urls")
        .where("accessed", "==", null)
        .where("created", "<=", LIMIT)
        .get()
    ).docs;

    // Filter out permanent URLs
    expiredURLs = expiredURLs.filter((doc) => !doc.data().isPermanent);

    // Delete URLs
    const MAX_CONCURRENT = 5;
    console.log("Expired URLs:", expiredURLs.length);
    await asyncPool(MAX_CONCURRENT, expiredURLs, deleteExpiredURL);
    return true;
  });

async function deleteExpiredURL(doc) {
  return db.collection("urls").doc(doc.id).delete();
}

//#region PNG/GIF

// HTTP => PNG
exports.png = functions.https.onRequest(async (request, response) => {
  const { TPStoPNG } = await import("tps-ninja");

  try {
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Content-Type", "image/png");
    response.set(
      "Content-Disposition",
      `attachment; filename="${request.query.name || "takboard.png"}"`
    );
    TPStoPNG({ ...request.query, font: "Roboto" }, response);
  } catch (error) {
    response.status(400).send({ message: error.message });
    console.error(error);
  }
});

// HTTP => GIF
exports.gif = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onRequest(async (request, response) => {
    const { TPStoGIF } = await import("tps-ninja");

    try {
      response.set("Access-Control-Allow-Origin", "*");
      response.set("Content-Type", "image/gif");
      response.set(
        "Content-Disposition",
        `attachment; filename="${request.query.name || "takboard.gif"}"`
      );
      TPStoGIF({ ...request.query, font: "Roboto" }, response);
    } catch (error) {
      response.status(400).send({ message: error.message });
      console.error(error);
    }
  });

//#region Gameplay

// Start a game
exports.createGame = functions.https.onCall(
  async ({ config, state, tags }, context) => {
    const { Board, parseTPS } = await import("tps-ninja/src/Board.js");
    const uid = context.auth ? context.auth.uid : false;

    // Abort if unauthenticated
    if (!uid) {
      return httpError("unauthenticated");
    }

    // Determine player seats if it's not a finished game
    let playerSeat = config.playerSeat;
    if (playerSeat && playerSeat === "random") {
      playerSeat = Math.round(Math.random() + 1);
    }
    let opponentSeat = playerSeat === 1 ? 2 : 1;
    let opponentUID = null;

    if (playerSeat) {
      // New game
      delete tags.rating2;
      delete tags.rating1;
      delete tags.result;
      delete tags.date;
      delete tags.time;
      config.players = [];
      config.hasEnded = !state.hasEnded;
      if (config.isPrivate) {
        // Private game
        tags[`player${playerSeat}`] = config.playerName;
        config.players[playerSeat - 1] = uid;

        tags[`player${opponentSeat}`] = config.opponentName || "";
        config.players[opponentSeat - 1] = null;
      } else {
        // Public game
        config.playerName = context.auth.token.name;
        tags[`player${playerSeat}`] = context.auth.token.name;
        config.players[playerSeat - 1] = uid;

        config.opponentName = (config.opponentName || "").trim();
        if (config.opponentName) {
          // Find opponent uid from name
          let snapshot = await db
            .collection("names")
            .doc(config.opponentName.toLowerCase())
            .get();
          if (snapshot.exists) {
            opponentUID = snapshot.data().uid;
            tags[`player${opponentSeat}`] = config.opponentName;
            config.players[opponentSeat - 1] = opponentUID;
          } else {
            return httpError("invalid-argument", "Invalid opponent name");
          }
        } else {
          // Open opponent seat
          tags[`player${opponentSeat}`] = "";
          config.players[opponentSeat - 1] = null;
        }
      }
      config.isOpen = config.players.includes(null);
    }

    try {
      // Validate game arguments
      const createdAt = new Date();
      new Board({ ...config, ...tags });
      let game = {
        name: "",
        config,
        state,
        tags,
        createdBy: uid,
        createdAt,
        updatedBy: uid,
        updatedAt: createdAt,
      };
      // Add game to the database
      let gameDoc = await db
        .collection(config.isPrivate ? "gamesPrivate" : "gamesPublic")
        .add(game);

      // Add branches/plies if game has existing moves
      if (state.ply || state.plyIndex > 0) {
        // Create root branch with existing plies
        const plies = [];

        // For now, we'll handle the basic case where we have the current ply
        // In a full implementation, we'd need to reconstruct all plies up to plyIndex
        if (state.ply) {
          plies.push({
            index: state.plyIndex,
            ply: state.ply,
            uid: uid,
            createdAt: createdAt,
            updatedAt: createdAt,
          });
        }

        // Use TPS to determine which player moves next
        let nextPlayer = 1;
        if (state.tps) {
          const tps = parseTPS(state.tps);
          nextPlayer = tps.player;
        }

        // Create root branch document
        await db
          .collection(config.isPrivate ? "gamesPrivate" : "gamesPublic")
          .doc(gameDoc.id)
          .collection("branches")
          .doc("root")
          .set({
            parent: null,
            name: "root",
            player: nextPlayer,
            plies: plies,
            uid: uid,
            createdAt: createdAt,
            updatedAt: createdAt,
          });
      } else {
        // Create empty root branch for new games - player 1 starts
        await db
          .collection(config.isPrivate ? "gamesPrivate" : "gamesPublic")
          .doc(gameDoc.id)
          .collection("branches")
          .doc("root")
          .set({
            parent: null,
            name: "root",
            player: 1,
            plies: [],
            uid: uid,
            createdAt: createdAt,
            updatedAt: createdAt,
          });
      }

      if (!state.hasEnded && opponentUID) {
        // TODO: Notify opponent if specified
      }

      return gameDoc.id;
    } catch (error) {
      return httpError("invalid-argument", error);
    }
  }
);

// Join a game as player or spectator
exports.joinGame = functions.https.onCall(
  async ({ id, isPrivate }, context) => {
    const uid = context.auth ? context.auth.uid : false;

    // Abort if unauthenticated
    if (!uid) {
      return httpError("unauthenticated");
    }

    // Fetch game from DB
    const gameRef = db
      .collection(isPrivate ? "gamesPrivate" : "gamesPublic")
      .doc(id);
    const gameSnapshot = await gameRef.get();
    if (!gameSnapshot.exists) {
      return httpError("invalid-argument", "Game does not exist");
    }
    const game = gameSnapshot.data();

    // Player already joined
    if (game.config.players.indexOf(uid) !== -1) {
      return httpError("invalid-argument", "Already joined");
    }

    const player = game.config.players
      ? game.config.players.indexOf(null) + 1
      : 1;

    // No open seats
    if (player === 0) {
      return httpError("invalid-argument", "No open seats");
    }

    const changes = {
      [`tags.player${player}`]: context.auth.token.name,
      [`config.players.${player - 1}`]: uid,
    };

    await gameRef.update(changes);

    // TODO: Notify other player

    return true;
  }
);

// Make a move
exports.insertPly = functions.https.onCall(
  async ({ gameId, ply, isPrivate }, context) => {
    const { Board, parseTPS } = await import("tps-ninja/src/Board.js");
    const uid = context.auth ? context.auth.uid : false;

    // Abort if unauthenticated
    if (!uid) {
      return httpError("unauthenticated");
    }

    // Get game
    const gameRef = db
      .collection(isPrivate ? "gamesPrivate" : "gamesPublic")
      .doc(gameId);
    const gameSnapshot = await gameRef.get();
    if (!gameSnapshot.exists) {
      return httpError("invalid-argument", "Game does not exist");
    }
    const game = gameSnapshot.data();

    // Validate user is a player in the game
    if (!game.config.players.includes(uid)) {
      return httpError("permission-denied", "Not a player in this game");
    }

    // Get current branch to determine turn
    const branchRef = gameRef.collection("branches").doc("root");
    const branchSnapshot = await branchRef.get();
    if (!branchSnapshot.exists) {
      return httpError("invalid-argument", "Game branch not found");
    }
    const branch = branchSnapshot.data();

    // Validate it's the user's turn
    const playerIndex = game.config.players.indexOf(uid);
    const playerNumber = playerIndex + 1;

    // Use game state TPS to determine current turn
    const currentTPS = parseTPS(game.state.tps);
    if (currentTPS.player !== playerNumber) {
      return httpError("permission-denied", "Not your turn");
    }

    // Validate the ply is legal
    try {
      // Create board with current state
      const board = new Board({
        ...game.config,
        ...game.tags,
        tps: game.state.tps,
      });

      // Execute the ply to get updated game state
      board.doPly(ply);

      // Add ply to the branch
      const updatedAt = new Date();
      const newPly = {
        index: branch.plies.length,
        ply: ply,
        uid: uid,
        createdAt: updatedAt,
        updatedAt: updatedAt,
      };

      await branchRef.update({
        plies: [...branch.plies, newPly],
        player: playerNumber === 1 ? 2 : 1, // Switch turn
        updatedAt: updatedAt,
      });

      // Update game state with board's new state after executing ply
      const newState = {
        ...game.state,
        plyIndex: game.state.plyIndex + 1,
        ply: ply,
        plyIsDone: true,
        tps: board.getTPS(), // Updated TPS after move
      };

      await gameRef.update({
        state: newState,
        updatedBy: uid,
        updatedAt: updatedAt,
      });

      // TODO: Notify opponent via push notifications

      return {
        success: true,
        plyIndex: newPly.index,
        tps: newState.tps,
        nextPlayer: playerNumber === 1 ? 2 : 1,
      };
    } catch (error) {
      return httpError("invalid-argument", `Invalid ply: ${error.message}`);
    }
  }
);

//#region Users

// Delete inactive guest accounts periodically
exports.accountcleanup = functions.pubsub
  .schedule("every day 00:10")
  .onRun(async () => {
    const MAX_CONCURRENT = 5;
    // Fetch all user details.
    const inactiveUsers = await getInactiveUsers();
    console.log("Inactive Users:", inactiveUsers.length);
    await asyncPool(MAX_CONCURRENT, inactiveUsers, deleteInactiveUser);
  });

async function deleteInactiveUser(user) {
  let games;
  try {
    games = await admin
      .firestore()
      .collection("gamesPublic")
      .where("config.players", "array-contains", user.uid)
      .get();
  } catch (error) {
    return console.error(`Checking games for user ${user.uid} failed:`, error);
  }

  if (games && games.size === 0) {
    // Delete the inactive user if they have zero games
    try {
      await auth.deleteUser(user.uid);
      console.log(
        `Deleted user account ${user.uid} because of inactivity (${user.metadata.lastRefreshTime})`
      );
      return user;
    } catch (error) {
      return console.error(
        `Deletion of inactive user account ${user.uid} failed:`,
        error
      );
    }
  }

  return true;
}

async function getInactiveUsers(users = [], nextPageToken) {
  const LIMIT = Date.now() - 21 * 864e5;
  const result = await auth.listUsers(1000, nextPageToken);
  // Find users that have not signed in in the last 3 weeks
  const inactiveUsers = result.users.filter((user) => {
    return (
      !user.emailVerified && Date.parse(user.metadata.lastRefreshTime) < LIMIT
    );
  });

  // Concat with list of previously found inactive users if there was more than 1000 users
  users = users.concat(inactiveUsers);

  // If there are more users to fetch we fetch them
  if (result.pageToken) {
    return getInactiveUsers(users, result.pageToken);
  }

  return users;
}
