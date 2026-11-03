const { test, before, after, beforeEach } = require("node:test");
const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { rulesEnv } = require("./helpers");

let env;

const anon = { firebase: { sign_in_provider: "anonymous" } };
const as = (uid) => env.authenticatedContext(uid, anon).firestore();
const noAuth = () => env.unauthenticatedContext().firestore();

function game({
  isOpen = false,
  players = ["alice", "bob"],
  reservedFor,
} = {}) {
  const config = { isPrivate: false, isOpen, players };
  if (reservedFor !== undefined) config.reservedFor = reservedFor;
  return {
    name: "g",
    config,
    state: { tps: "", plyIndex: 0, hasEnded: false, result: null },
    tags: {},
    createdBy: "alice",
  };
}

async function seed(fn) {
  await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}

async function seedGame(table, id, data) {
  await seed(async (db) => {
    await db.doc(`${table}/${id}`).set(data);
    await db.doc(`${table}/${id}/branches/root`).set({ uid: null, ptn: "" });
    await db.doc(`${table}/${id}/branches/alice`).set({ uid: "alice" });
  });
}

before(async () => {
  env = await rulesEnv();
});
beforeEach(async () => {
  await env.clearFirestore();
});
after(async () => {
  await env.cleanup();
});

test("gamesPublic: signed-in users can get and list; no auth cannot", async () => {
  await seedGame("gamesPublic", "g1", game());
  await assertSucceeds(as("zed").doc("gamesPublic/g1").get());
  await assertSucceeds(as("zed").collection("gamesPublic").get());
  await assertFails(noAuth().doc("gamesPublic/g1").get());
  await assertFails(noAuth().collection("gamesPublic").get());
});

test("gamesPublic: no client create or update", async () => {
  await seedGame("gamesPublic", "g1", game());
  await assertFails(as("alice").doc("gamesPublic/new").set(game()));
  await assertFails(as("alice").doc("gamesPublic/g1").update({ name: "x" }));
});

test("gamesPublic: only the creator can delete, and only while open", async () => {
  await seedGame(
    "gamesPublic",
    "open",
    game({ isOpen: true, players: ["alice", null] })
  );
  await seedGame("gamesPublic", "full", game());
  await assertFails(as("bob").doc("gamesPublic/open").delete());
  await assertFails(as("alice").doc("gamesPublic/full").delete());
  await assertSucceeds(as("alice").doc("gamesPublic/open").delete());
});

test("gamesPrivate: players can get", async () => {
  await seedGame("gamesPrivate", "g1", game());
  await assertSucceeds(as("alice").doc("gamesPrivate/g1").get());
  await assertSucceeds(as("bob").doc("gamesPrivate/g1").get());
});

test("gamesPrivate: a stranger cannot get a full game", async () => {
  await seedGame("gamesPrivate", "g1", game());
  await assertFails(as("zed").doc("gamesPrivate/g1").get());
  await assertFails(noAuth().doc("gamesPrivate/g1").get());
});

test("gamesPrivate: a stranger can get an open, unreserved game (reservedFor absent or null)", async () => {
  const open = game({ isOpen: true, players: ["alice", null] });
  await seedGame("gamesPrivate", "absent", open);
  await seedGame("gamesPrivate", "nul", {
    ...open,
    config: { ...open.config, reservedFor: null },
  });
  await assertSucceeds(as("zed").doc("gamesPrivate/absent").get());
  await assertSucceeds(as("zed").doc("gamesPrivate/nul").get());
});

test("gamesPrivate: a reserved game is readable only by its reserved user (and players)", async () => {
  await seedGame(
    "gamesPrivate",
    "r",
    game({ isOpen: true, players: ["alice", null], reservedFor: "bob" })
  );
  await assertSucceeds(as("bob").doc("gamesPrivate/r").get());
  await assertSucceeds(as("alice").doc("gamesPrivate/r").get());
  await assertFails(as("zed").doc("gamesPrivate/r").get());
});

test("gamesPrivate: list only with players array-contains own uid", async () => {
  await seedGame("gamesPrivate", "g1", game());
  const col = (uid) => as(uid).collection("gamesPrivate");
  await assertSucceeds(
    col("alice").where("config.players", "array-contains", "alice").get()
  );
  await assertFails(
    col("alice").where("config.players", "array-contains", "bob").get()
  );
  await assertFails(col("alice").get());
});

