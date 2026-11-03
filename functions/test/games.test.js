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
const lookupName = async (name) =>
  ({ bob: "bobUid", alice: "aliceUid" }[name.toLowerCase()] || null);

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
const throwsCode = (fn, code) =>
  assert.throws(fn, (e) => e instanceof GameError && e.code === code);

// A started 3x3 game where player 1 (aliceUid) can finish a road with c3
const gameAt = (tps, overrides = {}) => ({
  config: {
    isPrivate: false,
    isOpen: false,
    players: ["aliceUid", "bobUid"],
    ...overrides.config,
  },
  state: { tps, plyIndex: 4, hasEnded: false, result: "", ...overrides.state },
  tags: { size: 3, komi: 0, opening: "swap" },
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
  const { game, root } = await buildNewGame(input(), alice, { lookupName });
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
      { lookupName }
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
    buildNewGame(input({ playerSeat: 3 }), alice, { lookupName }),
    "invalid-argument"
  );
});

test("buildNewGame requires authentication", async () => {
  await rejects(buildNewGame(input(), {}, { lookupName }), "unauthenticated");
});

test("public game from anonymous context is denied", async () => {
  await rejects(
    buildNewGame(input(), guest, { lookupName }),
    "permission-denied"
  );
});

test("private game from a guest uses the supplied name", async () => {
  const { game } = await buildNewGame(
    input({ isPrivate: true, playerName: "  Gus  " }),
    guest,
    { lookupName }
  );
  assert.equal(game.tags.player1, "Gus");
  assert.deepEqual(game.config.players, ["guestUid", null]);
  for (const playerName of ["", "   ", undefined, "x".repeat(31)]) {
    await rejects(
      buildNewGame(input({ isPrivate: true, playerName }), guest, {
        lookupName,
      }),
      "invalid-argument"
    );
  }
});

test("opponentName reserves the open seat for that user", async () => {
  const { game } = await buildNewGame(input({ opponentName: "bob" }), alice, {
    lookupName,
  });
  assert.deepEqual(game.config.players, ["aliceUid", null]);
  assert.equal(game.config.isOpen, true);
  assert.equal(game.config.reservedFor, "bobUid");
  assert.equal(game.tags.player2, "bob");
  await rejects(
    buildNewGame(input({ opponentName: "nobody" }), alice, { lookupName }),
    "invalid-argument"
  );
});

test("buildNewGame rejects reserving the seat for yourself", async () => {
  await rejects(
    buildNewGame(input({ opponentName: "alice" }), alice, { lookupName }),
    "invalid-argument"
  );
});

test("buildNewGame drops unknown config keys and tags", async () => {
  const { game } = await buildNewGame(
    input({ bogus: 1, showRoads: true }, { evil: "x", flats: 10 }),
    alice,
    { lookupName }
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
    { lookupName }
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
      buildNewGame(input({}, { size }), alice, { lookupName }),
      "invalid-argument"
    );
  }
  for (const tps of ["garbage", "", null, "x9/x9/x9/x9/x9/x9/x9/x9/x9 1 1"]) {
    await rejects(
      buildNewGame(input({}, {}, tps), alice, { lookupName }),
      "invalid-argument"
    );
  }
  // TPS grid must match the declared size
  await rejects(
    buildNewGame(input({}, { size: 4 }), alice, { lookupName }),
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

test("checkJoin", () => {
  const open = (extra = {}) => ({
    config: {
      isPrivate: false,
      isOpen: true,
      players: ["aliceUid", null],
      ...extra,
    },
    state: { hasEnded: false },
  });
  const bob = context("bobUid", { name: "bob" });
  assert.deepEqual(checkJoin(open(), bob, undefined), {
    seat: 2,
    playerName: "bob",
  });
  assert.deepEqual(checkJoin(open({ reservedFor: "bobUid" }), bob, undefined), {
    seat: 2,
    playerName: "bob",
  });
  assert.deepEqual(checkJoin(open({ isPrivate: true }), guest, " Gus "), {
    seat: 2,
    playerName: "Gus",
  });
  throwsCode(() => checkJoin(open(), {}, "x"), "unauthenticated");
  throwsCode(() => checkJoin(open(), alice, undefined), "failed-precondition");
  throwsCode(
    () =>
      checkJoin(
        open({ players: ["aliceUid", "bobUid"], isOpen: false }),
        context("carolUid", { name: "carol" })
      ),
    "failed-precondition"
  );
  throwsCode(
    () => checkJoin(open({ reservedFor: "carolUid" }), bob, undefined),
    "permission-denied"
  );
  throwsCode(() => checkJoin(open(), guest, "Gus"), "permission-denied");
  throwsCode(
    () => checkJoin({ ...open(), state: { hasEnded: true } }, bob, undefined),
    "failed-precondition"
  );
  throwsCode(
    () => checkJoin(open({ isPrivate: true }), guest, ""),
    "invalid-argument"
  );
});
