const test = require("node:test");
const assert = require("node:assert/strict");
const { adminDb, context, clearFirestore } = require("./helpers");
const { createGameHandler, wrap } = require("../lib/handlers");
const { GameError } = require("../lib/games");

const alice = context("aliceUid", { name: "alice" });

const input = (config = {}) => ({
  config: { isPrivate: false, playerSeat: 1, ...config },
  tags: { size: 3, komi: 0, opening: "swap" },
  tps: "x3/x3/x3 1 1",
});

test.beforeEach(clearFirestore);

test("createGame stores game and an ownerless root branch", async () => {
  const { id, isPrivate } = await createGameHandler(input(), alice);
  assert.equal(isPrivate, false);
  const db = adminDb();
  const game = await db.doc(`gamesPublic/${id}`).get();
  assert.equal(game.exists, true);
  assert.equal(game.data().state.hasEnded, false);
  const root = await db.doc(`gamesPublic/${id}/branches/root`).get();
  assert.equal(root.data().uid, null);
  assert.deepEqual(root.data().plies, []);
});

test("createGame stores private games in gamesPrivate", async () => {
  const { id, isPrivate } = await createGameHandler(
    input({ isPrivate: true, playerName: "Al" }),
    alice
  );
  assert.equal(isPrivate, true);
  assert.equal((await adminDb().doc(`gamesPrivate/${id}`).get()).exists, true);
});

test("createGame resolves the opponent name via names/", async () => {
  await adminDb().doc("names/bob").set({ uid: "bobUid" });
  const { id } = await createGameHandler(input({ opponentName: "Bob" }), alice);
  const game = (await adminDb().doc(`gamesPublic/${id}`).get()).data();
  assert.equal(game.config.reservedFor, "bobUid");
});

test("wrap converts GameError to HttpsError", async () => {
  await assert.rejects(
    wrap(createGameHandler)(input(), { auth: null }),
    (e) =>
      e.code === "unauthenticated" && e.message === "Sign in to play online"
  );
  await assert.rejects(
    wrap(async () => {
      throw new Error("boom");
    })({}, alice),
    (e) => !(e instanceof GameError) && e.message === "boom"
  );
});
