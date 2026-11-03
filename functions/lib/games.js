// Pure rules for online games. No Firestore access: callers pass plain
// game/branch data and write the returned updates themselves.

class GameError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "GameError";
    this.code = code;
  }
}

let takPromise;
// tps-ninja is ESM; load it once
const loadTak = () => {
  if (!takPromise) {
    takPromise = import("tps-ninja/src/Board.js").then(
      ({ Board, parseTPS }) => ({ Board, parseTPS })
    );
  }
  return takPromise;
};

const collectionFor = (isPrivate) =>
  isPrivate ? "gamesPrivate" : "gamesPublic";

const seatOf = (game, uid) => {
  const players = (game && game.config && game.config.players) || [];
  return uid ? players.indexOf(uid) + 1 : 0;
};

const isRegistered = (context) =>
  !!(
    context &&
    context.auth &&
    context.auth.token &&
    (context.auth.token.firebase || {}).sign_in_provider !== "anonymous"
  );

// Result when the given seat resigns
const resignResult = (seat) => (seat === 1 ? "0-1" : "1-0");

const requireUid = (context) => {
  const uid = context && context.auth && context.auth.uid;
  if (!uid) {
    throw new GameError("unauthenticated", "Sign in to play online");
  }
  return uid;
};

const guestName = (name) => {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed || trimmed.length > 30) {
    throw new GameError("invalid-argument", "Name must be 1-30 characters");
  }
  return trimmed;
};

const accountName = (context) => {
  const name = context.auth.token.name;
  if (typeof name !== "string" || !name.trim()) {
    throw new GameError("failed-precondition", "Account has no display name");
  }
  return name.trim();
};

// Name shown for the user in a game
const displayName = (context, suppliedName) =>
  isRegistered(context) ? accountName(context) : guestName(suppliedName);

// Only these client-supplied keys are kept
const UI_OPTIONS = ["scratchboard", "showRoads", "flatCounts", "stackCounts"];
const SETUP_TAGS = [
  "size",
  "komi",
  "opening",
  "flats",
  "caps",
  "flats1",
  "caps1",
  "flats2",
  "caps2",
];

async function buildNewGame(input, context, { lookupName }) {
  const uid = requireUid(context);
  const { Board, parseTPS } = await loadTak();
  const clientConfig = (input && input.config) || {};
  const clientTags = (input && input.tags) || {};
  const tps = input && input.tps;
  const isPrivate = !!clientConfig.isPrivate;

  if (!isPrivate && !isRegistered(context)) {
    throw new GameError(
      "permission-denied",
      "Sign in with an account to create a public game"
    );
  }

  let seat = clientConfig.playerSeat;
  if (seat === "random") {
    seat = Math.random() < 0.5 ? 1 : 2;
  }
  if (seat !== 1 && seat !== 2) {
    throw new GameError("invalid-argument", "Invalid player seat");
  }
  const opponentSeat = seat === 1 ? 2 : 1;

  const playerName = displayName(context, clientConfig.playerName);

  const config = { isPrivate };
  UI_OPTIONS.forEach((key) => {
    if (key in clientConfig) {
      config[key] = !!clientConfig[key];
    }
  });
  config.players = [null, null];
  config.players[seat - 1] = uid;
  config.isOpen = true;

  const tags = {};
  SETUP_TAGS.forEach((key) => {
    if (clientTags[key] !== undefined && clientTags[key] !== null) {
      tags[key] = clientTags[key];
    }
  });
  tags[`player${seat}`] = playerName;
  tags[`player${opponentSeat}`] = "";

  const opponentName =
    typeof clientConfig.opponentName === "string"
      ? clientConfig.opponentName.trim()
      : "";
  if (opponentName) {
    const opponentUid = await lookupName(opponentName);
    if (!opponentUid) {
      throw new GameError("invalid-argument", "Invalid opponent name");
    }
    if (opponentUid === uid) {
      throw new GameError("invalid-argument", "You can't invite yourself");
    }
    config.reservedFor = opponentUid;
    tags[`player${opponentSeat}`] = opponentName;
  }

  // Validate board options and starting position
  const size = Number(tags.size);
  if (!Number.isInteger(size) || size < 3 || size > 8) {
    throw new GameError("invalid-argument", "Board size must be 3-8");
  }
  if (typeof tps !== "string" || !tps.trim()) {
    throw new GameError("invalid-argument", "Missing TPS");
  }
  const parsed = parseTPS(tps);
  if (parsed.error || parsed.size !== size) {
    throw new GameError("invalid-argument", "Invalid TPS for this board size");
  }
  let board;
  try {
    board = new Board({ ...config, ...tags, size, tps });
  } catch (error) {
    throw new GameError("invalid-argument", error.message || String(error));
  }
  if (board.errors.length) {
    throw new GameError("invalid-argument", board.errors.join(", "));
  }
  tags.size = size;

  const now = new Date();
  const game = {
    name: "",
    config,
    state: { tps, plyIndex: 0, hasEnded: false, result: "" },
    tags,
    createdBy: uid,
    createdAt: now,
    updatedBy: uid,
    updatedAt: now,
  };
  const root = {
    parent: null,
    name: "root",
    uid: null,
    plies: [],
    createdAt: now,
    updatedAt: now,
  };
  return { game, root };
}

