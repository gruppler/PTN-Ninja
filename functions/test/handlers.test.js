const test = require("node:test");
const assert = require("node:assert/strict");
const admin = require("firebase-admin");
const { adminDb, context, clearFirestore } = require("./helpers");
const {
  createGameHandler,
  joinGameHandler,
  insertPlyHandler,
  resignHandler,
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

// (Re)create an auth emulator account; registered ones get an email provider
async function makeUser(uid, registered = true) {
  adminDb(); // ensure the admin app is initialized
  const auth = admin.auth();
  await auth.deleteUser(uid).catch(() => {});
  await auth.createUser(
    registered
      ? { uid, email: `${uid}@example.com`, password: "secret123" }
      : { uid }
  );
}

test("createGame stores game and an ownerless root branch", async () => {
  const { id, isPrivate } = await createGameHandler(input(), alice);
  assert.equal(isPrivate, false);
  const db = adminDb();
  const game = await db.doc(`gamesPublic/${id}`).get();
  assert.equal(game.exists, true);
  assert.equal(game.data().state.hasEnded, false);
  assert.equal(game.data().tags.tps, "x3/x3/x3 1 1");
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
  await makeUser("bobUid");
  await adminDb().doc("names/bob").set({ uid: "bobUid" });
  const { id } = await createGameHandler(input({ opponentName: "Bob" }), alice);
  const game = (await adminDb().doc(`gamesPublic/${id}`).get()).data();
  assert.equal(game.config.reservedFor, "bobUid");
});

test("createGame rejects an opponent name held by an unregistered or missing account", async () => {
  await makeUser("guestUid", false);
  await adminDb().doc("names/guest").set({ uid: "guestUid" });
  await adminDb().doc("names/ghost").set({ uid: "ghostUid" });
  for (const opponentName of ["guest", "ghost"]) {
    await assert.rejects(
      createGameHandler(input({ opponentName }), alice),
      (e) => e instanceof GameError && e.message === "Invalid opponent name"
    );
  }
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
  await makeUser("bobUid");
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

// A started game between alice (seat 1) and bob (seat 2)
const startGame = async (tps = "x3/x3/x3 1 3") => {
  const { id } = await createGameHandler({ ...input(), tps }, alice);
  await joinGameHandler({ id, isPrivate: false }, bob);
  return id;
};
const loadGame = async (id) => {
  const ref = adminDb().doc(`gamesPublic/${id}`);
  return {
    game: (await ref.get()).data(),
    root: (await ref.collection("branches").doc("root").get()).data(),
  };
};

test("insertPly appends alternating moves and advances the tps", async () => {
  const id = await startGame();
  assert.deepEqual(
    await insertPlyHandler(
      { id, isPrivate: false, ply: "a1", plyIndex: 0 },
      alice
    ),
    { plyIndex: 1 }
  );
  await insertPlyHandler({ id, isPrivate: false, ply: "b2", plyIndex: 1 }, bob);
  const { game, root } = await loadGame(id);
  assert.ok(Array.isArray(root.plies));
  assert.deepEqual(
    root.plies.map((p) => [p.index, p.ply, p.uid]),
    [
      [0, "a1", "aliceUid"],
      [1, "b2", "bobUid"],
    ]
  );
  assert.equal(game.state.plyIndex, 2);
  assert.equal(game.state.tps, "x3/x,2,x/1,x2 1 4");
  // The starting position stays put
  assert.equal(game.tags.tps, "x3/x3/x3 1 3");
  assert.equal(game.updatedBy, "bobUid");
});

test("insertPly ends the game on a road and refuses further moves", async () => {
  const id = await startGame("1,1,x/x3/x3 1 3");
  await insertPlyHandler(
    { id, isPrivate: false, ply: "c3", plyIndex: 0 },
    alice
  );
  const { game } = await loadGame(id);
  assert.equal(game.state.hasEnded, true);
  assert.equal(game.state.result, "R-0");
  assert.equal(game.tags.result, "R-0");
  await assert.rejects(
    wrap(insertPlyHandler)(
      { id, isPrivate: false, ply: "a1", plyIndex: 1 },
      bob
    ),
    (e) => e.code === "failed-precondition"
  );
});

test("insertPly refuses a stale plyIndex", async () => {
  const id = await startGame();
  await assert.rejects(
    wrap(insertPlyHandler)(
      { id, isPrivate: false, ply: "a1", plyIndex: 3 },
      alice
    ),
    (e) => e.code === "failed-precondition" && e.message === "Out of sync"
  );
  assert.equal((await loadGame(id)).root.plies.length, 0);
});

test("concurrent insertPly calls for the same turn append one ply", async () => {
  const id = await startGame();
  const results = await Promise.allSettled([
    insertPlyHandler({ id, isPrivate: false, ply: "a1", plyIndex: 0 }, alice),
    insertPlyHandler({ id, isPrivate: false, ply: "c1", plyIndex: 0 }, alice),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await loadGame(id)).root.plies.length, 1);
});

test("resign as player 1 records a 0-1 result, and only once", async () => {
  const id = await startGame();
  assert.deepEqual(await resignHandler({ id, isPrivate: false }, alice), {
    result: "0-1",
  });
  const { game } = await loadGame(id);
  assert.equal(game.state.hasEnded, true);
  assert.equal(game.state.result, "0-1");
  assert.equal(game.tags.result, "0-1");
  assert.equal(game.updatedBy, "aliceUid");
  await assert.rejects(
    wrap(resignHandler)({ id, isPrivate: false }, alice),
    (e) => e.code === "failed-precondition"
  );
});
