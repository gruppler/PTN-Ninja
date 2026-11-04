const test = require("node:test");
const assert = require("node:assert/strict");
const { context } = require("./helpers");
const games = require("../lib/games");

const {
  GameError,
  collectionFor,
  seatOf,
  isRegistered,
  resignResult,
  buildNewGame,
  applyPly,
  checkJoin,
} = games;

const TPS3 = "x3/x3/x3 1 1";
const alice = context("aliceUid", { name: "alice" });
const guest = context("guestUid", { anonymous: true });
// Registered names and their accounts' spellings
const NAMES = {
  alice: { uid: "aliceUid", name: "alice" },
  bob: { uid: "bobUid", name: "Bob" },
};
const lookupName = async (name) => NAMES[name.trim().toLowerCase()] || null;
const nameOwner = async (name) => {
  const entry = NAMES[name.trim().toLowerCase()];
  return entry ? entry.uid : null;
};
const deps = { lookupName, nameOwner };

const input = (config = {}, tags = {}, tps = TPS3) => ({
  config: { isPrivate: false, playerSeat: 1, ...config },
  tags: { size: 3, komi: 0, opening: "swap", ...tags },
  tps,
});

const rejects = (promiseOrFn, code) =>
  assert.rejects(
    async () =>
      typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn,
    (e) => e instanceof GameError && e.code === code
  );

// A started 3x3 game where player 1 (aliceUid) can finish a road with c3
const gameAt = (tps, overrides = {}) => ({
  config: {
    isPrivate: false,
    isOpen: false,
    players: ["aliceUid", "bobUid"],
    ...overrides.config,
  },
  state: { tps, plyIndex: 4, hasEnded: false, result: "", ...overrides.state },
  tags: { size: 3, komi: 0, opening: "swap", ...overrides.tags },
});
const rootOf = (n = 4) => ({
  parent: null,
  name: "root",
  uid: null,
  plies: Array.from({ length: n }, (_, index) => ({
    index,
    ply: "a1",
    uid: "x",
  })),
});

test("small helpers", () => {
  assert.equal(collectionFor(true), "gamesPrivate");
  assert.equal(collectionFor(false), "gamesPublic");
  assert.equal(seatOf({ config: { players: ["a", "b"] } }, "a"), 1);
  assert.equal(seatOf({ config: { players: ["a", "b"] } }, "b"), 2);
  assert.equal(seatOf({ config: { players: ["a", null] } }, "z"), 0);
  assert.equal(isRegistered(alice), true);
  assert.equal(isRegistered(guest), false);
  assert.equal(resignResult(1), "0-1");
  assert.equal(resignResult(2), "1-0");
});

test("buildNewGame seats the creator and opens the other seat", async () => {
  const { game, root } = await buildNewGame(input(), alice, deps);
  assert.deepEqual(game.config.players, ["aliceUid", null]);
  assert.equal(game.config.isOpen, true);
  assert.deepEqual(game.state, {
    tps: TPS3,
    plyIndex: 0,
    hasEnded: false,
    result: "",
  });
  assert.equal(game.tags.player1, "alice");
  // The starting position, kept as a PTN tag after state.tps moves on
  assert.equal(game.tags.tps, TPS3);
  assert.equal(game.createdBy, "aliceUid");
  assert.equal(game.updatedBy, "aliceUid");
  assert.ok(game.createdAt instanceof Date);
  assert.ok(game.updatedAt instanceof Date);
  const { createdAt, updatedAt, ...rest } = root;
  assert.deepEqual(rest, {
    parent: null,
    name: "root",
    uid: null,
    plies: [],
  });
  assert.ok(createdAt instanceof Date && updatedAt instanceof Date);
});

test("buildNewGame random seat", async () => {
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const { game } = await buildNewGame(
      input({ playerSeat: "random" }),
      alice,
      deps
    );
    const seat = game.config.players.indexOf("aliceUid") + 1;
    assert.ok(seat === 1 || seat === 2);
    assert.equal(game.config.players[seat === 1 ? 1 : 0], null);
    seen.add(seat);
  }
  assert.equal(seen.size, 2);
});

test("buildNewGame rejects bad seat values", async () => {
  await rejects(
    buildNewGame(input({ playerSeat: 3 }), alice, deps),
    "invalid-argument"
  );
});

test("buildNewGame requires authentication", async () => {
  await rejects(buildNewGame(input(), {}, deps), "unauthenticated");
});

