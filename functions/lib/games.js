// Pure rules for online games. No Firestore access: callers pass plain
// game/branch data and write the returned updates themselves.

class GameError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "GameError";
    this.code = code;
  }
}

const { parsePly } = require("./ply");

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

// A registered user's name is the one their account holds: the display name
// in their ID token, which must be the name they registered (names/{lower
// case name} holds their uid). `nameOwner(name)` resolves a name's uid.
const accountName = async (context, { nameOwner }) => {
  const name = context.auth.token.name;
  if (typeof name !== "string" || !name.trim()) {
    throw new GameError("failed-precondition", "Account has no display name");
  }
  const trimmed = name.trim();
  if ((await nameOwner(trimmed)) !== context.auth.uid) {
    throw new GameError(
      "failed-precondition",
      "Account name is not registered"
    );
  }
  return trimmed;
};

// Name shown for the user in a game
const displayName = (context, suppliedName, deps) =>
  isRegistered(context)
    ? accountName(context, deps)
    : Promise.resolve(guestName(suppliedName));

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

// Limits match the client's game info form (src/Game/PTN/Tag.js and
// src/components/controls/GameInfo.vue)
const KOMI_MIN = -20.5;
const KOMI_MAX = 20.5;
const MAX_FLATS = 99;
// The client's openings (src/i18n/en-us/index.js `openings`)
const OPENINGS = ["swap", "no-swap", "double black stack"];
// A full 8x8 board of tall stacks fits well within this
const MAX_TPS_LENGTH = 2000;

const invalidTag = (key) => new GameError("invalid-argument", `Invalid ${key}`);

// A number given as a number or a numeric string
const numberOf = (value) => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() && value.length <= 10) {
    return Number(value);
  }
  return NaN;
};

// The setup tags, validated and normalized. Size is checked with the TPS.
function setupTags(clientTags) {
  const tags = {};
  SETUP_TAGS.forEach((key) => {
    const value = clientTags[key];
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (key === "size") {
      tags.size = value;
    } else if (key === "komi") {
      const komi = numberOf(value);
      if (
        !Number.isFinite(komi) ||
        komi < KOMI_MIN ||
        komi > KOMI_MAX ||
        !Number.isInteger(komi * 2)
      ) {
        throw invalidTag(key);
      }
      tags.komi = komi;
    } else if (key === "opening") {
      const opening = typeof value === "string" ? value.toLowerCase() : "";
      if (!OPENINGS.includes(opening)) {
        throw invalidTag(key);
      }
      tags.opening = opening;
    } else {
      // flats, caps and their per-player variants
      const count = numberOf(value);
      const max = key.startsWith("caps") ? 8 : MAX_FLATS;
      if (!Number.isInteger(count) || count < 0 || count > max) {
        throw invalidTag(key);
      }
      tags[key] = count;
    }
  });
  return tags;
}

// deps: `lookupName(name)` resolves a registered opponent's { uid, name } (or
// null), `nameOwner(name)` the uid holding a name (or null)
async function buildNewGame(input, context, deps) {
  const { lookupName } = deps;
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

  const playerName = await displayName(context, clientConfig.playerName, deps);

  const config = { isPrivate };
  UI_OPTIONS.forEach((key) => {
    if (key in clientConfig) {
      config[key] = !!clientConfig[key];
    }
  });
  config.players = [null, null];
  config.players[seat - 1] = uid;
  config.isOpen = true;

  const tags = setupTags(clientTags);
  tags[`player${seat}`] = playerName;
  tags[`player${opponentSeat}`] = "";

  const opponentName =
    typeof clientConfig.opponentName === "string"
      ? clientConfig.opponentName.trim()
      : "";
  if (opponentName) {
    if (opponentName.length > 30) {
      throw new GameError("invalid-argument", "Invalid opponent name");
    }
    const opponent = await lookupName(opponentName);
    if (!opponent) {
      throw new GameError("invalid-argument", "Invalid opponent name");
    }
    if (opponent.uid === uid) {
      throw new GameError("invalid-argument", "You can't invite yourself");
    }
    config.reservedFor = opponent.uid;
    // As the opponent's account spells it
    tags[`player${opponentSeat}`] = opponent.name;
  }

  // Validate board options and starting position
  const size = Number(tags.size);
  if (!Number.isInteger(size) || size < 3 || size > 8) {
    throw new GameError("invalid-argument", "Board size must be 3-8");
  }
  ["caps", "caps1", "caps2"].forEach((key) => {
    if (key in tags && tags[key] > size) {
      throw invalidTag(key);
    }
  });
  if (typeof tps !== "string" || !tps.trim()) {
    throw new GameError("invalid-argument", "Missing TPS");
  }
  if (tps.length > MAX_TPS_LENGTH) {
    throw new GameError("invalid-argument", "TPS is too long");
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
  if (board.isGameEnd) {
    throw new GameError(
      "invalid-argument",
      "The starting position has already ended"
    );
  }
  tags.size = size;
  // The starting position, as a PTN tag: state.tps moves on with each ply
  tags.tps = tps;

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

const DIRECTIONS = { "+": [0, 1], "-": [0, -1], ">": [1, 0], "<": [-1, 0] };

// The square a move's last drop lands on, if it's on the board
const targetSquare = (board, { square, direction, distribution }) => {
  const [dx, dy] = DIRECTIONS[direction];
  const steps = distribution.length;
  const x = "abcdefgh".indexOf(square[0]) + dx * steps;
  const y = Number(square[1]) - 1 + dy * steps;
  return (board.squares[y] && board.squares[y][x]) || null;
};

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
  let parsed;
  try {
    parsed = parsePly(ply);
  } catch (error) {
    throw new GameError("invalid-argument", error.message);
  }

  let board;
  let smashes = false;
  try {
    board = new Board({ ...game.config, ...game.tags, tps: game.state.tps });
    if (board.errors.length) {
      throw new Error(board.errors.join(", "));
    }
    if (parsed.isMovement) {
      // A move onto a wall can only be a smash
      const target = targetSquare(board, parsed);
      smashes = !!(target && target.piece && target.piece.isStanding);
      if (parsed.hasSmashMark && !smashes) {
        throw new Error("Nothing to smash");
      }
    }
    board.doPly(parsed.canonical);
  } catch (error) {
    throw new GameError(
      "invalid-argument",
      `Invalid ply: ${error.message || error}`
    );
  }
  // Store the ply as the client writes it, not as it was sent
  ply = parsed.canonical + (smashes ? "*" : "");

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

async function checkJoin(game, context, name, deps) {
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
  return {
    seat: index + 1,
    playerName: await displayName(context, name, deps),
  };
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
