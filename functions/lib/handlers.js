// Firestore/transaction layer for online games. Rules live in ./games.

const admin = require("firebase-admin");
const functions = require("firebase-functions");
const {
  GameError,
  collectionFor,
  buildNewGame,
  checkJoin,
  seatOf,
  resignResult,
  applyPly,
} = require("./games");

// Share the app index.js (or the test harness) already initialized
const app = admin.apps.length ? admin.app() : admin.initializeApp();
const db = app.firestore();

// Firestore rejects undefined field values
const stripUndefined = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    );
  }
  return value;
};

const nameRef = (name) => db.collection("names").doc(name.trim().toLowerCase());

// The uid holding a name, if any
const nameOwner = async (name) => {
  const snapshot = await nameRef(name).get();
  return (snapshot.exists && snapshot.data().uid) || null;
};

// A registered account's { uid, name } by its name, or null
const lookupName = async (name) => {
  const uid = await nameOwner(name);
  if (!uid) {
    return null;
  }
  // Only registered (non-anonymous) accounts can be invited by name
  let user;
  try {
    user = await app.auth().getUser(uid);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      return null;
    }
    throw error;
  }
  if (!user.providerData.length) {
    return null;
  }
  // The name as the account spells it; an account whose display name no
  // longer matches its names doc keeps the name as typed
  const displayName = (user.displayName || "").trim();
  return {
    uid,
    name:
      displayName.toLowerCase() === name.trim().toLowerCase()
        ? displayName
        : name.trim(),
  };
};

const deps = { lookupName, nameOwner };

// Convert rule violations to client-visible errors; others become "internal"
const wrap = (handler) => async (data, context) => {
  try {
    return await handler(data, context);
  } catch (error) {
    if (error instanceof GameError) {
      throw new functions.https.HttpsError(error.code, error.message);
    }
    throw error;
  }
};

async function createGameHandler(data, context) {
  const { game, root } = await buildNewGame(data, context, deps);
  const isPrivate = !!game.config.isPrivate;
  const gameRef = db.collection(collectionFor(isPrivate)).doc();
  const batch = db.batch();
  batch.set(gameRef, stripUndefined(game));
  batch.set(gameRef.collection("branches").doc("root"), stripUndefined(root));
  await batch.commit();
  return { id: gameRef.id, isPrivate };
}

async function joinGameHandler({ id, isPrivate, playerName } = {}, context) {
  if (!id || typeof id !== "string") {
    throw new GameError("invalid-argument", "Missing game id");
  }
  const gameRef = db.collection(collectionFor(!!isPrivate)).doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(gameRef);
    if (!snapshot.exists) {
      throw new GameError("not-found", "Game does not exist");
    }
    const game = snapshot.data();
    const { seat, playerName: name } = await checkJoin(
      game,
      context,
      playerName,
      deps
    );
    transaction.update(gameRef, {
      // Dotted numeric paths would create a map, so write the whole array
      "config.players": game.config.players.map((player, index) =>
        index === seat - 1 ? context.auth.uid : player
      ),
      [`tags.player${seat}`]: name,
      "config.isOpen": false,
      "config.reservedFor": null,
      updatedAt: new Date(),
      updatedBy: context.auth.uid,
    });
    return { seat };
  });
}

const gameRefFor = (id, isPrivate) => {
  if (!id || typeof id !== "string") {
    throw new GameError("invalid-argument", "Missing game id");
  }
  return db.collection(collectionFor(!!isPrivate)).doc(id);
};

const requireAuth = (context) => {
  if (!context || !context.auth || !context.auth.uid) {
    throw new GameError("unauthenticated", "Sign in to play online");
  }
  return context.auth.uid;
};

async function insertPlyHandler(
  { id, isPrivate, ply, plyIndex } = {},
  context
) {
  const uid = requireAuth(context);
  const gameRef = gameRefFor(id, isPrivate);
  const rootRef = gameRef.collection("branches").doc("root");
  return db.runTransaction(async (transaction) => {
    const [gameSnapshot, rootSnapshot] = await Promise.all([
      transaction.get(gameRef),
      transaction.get(rootRef),
    ]);
    if (!gameSnapshot.exists || !rootSnapshot.exists) {
      throw new GameError("not-found", "Game does not exist");
    }
    const game = gameSnapshot.data();
    const root = rootSnapshot.data();
    if (plyIndex !== root.plies.length) {
      throw new GameError("failed-precondition", "Out of sync");
    }
    const { gameUpdate, rootUpdate } = await applyPly(game, root, ply, uid);
    transaction.update(gameRef, stripUndefined(gameUpdate));
    transaction.update(rootRef, stripUndefined(rootUpdate));
    return { plyIndex: rootUpdate.plies.length };
  });
}

async function resignHandler({ id, isPrivate } = {}, context) {
  const uid = requireAuth(context);
  const gameRef = gameRefFor(id, isPrivate);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(gameRef);
    if (!snapshot.exists) {
      throw new GameError("not-found", "Game does not exist");
    }
    const game = snapshot.data();
    const seat = seatOf(game, uid);
    if (!seat) {
      throw new GameError("permission-denied", "Not a player in this game");
    }
    if (game.state.hasEnded) {
      throw new GameError("failed-precondition", "Game has already ended");
    }
    if ((game.config.players || []).includes(null)) {
      throw new GameError("failed-precondition", "Waiting for an opponent");
    }
    const result = resignResult(seat);
    transaction.update(gameRef, {
      "state.hasEnded": true,
      "state.result": result,
      "tags.result": result,
      updatedAt: new Date(),
      updatedBy: uid,
    });
    return { result };
  });
}

// Delete a user's Firestore data if they have no games.
// Returns true if the user has no games (data removed), false otherwise.
async function deleteUserData(uid) {
  for (const collection of ["gamesPublic", "gamesPrivate"]) {
    const games = await db
      .collection(collection)
      .where("config.players", "array-contains", uid)
      .limit(1)
      .get();
    if (!games.empty) {
      return false;
    }
  }
  const names = await db.collection("names").where("uid", "==", uid).get();
  await Promise.all(names.docs.map((doc) => doc.ref.delete()));
  return true;
}

module.exports = {
  wrap,
  createGameHandler,
  joinGameHandler,
  insertPlyHandler,
  resignHandler,
  deleteUserData,
};