test("public game from anonymous context is denied", async () => {
  await rejects(buildNewGame(input(), guest, deps), "permission-denied");
});

test("private game from a guest uses the supplied name", async () => {
  const { game } = await buildNewGame(
    input({ isPrivate: true, playerName: "  Gus  " }),
    guest,
    deps
  );
  assert.equal(game.tags.player1, "Gus");
  assert.deepEqual(game.config.players, ["guestUid", null]);
  for (const playerName of ["", "   ", undefined, "x".repeat(31)]) {
    await rejects(
      buildNewGame(input({ isPrivate: true, playerName }), guest, deps),
      "invalid-argument"
    );
  }
});

test("opponentName reserves the open seat for that user", async () => {
  const { game } = await buildNewGame(
    input({ opponentName: "bob" }),
    alice,
    deps
  );
  assert.deepEqual(game.config.players, ["aliceUid", null]);
  assert.equal(game.config.isOpen, true);
  assert.equal(game.config.reservedFor, "bobUid");
  // As the opponent's account spells it
  assert.equal(game.tags.player2, "Bob");
  await rejects(
    buildNewGame(input({ opponentName: "nobody" }), alice, deps),
    "invalid-argument"
  );
});

test("buildNewGame rejects reserving the seat for yourself", async () => {
  await rejects(
    buildNewGame(input({ opponentName: "alice" }), alice, deps),
    "invalid-argument"
  );
});

test("buildNewGame drops unknown config keys and tags", async () => {
  const { game } = await buildNewGame(
    input({ bogus: 1, showRoads: true }, { evil: "x", flats: 10 }),
    alice,
    deps
  );
  assert.equal(game.config.bogus, undefined);
  assert.equal(game.config.showRoads, true);
  assert.equal(game.tags.evil, undefined);
  assert.equal(game.tags.flats, 10);
});

test("buildNewGame ignores client-controlled server fields", async () => {
  const { game } = await buildNewGame(
    {
      config: {
        isPrivate: false,
        playerSeat: 2,
        players: ["evil", "evil2"],
        isOpen: false,
        reservedFor: "evil",
        scratchboard: true,
      },
      tags: {
        size: 3,
        komi: 0,
        opening: "swap",
        result: "1-0",
        date: "x",
        tps: "x3/x3/x3 2 5",
      },
      state: { hasEnded: true, result: "1-0", plyIndex: 9, tps: "bad" },
      tps: TPS3,
    },
    alice,
    deps
  );
  assert.deepEqual(game.config.players, [null, "aliceUid"]);
  assert.equal(game.config.isOpen, true);
  assert.equal(game.config.reservedFor, undefined);
  assert.equal(game.config.scratchboard, true);
  assert.equal(game.state.hasEnded, false);
  assert.equal(game.state.plyIndex, 0);
  assert.equal(game.state.tps, TPS3);
  assert.equal(game.tags.tps, TPS3);
  assert.equal(game.tags.result, undefined);
  assert.equal(game.tags.date, undefined);
  assert.equal(game.tags.player2, "alice");
});

test("buildNewGame validates size and TPS", async () => {
  for (const size of [2, 9, "abc", undefined]) {
    await rejects(
      buildNewGame(input({}, { size }), alice, deps),
      "invalid-argument"
    );
  }
  for (const tps of ["garbage", "", null, "x9/x9/x9/x9/x9/x9/x9/x9/x9 1 1"]) {
    await rejects(
      buildNewGame(input({}, {}, tps), alice, deps),
      "invalid-argument"
    );
  }
  // TPS grid must match the declared size
  await rejects(
    buildNewGame(input({}, { size: 4 }), alice, deps),
    "invalid-argument"
  );
});

test("applyPly precondition and permission errors", async () => {
  await rejects(
    () => applyPly(gameAt("x3/x3/x3 1 3"), rootOf(), "a1", "bobUid"),
    "permission-denied"
  );
  await rejects(
    () => applyPly(gameAt("x3/x3/x3 1 3"), rootOf(), "a1", "strangerUid"),
    "permission-denied"
  );
  await rejects(
    () => applyPly(gameAt("x3/x3/x3 1 3"), rootOf(), "zz9", "aliceUid"),
    "invalid-argument"
  );
  // parseable but illegal: square already occupied
  await rejects(
    () => applyPly(gameAt("x3/x3/1,x2 1 3"), rootOf(), "a1", "aliceUid"),
    "invalid-argument"
  );
  await rejects(
    () =>
      applyPly(
        gameAt("x3/x3/x3 1 3", { state: { hasEnded: true, result: "R-0" } }),
        rootOf(),
        "a1",
        "aliceUid"
      ),
    "failed-precondition"
  );
  await rejects(
    () =>
      applyPly(
        gameAt("x3/x3/x3 1 3", {
          config: { players: ["aliceUid", null], isOpen: true },
        }),
        rootOf(),
        "a1",
        "aliceUid"
      ),
    "failed-precondition"
  );
});

