const test = require("node:test");
const assert = require("node:assert/strict");
const { adminDb, context, clearFirestore } = require("./helpers");
const {
  createGameHandler,
  joinGameHandler,
  deleteUserData,
  wrap,
} = require("../lib/handlers");
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

const bob = context("bobUid", { name: "bob" });

test("joinGame seats a second registered user in an open public game", async () => {
  const { id } = await createGameHandler(input(), alice);
  const result = await joinGameHandler({ id, isPrivate: false }, bob);
  assert.deepEqual(result, { seat: 2 });
  const game = (await adminDb().doc(`gamesPublic/${id}`).get()).data();
  assert.deepEqual(game.config.players, ["aliceUid", "bobUid"]);
  assert.equal(game.tags.player2, "bob");
  assert.equal(game.config.isOpen, false);
  assert.equal(game.config.reservedFor, null);
  assert.equal(game.updatedBy, "bobUid");
  assert.ok(game.updatedAt);
});

test("joinGame refuses guests in public games", async () => {
  const { id } = await createGameHandler(input(), alice);
  const guest = context("guestUid", { anonymous: true });
  await assert.rejects(
    joinGameHandler({ id, isPrivate: false, playerName: "G" }, guest),
    GameError
  );
});

test("joinGame lets a guest join a private game with a trimmed name", async () => {
  const { id } = await createGameHandler(
    input({ isPrivate: true, playerName: "Al" }),
    alice
  );
  const guest = context("guestUid", { anonymous: true });
  await joinGameHandler({ id, isPrivate: true, playerName: "  Gus  " }, guest);
  const game = (await adminDb().doc(`gamesPrivate/${id}`).get()).data();
  assert.equal(game.tags.player2, "Gus");
});

test("joinGame honors reserved seats", async () => {
  await adminDb().doc("names/bob").set({ uid: "bobUid" });
  const { id } = await createGameHandler(input({ opponentName: "bob" }), alice);
  const carol = context("carolUid", { name: "carol" });
  await assert.rejects(
    joinGameHandler({ id, isPrivate: false }, carol),
    GameError
  );
  assert.deepEqual(await joinGameHandler({ id, isPrivate: false }, bob), {
    seat: 2,
  });
});

test("joinGame rejects missing games", async () => {
  await assert.rejects(
    joinGameHandler({ id: "nope", isPrivate: false }, bob),
    GameError
  );
});

test("concurrent joins fill the seat exactly once", async () => {
  const { id } = await createGameHandler(input(), alice);
  const carol = context("carolUid", { name: "carol" });
  const results = await Promise.allSettled([
    joinGameHandler({ id, isPrivate: false }, bob),
    joinGameHandler({ id, isPrivate: false }, carol),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  const game = (await adminDb().doc(`gamesPublic/${id}`).get()).data();
  assert.equal(game.config.players.filter(Boolean).length, 2);
});

test("deleteUserData reports games in either collection and keeps the name", async () => {
  const db = adminDb();
  await db.doc("names/carol").set({ uid: "carolUid" });
  await db
    .doc("gamesPrivate/g1")
    .set({ config: { players: ["carolUid", null] } });
  assert.equal(await deleteUserData("carolUid"), false);
  assert.equal((await db.doc("names/carol").get()).exists, true);
});

test("deleteUserData removes the name doc when the user has no games", async () => {
  const db = adminDb();
  await db.doc("names/carol").set({ uid: "carolUid" });
  await db.doc("names/bob").set({ uid: "bobUid" });
  assert.equal(await deleteUserData("carolUid"), true);
  assert.equal((await db.doc("names/carol").get()).exists, false);
  assert.equal((await db.doc("names/bob").get()).exists, true);
});
