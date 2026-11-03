// Firestore/transaction layer for online games. Rules live in ./games.

const admin = require("firebase-admin");
const functions = require("firebase-functions");
const { GameError, collectionFor, buildNewGame } = require("./games");

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

const lookupName = async (name) => {
  const snapshot = await db
    .collection("names")
    .doc(name.trim().toLowerCase())
    .get();
  return snapshot.exists ? snapshot.data().uid || null : null;
};

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
  const { game, root } = await buildNewGame(data, context, { lookupName });
  const isPrivate = !!game.config.isPrivate;
  const gameRef = db.collection(collectionFor(isPrivate)).doc();
  const batch = db.batch();
  batch.set(gameRef, stripUndefined(game));
  batch.set(gameRef.collection("branches").doc("root"), stripUndefined(root));
  await batch.commit();
  return { id: gameRef.id, isPrivate };
}

module.exports = { wrap, createGameHandler };