async function applyPly(game, root, ply, uid) {
  const { Board, parseTPS } = await loadTak();
  const players = game.config.players || [];

  if (game.state.hasEnded) {
    throw new GameError("failed-precondition", "Game has already ended");
  }
  if (players.length < 2 || players.includes(null)) {
    throw new GameError("failed-precondition", "Waiting for an opponent");
  }
  const seat = seatOf(game, uid);
  if (!seat) {
    throw new GameError("permission-denied", "Not a player in this game");
  }
  if (parseTPS(game.state.tps).player !== seat) {
    throw new GameError("permission-denied", "Not your turn");
  }
  if (typeof ply !== "string" || !ply.trim()) {
    throw new GameError("invalid-argument", "Invalid ply");
  }

  let board;
  try {
    board = new Board({ ...game.config, ...game.tags, tps: game.state.tps });
    if (board.errors.length) {
      throw new Error(board.errors.join(", "));
    }
    board.doPly(ply);
  } catch (error) {
    throw new GameError(
      "invalid-argument",
      `Invalid ply: ${error.message || error}`
    );
  }

  const now = new Date();
  const gameUpdate = {
    "state.tps": board.getTPS(),
    "state.plyIndex": game.state.plyIndex + 1,
    "state.hasEnded": !!board.isGameEnd,
    updatedAt: now,
    updatedBy: uid,
  };
  if (board.isGameEnd) {
    gameUpdate["state.result"] = board.result;
    gameUpdate["tags.result"] = board.result;
  }
  const rootUpdate = {
    plies: [
      ...root.plies,
      { index: root.plies.length, ply, uid, createdAt: now, updatedAt: now },
    ],
    updatedAt: now,
  };
  return { gameUpdate, rootUpdate };
}

function checkJoin(game, context, name) {
  const uid = requireUid(context);
  const { isPrivate, players = [], reservedFor } = game.config;

  if (game.state.hasEnded) {
    throw new GameError("failed-precondition", "Game has already ended");
  }
  if (seatOf(game, uid)) {
    throw new GameError("failed-precondition", "Already joined");
  }
  const index = players.indexOf(null);
  if (index === -1) {
    throw new GameError("failed-precondition", "No open seats");
  }
  if (reservedFor && reservedFor !== uid) {
    throw new GameError("permission-denied", "This seat is reserved");
  }
  if (!isPrivate && !isRegistered(context)) {
    throw new GameError(
      "permission-denied",
      "Sign in with an account to join a public game"
    );
  }
  return { seat: index + 1, playerName: displayName(context, name) };
}

module.exports = {
  GameError,
  loadTak,
  collectionFor,
  seatOf,
  isRegistered,
  resignResult,
  buildNewGame,
  applyPly,
  checkJoin,
};