test("applyPly appends a legal move", async () => {
  const { gameUpdate, rootUpdate } = await applyPly(
    gameAt("x3/x3/x3 1 3"),
    rootOf(4),
    "a1",
    "aliceUid"
  );
  assert.equal(rootUpdate.plies.length, 5);
  assert.deepEqual(
    (({ index, ply, uid }) => ({ index, ply, uid }))(rootUpdate.plies[4]),
    { index: 4, ply: "a1", uid: "aliceUid" }
  );
  assert.equal(gameUpdate["state.plyIndex"], 5);
  assert.equal(gameUpdate["state.tps"], "x3/x3/1,x2 2 3");
  assert.equal(gameUpdate["state.hasEnded"], false);
  assert.equal(gameUpdate["tags.result"], undefined);
  assert.equal(gameUpdate.updatedBy, "aliceUid");
  assert.ok(gameUpdate.updatedAt instanceof Date);
  assert.ok(rootUpdate.updatedAt instanceof Date);
});

test("applyPly records a game-ending result", async () => {
  const { gameUpdate } = await applyPly(
    gameAt("1,1,x/x3/x3 1 3"),
    rootOf(),
    "c3",
    "aliceUid"
  );
  assert.equal(gameUpdate["state.hasEnded"], true);
  assert.equal(gameUpdate["state.result"], "R-0");
  assert.equal(gameUpdate["tags.result"], "R-0");
});

test("checkJoin", async () => {
  const open = (extra = {}) => ({
    config: {
      isPrivate: false,
      isOpen: true,
      players: ["aliceUid", null],
      ...extra,
    },
    state: { hasEnded: false },
  });
  const bob = context("bobUid", { name: "Bob" });
  assert.deepEqual(await checkJoin(open(), bob, undefined, deps), {
    seat: 2,
    playerName: "Bob",
  });
  assert.deepEqual(
    await checkJoin(open({ reservedFor: "bobUid" }), bob, undefined, deps),
    { seat: 2, playerName: "Bob" }
  );
  assert.deepEqual(
    await checkJoin(open({ isPrivate: true }), guest, " Gus ", deps),
    { seat: 2, playerName: "Gus" }
  );
  await rejects(() => checkJoin(open(), {}, "x", deps), "unauthenticated");
  await rejects(
    () => checkJoin(open(), alice, undefined, deps),
    "failed-precondition"
  );
  await rejects(
    () =>
      checkJoin(
        open({ players: ["aliceUid", "bobUid"], isOpen: false }),
        context("carolUid", { name: "carol" }),
        undefined,
        deps
      ),
    "failed-precondition"
  );
  await rejects(
    () => checkJoin(open({ reservedFor: "carolUid" }), bob, undefined, deps),
    "permission-denied"
  );
  await rejects(
    () => checkJoin(open(), guest, "Gus", deps),
    "permission-denied"
  );
  await rejects(
    () =>
      checkJoin({ ...open(), state: { hasEnded: true } }, bob, undefined, deps),
    "failed-precondition"
  );
  await rejects(
    () => checkJoin(open({ isPrivate: true }), guest, "", deps),
    "invalid-argument"
  );
});

test("a registered player's name must be the one their account registered", async () => {
  const open = {
    config: { isPrivate: false, isOpen: true, players: ["aliceUid", null] },
    state: { hasEnded: false },
  };
  // A display name nobody registered, one registered to someone else, and
  // none at all
  for (const name of ["Robert", "alice", undefined]) {
    const impostor = context("bobUid", { name });
    await rejects(
      () => checkJoin(open, impostor, undefined, deps),
      "failed-precondition"
    );
    await rejects(buildNewGame(input(), impostor, deps), "failed-precondition");
  }
});

