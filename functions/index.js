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
const {
  wrap,
  createGameHandler,
  joinGameHandler,
  deleteUserData,
} = require("./lib/handlers");

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
exports.createGame = functions.https.onCall(wrap(createGameHandler));

// Join a game as a player
exports.joinGame = functions.https.onCall(wrap(joinGameHandler));

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

// Resign from a game
exports.resign = functions.https.onCall(
  async ({ gameId, isPrivate }, context) => {
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

    // Check game hasn't already ended
    if (game.state.hasEnded) {
      return httpError("invalid-argument", "Game has already ended");
    }

    // Determine result based on who resigned
    const playerIndex = game.config.players.indexOf(uid);
    const playerNumber = playerIndex + 1;
    const result = playerNumber === 1 ? "0-R" : "R-0"; // R indicates resignation

    const updatedAt = new Date();

    // Update game state
    await gameRef.update({
      "state.hasEnded": true,
      "state.result": result,
      "tags.result": result,
      updatedBy: uid,
      updatedAt: updatedAt,
    });

    // TODO: Notify opponent via push notifications

    return {
      success: true,
      result: result,
    };
  }
);

//#region Users

// Helper function to delete all subcollections of a game document
async function deleteGameSubcollections(snap, gameId) {
  console.log(`Deleting subcollections for game: ${gameId}`);

  // Delete all subcollections
  const subcollections = ["branches"];
  await Promise.all(
    subcollections.map(async (subcollection) => {
      const subcollectionRef = snap.ref.collection(subcollection);
      const snapshot = await subcollectionRef.get();

      // Delete all documents in the subcollection
      if (snapshot.size > 0) {
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted ${snapshot.size} documents from ${subcollection}`);
      }
    })
  );
}

// Automatically delete subcollections when a public game document is deleted
exports.deleteGameSubcollections = functions.firestore
  .document("gamesPublic/{gameId}")
  .onDelete(async (snap, context) => {
    const gameId = context.params.gameId;
    await deleteGameSubcollections(snap, gameId);
  });

// Automatically delete subcollections when a private game document is deleted
exports.deletePrivateGameSubcollections = functions.firestore
  .document("gamesPrivate/{gameId}")
  .onDelete(async (snap, context) => {
    const gameId = context.params.gameId;
    await deleteGameSubcollections(snap, gameId);
  });

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
  let hasNoGames;
  try {
    // Removes the user's reserved name if they have no games
    hasNoGames = await deleteUserData(user.uid);
  } catch (error) {
    return console.error(`Checking games for user ${user.uid} failed:`, error);
  }

  if (hasNoGames) {
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