test("gamesPrivate: no client writes; creator deletes only while open", async () => {
  await seedGame(
    "gamesPrivate",
    "open",
    game({ isOpen: true, players: ["alice", null] })
  );
  await seedGame("gamesPrivate", "full", game());
  await assertFails(as("alice").doc("gamesPrivate/new").set(game()));
  await assertFails(as("alice").doc("gamesPrivate/full").update({ name: "x" }));
  await assertFails(as("alice").doc("gamesPrivate/full").delete());
  await assertFails(as("bob").doc("gamesPrivate/open").delete());
  await assertSucceeds(as("alice").doc("gamesPrivate/open").delete());
});

test("branches/root: readable whenever the game is; no client writes", async () => {
  await seedGame("gamesPublic", "pub", game());
  await seedGame("gamesPrivate", "priv", game());
  await assertSucceeds(as("zed").doc("gamesPublic/pub/branches/root").get());
  await assertSucceeds(as("bob").doc("gamesPrivate/priv/branches/root").get());
  await assertFails(as("zed").doc("gamesPrivate/priv/branches/root").get());
  await assertFails(noAuth().doc("gamesPublic/pub/branches/root").get());
  await assertFails(
    as("alice").doc("gamesPublic/pub/branches/root").update({ ptn: "x" })
  );
  await assertFails(
    as("alice").doc("gamesPrivate/priv/branches/root").update({ ptn: "x" })
  );
  await assertFails(as("alice").doc("gamesPublic/pub/branches/root").delete());
  await assertFails(
    as("alice").doc("gamesPublic/pub/branches/n").set({ uid: "alice" })
  );
});

test("branches/root of an open unreserved private game is readable by a stranger", async () => {
  await seedGame(
    "gamesPrivate",
    "o",
    game({ isOpen: true, players: ["alice", null] })
  );
  await assertSucceeds(as("zed").doc("gamesPrivate/o/branches/root").get());
});

test("other branches: deny all", async () => {
  await seedGame("gamesPublic", "pub", game());
  await seedGame("gamesPrivate", "priv", game());
  await assertFails(as("alice").doc("gamesPublic/pub/branches/alice").get());
  await assertFails(as("alice").doc("gamesPrivate/priv/branches/alice").get());
  await assertFails(
    as("alice").doc("gamesPublic/pub/branches/alice").set({ uid: "alice" })
  );
});

test("chat, analyses, puzzles: deny all", async () => {
  await seed(async (db) => {
    await db.doc("gamesPublic/g/playerChat/m").set({ uid: "alice" });
    await db.doc("gamesPublic/g/spectatorChat/m").set({ uid: "alice" });
    await db.doc("gamesPrivate/g/playerChat/m").set({ uid: "alice" });
    await db.doc("analyses/a").set({ uid: "alice" });
    await db.doc("puzzles/p").set({ uid: "alice" });
  });
  const db = as("alice");
  for (const path of [
    "gamesPublic/g/playerChat/m",
    "gamesPublic/g/spectatorChat/m",
    "gamesPrivate/g/playerChat/m",
    "analyses/a",
    "puzzles/p",
  ]) {
    await assertFails(db.doc(path).get());
    await assertFails(db.doc(path).set({ uid: "alice" }));
  }
});

test("users/{uid}: owner reads and writes; others cannot", async () => {
  await seed((db) => db.doc("users/alice/settings/s").set({ a: 1 }));
  await assertSucceeds(as("alice").doc("users/alice/settings/s").get());
  await assertSucceeds(as("alice").doc("users/alice/settings/t").set({ a: 2 }));
  await assertFails(as("bob").doc("users/alice/settings/s").get());
  await assertFails(as("bob").doc("users/alice/settings/s").set({ a: 3 }));
  await assertFails(noAuth().doc("users/alice/settings/s").get());
});

test("names: signed-in get; owner creates once; no update", async () => {
  await seed((db) => db.doc("names/taken").set({ uid: "alice" }));
  await assertSucceeds(as("zed").doc("names/taken").get());
  await assertFails(noAuth().doc("names/taken").get());
  await assertSucceeds(
    env
      .authenticatedContext("bob", {
        firebase: { sign_in_provider: "password" },
      })
      .firestore()
      .doc("names/bobby")
      .set({ uid: "bob" })
  );
  await assertFails(as("bob").doc("names/other").set({ uid: "alice" }));
  await assertFails(as("bob").doc("names/taken").set({ uid: "bob" }));
  await assertFails(as("alice").doc("names/taken").update({ uid: "alice" }));
});

test("names: anonymous users and extra fields are denied on create", async () => {
  const registered = env
    .authenticatedContext("bob", { firebase: { sign_in_provider: "password" } })
    .firestore();
  await assertFails(as("bob").doc("names/guest").set({ uid: "bob" }));
  await assertFails(
    registered.doc("names/extra").set({ uid: "bob", admin: true })
  );
  await assertSucceeds(registered.doc("names/bobby").set({ uid: "bob" }));
});
