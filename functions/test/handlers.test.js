const test = require("node:test");
const assert = require("node:assert/strict");
const admin = require("firebase-admin");
const { adminDb, context, clearFirestore } = require("./helpers");
const {
  createGameHandler,
  joinGameHandler,
  insertPlyHandler,
  resignHandler,
  makeRequestHandler,
  withdrawRequestHandler,
  acceptRequestHandler,
  declineRequestHandler,
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

// Registered players' names, as REGISTER writes them
test.beforeEach(async () => {
  await clearFirestore();
  const db = adminDb();
  await Promise.all(
    ["alice", "bob", "carol"].map((name) =>
      db.doc(`names/${name}`).set({ uid: `${name}Uid` })
    )
  );
});

// (Re)create an auth emulator account; registered ones get an email provider
async function makeUser(uid, registered = true, displayName) {
  adminDb(); // ensure the admin app is initialized
  const auth = admin.auth();
  await auth.deleteUser(uid).catch(() => {});
  await auth.createUser(
    registered
      ? { uid, email: `${uid}@example.com`, password: "secret123", displayName }
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

test("createGame stores a reserved opponent's name as their account spells it", async () => {
  await makeUser("bobUid", true, "Bob");
  const { id } = await createGameHandler(input({ opponentName: "BOB" }), alice);
  const game = (await adminDb().doc(`gamesPublic/${id}`).get()).data();
  assert.equal(game.config.reservedFor, "bobUid");
  assert.equal(game.tags.player2, "Bob");
});

test("createGame and joinGame refuse a display name the account didn't register", async () => {
  // Bob's token claims Alice's name; Dave's claims a name nobody holds
  for (const impostor of [
    context("bobUid", { name: "alice" }),
    context("daveUid", { name: "dave" }),
  ]) {
    await assert.rejects(
      wrap(createGameHandler)(input(), impostor),
      (e) => e.code === "failed-precondition"
    );
  }
  const { id } = await createGameHandler(input(), alice);
  await assert.rejects(
    wrap(joinGameHandler)(
      { id, isPrivate: false },
      context("bobUid", { name: "carol" })
    ),
    (e) => e.code === "failed-precondition"
  );
  const game = (await adminDb().doc(`gamesPublic/${id}`).get()).data();
  assert.deepEqual(game.config.players, ["aliceUid", null]);
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
const startGame = async (tps = "x3/x3/x3 1 3", tags = {}) => {
  const base = input();
  const { id } = await createGameHandler(
    { ...base, tags: { ...base.tags, ...tags }, tps },
    alice
  );
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

test("resign is refused while a seat is open", async () => {
  const { id } = await createGameHandler(input(), alice);
  await assert.rejects(
    wrap(resignHandler)({ id, isPrivate: false }, alice),
    (e) => e.code === "failed-precondition"
  );
  const { game } = await loadGame(id);
  assert.equal(game.state.hasEnded, false);
  assert.equal(game.tags.result, undefined);
});

test("insertPly stores the canonical ply and refuses junk", async () => {
  const id = await startGame();
  for (const ply of ["hello a1 world", "{comment} b2 c3", "Fa1", "a1xxxx"]) {
    await assert.rejects(
      wrap(insertPlyHandler)({ id, isPrivate: false, ply, plyIndex: 0 }, alice),
      (e) => e.code === "invalid-argument"
    );
  }
  await insertPlyHandler(
    { id, isPrivate: false, ply: " B2 ", plyIndex: 0 },
    alice
  );
  const { root } = await loadGame(id);
  assert.deepEqual(
    root.plies.map((p) => p.ply),
    ["b2"]
  );
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

//#region Draw offers and takeback requests

const carol = context("carolUid", { name: "carol" });
const makeRequest = (id, type, who) =>
  wrap(makeRequestHandler)({ id, isPrivate: false, type }, who);
const withdrawRequest = (id, who) =>
  wrap(withdrawRequestHandler)({ id, isPrivate: false }, who);
const acceptRequest = (id, who) =>
  wrap(acceptRequestHandler)({ id, isPrivate: false }, who);
const declineRequest = (id, who) =>
  wrap(declineRequestHandler)({ id, isPrivate: false }, who);
const rejectsWith = (promise, code) =>
  assert.rejects(promise, (e) => e.code === code);

// Play plies in turn, player 1 (alice) first
const play = async (id, plies, first = alice) => {
  const second = first === alice ? bob : alice;
  for (let i = 0; i < plies.length; i++) {
    const { root } = await loadGame(id);
    await insertPlyHandler(
      { id, isPrivate: false, ply: plies[i], plyIndex: root.plies.length },
      i % 2 ? second : first
    );
  }
};

// The state a game reaches by playing the plies from its start
const replayState = async (plies, tps, tags) => {
  const id = await startGame(tps, tags);
  const { game } = await loadGame(id);
  await play(id, plies, game.state.tps.split(" ")[1] === "1" ? alice : bob);
  return (await loadGame(id)).game.state;
};

test("makeRequest stores the request of a seated player only", async () => {
  const id = await startGame();
  await rejectsWith(makeRequest(id, "draw", carol), "permission-denied");
  await rejectsWith(
    wrap(makeRequestHandler)({ id, isPrivate: false, type: "draw" }, {}),
    "unauthenticated"
  );
  await rejectsWith(makeRequest(id, "rematch", alice), "invalid-argument");
  await rejectsWith(makeRequest(id, undefined, alice), "invalid-argument");
  assert.equal((await loadGame(id)).game.state.request, undefined);

  await play(id, ["a1"]);
  assert.deepEqual(await makeRequest(id, "draw", bob), {
    type: "draw",
    player: 2,
    plyIndex: 1,
  });
  const { game } = await loadGame(id);
  assert.equal(game.state.request.type, "draw");
  assert.equal(game.state.request.player, 2);
  assert.equal(game.state.request.plyIndex, 1);
  assert.ok(game.state.request.createdAt.toDate() instanceof Date);
  assert.equal(game.updatedBy, "bobUid");
});

test("makeRequest is refused while a seat is open and after the game ends", async () => {
  const { id: open } = await createGameHandler(input(), alice);
  await rejectsWith(makeRequest(open, "draw", alice), "failed-precondition");

  const id = await startGame();
  await play(id, ["a1"]);
  await resignHandler({ id, isPrivate: false }, bob);
  await rejectsWith(makeRequest(id, "draw", alice), "failed-precondition");
  await rejectsWith(makeRequest(id, "takeback", alice), "failed-precondition");
  assert.equal((await loadGame(id)).game.state.request, null);
});

test("only one request can be pending at a time", async () => {
  const id = await startGame();
  await play(id, ["a1", "b2"]);
  await makeRequest(id, "draw", alice);
  await rejectsWith(makeRequest(id, "takeback", alice), "failed-precondition");
  await rejectsWith(makeRequest(id, "draw", bob), "failed-precondition");
  await rejectsWith(makeRequest(id, "takeback", bob), "failed-precondition");
  const { request } = (await loadGame(id)).game.state;
  assert.equal(request.type, "draw");
  assert.equal(request.player, 1);
});

test("only the requester can withdraw a request", async () => {
  const id = await startGame();
  await rejectsWith(withdrawRequest(id, alice), "failed-precondition");
  await makeRequest(id, "draw", alice);
  await rejectsWith(withdrawRequest(id, bob), "permission-denied");
  await rejectsWith(withdrawRequest(id, carol), "permission-denied");
  assert.equal((await loadGame(id)).game.state.request.type, "draw");

  assert.deepEqual(await withdrawRequest(id, alice), { type: "draw" });
  const { game } = await loadGame(id);
  assert.equal(game.state.request, null);
  assert.equal(game.state.hasEnded, false);
  // Another can be made once it's gone
  await makeRequest(id, "draw", bob);
});

test("only the opponent can accept or decline a request", async () => {
  const id = await startGame();
  await rejectsWith(acceptRequest(id, bob), "failed-precondition");
  await rejectsWith(declineRequest(id, bob), "failed-precondition");
  await makeRequest(id, "draw", alice);
  for (const who of [alice, carol]) {
    await rejectsWith(acceptRequest(id, who), "permission-denied");
    await rejectsWith(declineRequest(id, who), "permission-denied");
  }
  let { game } = await loadGame(id);
  assert.equal(game.state.request.type, "draw");
  assert.equal(game.state.hasEnded, false);

  assert.deepEqual(await declineRequest(id, bob), { type: "draw" });
  ({ game } = await loadGame(id));
  assert.equal(game.state.request, null);
  assert.equal(game.state.hasEnded, false);
  assert.equal(game.updatedBy, "bobUid");
});

test("an accepted draw ends the game as 1/2-1/2", async () => {
  const id = await startGame();
  await play(id, ["a1"]);
  // Either player, on either turn: it's bob's move, and alice offers
  await makeRequest(id, "draw", alice);
  assert.deepEqual(await acceptRequest(id, bob), {
    type: "draw",
    result: "1/2-1/2",
    plyIndex: 1,
  });
  const { game, root } = await loadGame(id);
  assert.equal(game.state.hasEnded, true);
  assert.equal(game.state.result, "1/2-1/2");
  assert.equal(game.tags.result, "1/2-1/2");
  assert.equal(game.state.request, null);
  assert.equal(game.updatedBy, "bobUid");
  assert.equal(root.plies.length, 1);
  await rejectsWith(
    wrap(insertPlyHandler)(
      { id, isPrivate: false, ply: "b2", plyIndex: 1 },
      bob
    ),
    "failed-precondition"
  );
  await rejectsWith(acceptRequest(id, bob), "failed-precondition");
});

test("a takeback before the opponent replies removes one ply", async () => {
  const id = await startGame();
  await play(id, ["a1", "b2", "c3"]);
  // Alice just played c3; bob hasn't replied
  await makeRequest(id, "takeback", alice);
  assert.deepEqual(await acceptRequest(id, bob), {
    type: "takeback",
    plyIndex: 2,
  });
  const { game, root } = await loadGame(id);
  assert.deepEqual(
    root.plies.map((p) => [p.index, p.ply, p.uid]),
    [
      [0, "a1", "aliceUid"],
      [1, "b2", "bobUid"],
    ]
  );
  assert.equal(game.state.request, null);
  assert.equal(game.updatedBy, "bobUid");
  const expected = await replayState(["a1", "b2"]);
  assert.deepEqual(
    [game.state.tps, game.state.plyIndex, game.state.hasEnded],
    [expected.tps, 2, false]
  );
  assert.equal(game.state.result, "");
  // It's alice's turn again
  await rejectsWith(
    wrap(insertPlyHandler)(
      { id, isPrivate: false, ply: "c1", plyIndex: 2 },
      bob
    ),
    "permission-denied"
  );
  await play(id, ["c1"]);
  assert.equal((await loadGame(id)).root.plies.length, 3);
});

test("a takeback after the opponent replied removes two plies", async () => {
  const id = await startGame();
  await play(id, ["a1", "b2", "c3", "c1"]);
  // Bob replied to c3 with c1; alice takes c3 back
  await makeRequest(id, "takeback", alice);
  assert.deepEqual(await acceptRequest(id, bob), {
    type: "takeback",
    plyIndex: 2,
  });
  const { game, root } = await loadGame(id);
  assert.deepEqual(
    root.plies.map((p) => p.ply),
    ["a1", "b2"]
  );
  const expected = await replayState(["a1", "b2"]);
  assert.equal(game.state.tps, expected.tps);
  assert.equal(game.state.plyIndex, 2);
  assert.equal(game.state.hasEnded, false);
  assert.equal(game.state.request, null);
  await play(id, ["b1"]);
});

test("a takeback of the opening plies follows the turn, not the stone colour", async () => {
  // Alice's first ply places bob's stone, and bob's hers
  const id = await startGame("x3/x3/x3 1 1");
  await play(id, ["a1", "b2"]);
  // Bob takes back b2 (a white stone): one ply
  await makeRequest(id, "takeback", bob);
  await acceptRequest(id, alice);
  let { game, root } = await loadGame(id);
  assert.deepEqual(
    root.plies.map((p) => p.ply),
    ["a1"]
  );
  assert.equal(game.state.tps, (await replayState(["a1"], "x3/x3/x3 1 1")).tps);
  assert.equal(game.state.tps, "x3/x3/2,x2 2 1");
  assert.equal(game.state.tps.split(" ")[1], "2");

  // Alice takes back a1 (a black stone) after bob replays: both plies go
  await play(id, ["c3"], bob);
  await makeRequest(id, "takeback", alice);
  await acceptRequest(id, bob);
  ({ game, root } = await loadGame(id));
  assert.deepEqual(root.plies, []);
  assert.deepEqual([game.state.tps, game.state.plyIndex], ["x3/x3/x3 1 1", 0]);
});

test("a takeback replays from the starting position, wall smashes included", async () => {
  // A started position: white to move with a capstone beside a wall
  const tps = "x5/x5/x,1C,2S,x2/x5/x5 1 4";
  const id = await startGame(tps, { size: 5 });
  await play(id, ["b3>", "a1", "a5"]);
  let { root } = await loadGame(id);
  assert.equal(root.plies[0].ply, "b3>*");
  await makeRequest(id, "takeback", bob);
  await acceptRequest(id, alice);
  const { game } = await loadGame(id);
  ({ root } = await loadGame(id));
  assert.deepEqual(
    root.plies.map((p) => p.ply),
    ["b3>*"]
  );
  const expected = await replayState(["b3>"], tps, { size: 5 });
  assert.equal(game.state.tps, expected.tps);
  assert.equal(game.state.plyIndex, 1);
});

test("a takeback is refused when the requester has no move to take back", async () => {
  const id = await startGame();
  // Nobody has moved
  await rejectsWith(makeRequest(id, "takeback", alice), "failed-precondition");
  await rejectsWith(makeRequest(id, "takeback", bob), "failed-precondition");
  // Only alice has
  await play(id, ["a1"]);
  await rejectsWith(makeRequest(id, "takeback", bob), "failed-precondition");
  assert.equal((await loadGame(id)).game.state.request, null);
  await makeRequest(id, "takeback", alice);
});

test("a takeback is refused after the game ends", async () => {
  // Alice finishes a road with c1
  const id = await startGame("x3/x3/1,1,x 1 3");
  await play(id, ["c1"]);
  assert.equal((await loadGame(id)).game.state.hasEnded, true);
  await rejectsWith(makeRequest(id, "takeback", alice), "failed-precondition");
  assert.equal((await loadGame(id)).root.plies.length, 1);
});

test("insertPly clears a pending request, whoever moves", async () => {
  const id = await startGame();
  await play(id, ["a1"]);
  // The opponent moves instead of answering
  await makeRequest(id, "takeback", alice);
  await play(id, ["b2"], bob);
  assert.equal((await loadGame(id)).game.state.request, null);
  await rejectsWith(acceptRequest(id, bob), "failed-precondition");
  // The requester moves
  await makeRequest(id, "draw", alice);
  await play(id, ["c3"]);
  const { game, root } = await loadGame(id);
  assert.equal(game.state.request, null);
  assert.equal(root.plies.length, 3);
  await rejectsWith(withdrawRequest(id, alice), "failed-precondition");
});

test("a game-ending ply and a resignation clear a pending request", async () => {
  let id = await startGame("x3/x3/1,1,x 1 3");
  await makeRequest(id, "draw", bob);
  await play(id, ["c1"]);
  let { game } = await loadGame(id);
  assert.equal(game.state.hasEnded, true);
  assert.equal(game.state.request, null);

  id = await startGame();
  await play(id, ["a1"]);
  await makeRequest(id, "takeback", alice);
  await resignHandler({ id, isPrivate: false }, bob);
  ({ game } = await loadGame(id));
  assert.equal(game.state.result, "1-0");
  assert.equal(game.state.request, null);
  await rejectsWith(acceptRequest(id, bob), "failed-precondition");
  await rejectsWith(withdrawRequest(id, alice), "failed-precondition");
});

test("concurrent answers to a request settle once", async () => {
  const id = await startGame();
  await play(id, ["a1", "b2", "c3", "c1"]);
  await makeRequest(id, "takeback", alice);
  const results = await Promise.allSettled([
    acceptRequestHandler({ id, isPrivate: false }, bob),
    acceptRequestHandler({ id, isPrivate: false }, bob),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await loadGame(id)).root.plies.length, 2);
});

//#endregion
