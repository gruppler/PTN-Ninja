"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const firebase = admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();
const messaging = firebase.messaging();

const asyncPool = require("tiny-async-pool");

const { TPStoCanvas } = require("./TPS-Ninja/src");
const { Board } = require("./TPS-Ninja/src/Board");

const httpError = function (type, message) {
  console.error(type, message);
  throw new functions.https.HttpsError(type, message || type);
};

// Start a game
exports.createGame = functions.https.onCall(
  async ({ config, state, tags }, context) => {
    const uid = context.auth ? context.auth.uid : false;

    // Abort if unauthenticated
    if (!uid) {
      return httpError("unauthenticated");
    }

    // Determine player seats if it's not a finished game
    let playerSeat = config.playerSeat;
    if (!state.hasEnded && playerSeat) {
      if (playerSeat === "random") {
        playerSeat = Math.round(Math.random() + 1);
      }
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
    }

    try {
      // Validate game arguments
      new Board({ ...config, ...tags });
      let game = {
        name: "",
        config,
        state,
        tags,
        createdBy: uid,
        createdOn: new Date(),
      };
      // Add game to the database
      let gameDoc = await db
        .collection(config.isPrivate ? "gamesPrivate" : "games")
        .add(game);

      // TODO: Add branches/plies

      if (!state.hasEnded && opponentUID) {
        // TODO: Notify opponent if specified
      }

      return gameDoc.id;
    } catch (error) {
      return httpError("invalid-argument", error);
    }
  }
);

// Make a move
exports.insertPly = functions.https.onCall((data, context) => {
  const uid = context.auth.uid;

  // Get game

  // Validate user

  // Validate ply

  // Add ply to the main branch

  // Update game state

  // Notify opponent

  return true;
});

// HTTP => PNG
exports.tps = functions.https.onRequest((request, response) => {
  try {
    const canvas = TPStoCanvas(request.query);
    let name = request.query.name || canvas.id.replace(/\//g, "-");
    if (!name.endsWith(".png")) {
      name += ".png";
    }
    response.setHeader("Content-Type", "image/png");
    response.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    canvas.pngStream().pipe(response);
  } catch (error) {
    response.status(400).send({ message: error.message });
    console.error(error);
  }
});

// Delete inactive guest accounts periodically
exports.accountcleanup = functions.pubsub
  .schedule("every day 00:00")
  .onRun(async (context) => {
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
      .collection("games")
      .where("config.players", "array-contains", user.uid)
      .get();
  } catch (error) {
    return console.error(`Checking games for user ${user.uid} failed:`, error);
  }

  if (games && games.size === 0) {
    // Delete the inactive user if they have zero games
    try {
      await admin.auth().deleteUser(user.uid);
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
  const result = await admin.auth().listUsers(1000, nextPageToken);
  // Find users that have not signed in in the last 30 days.
  const inactiveUsers = result.users.filter((user) => {
    return (
      !user.emailVerified && Date.parse(user.metadata.lastRefreshTime) < LIMIT
    );
  });

  // Concat with list of previously found inactive users if there was more than 1000 users.
  users = users.concat(inactiveUsers);

  // If there are more users to fetch we fetch them.
  if (result.pageToken) {
    return getInactiveUsers(users, result.pageToken);
  }

  return users;
}