test("buildNewGame validates setup tags", async () => {
  const bad = [
    { komi: 21 },
    { komi: -21 },
    { komi: 0.25 },
    { komi: "abc" },
    { komi: true },
    { komi: "1".repeat(11) },
    { opening: "whatever" },
    { opening: 3 },
    { flats: -1 },
    { flats: 100 },
    { flats: 1.5 },
    { flats: "lots" },
    { caps: 4 }, // more than the board size
    { caps1: -1 },
    { flats2: 1000 },
    { caps2: 9 },
  ];
  for (const tags of bad) {
    await rejects(
      buildNewGame(input({}, tags), alice, deps),
      "invalid-argument"
    );
  }
  const { game } = await buildNewGame(
    input(
      {},
      {
        komi: "2.5",
        opening: "No-Swap",
        flats: "8",
        caps: 1,
        flats1: 9,
        caps2: 0,
      }
    ),
    alice,
    deps
  );
  assert.equal(game.tags.komi, 2.5);
  assert.equal(game.tags.opening, "no-swap");
  assert.equal(game.tags.flats, 8);
  assert.equal(game.tags.caps, 1);
  assert.equal(game.tags.flats1, 9);
  assert.equal(game.tags.caps2, 0);
  const { game: negative } = await buildNewGame(
    input({}, { komi: -20.5, opening: "double black stack" }),
    alice,
    deps
  );
  assert.equal(negative.tags.komi, -20.5);
  assert.equal(negative.tags.opening, "double black stack");
});

test("buildNewGame rejects a starting position that has already ended", async () => {
  // A finished road for player 1, a full board, and too long a TPS
  for (const tps of [
    "1,1,1/x3/x3 2 2",
    "1,2,1/2,1,2/1,2,1 1 5",
    "x3/x3/x3 1 1" + " ".repeat(2000),
  ]) {
    await rejects(
      buildNewGame(input({}, {}, tps), alice, deps),
      "invalid-argument"
    );
  }
});

// The client's ply grammar (src/Game/PTN/ptn.js), anchored: every stored
// ply must parse completely with it
const CLIENT_PLY = /^(\d)?([CS])?([a-h])([1-8])(([<>+-])([1-8]+)?(\*)?)?$/i;

test("applyPly rejects anything but one well-formed ply", async () => {
  for (const ply of [
    "hello a1 world",
    "{comment} b2 c3",
    "a1" + "x".repeat(30),
    "a1x",
    "Fa1",
    "a1 b2",
    "2a1", // a count on a placement
    "Ca1+", // a stone type on a move
    "a1+2", // drops that don't add up
    "2a1+1", // drops that don't add up
    "a1+0",
    "a9",
    "i1",
    "",
    "   ",
    null,
    42,
    { ply: "a1" },
    "a1" + " ".repeat(30) + "!",
  ]) {
    await rejects(
      () => applyPly(gameAt("x3/x3/x3 1 3"), rootOf(), ply, "aliceUid"),
      "invalid-argument"
    );
  }
});

test("applyPly stores the canonical ply", async () => {
  const cases = [
    // [tps, sent, stored]
    ["x3/x3/x3 1 3", " A1 ", "a1"],
    ["x3/x3/x3 1 3", "sb2", "Sb2"],
    ["x3/x3/x3 1 3", "c1!?", "c1"],
    ["x3/x3/1,x2 1 3", "1a1+1", "a1+"],
    ["x3/x3/1,x2 1 3", "a1>", "a1>"],
    ["x3/x3/21,x2 1 3", "2a1>11", "2a1>11"],
    ["x3/x3/21,x2 1 3", "2a1>2", "2a1>"],
    // A capstone flattening a wall: the smash mark is added, whether sent
    // or not
    ["x5/x5/x5/x5/1C,2S,x3 1 3", "a1>", "a1>*"],
    ["x5/x5/x5/x5/1C,2S,x3 1 3", "a1>*", "a1>*"],
  ];
  for (const [tps, sent, stored] of cases) {
    const size = tps.split("/").length;
    const { rootUpdate } = await applyPly(
      gameAt(tps, { tags: { size } }),
      rootOf(),
      sent,
      "aliceUid"
    );
    const { ply } = rootUpdate.plies[rootUpdate.plies.length - 1];
    assert.equal(ply, stored, `${sent} on ${tps}`);
    assert.match(ply, CLIENT_PLY);
  }
});

test("applyPly refuses a smash mark when nothing is smashed", async () => {
  await rejects(
    () =>
      applyPly(
        gameAt("x5/x5/x5/x5/1C,x4 1 3", { tags: { size: 5 } }),
        rootOf(),
        "a1>*",
        "aliceUid"
      ),
    "invalid-argument"
  );
});
