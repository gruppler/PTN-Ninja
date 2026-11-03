const test = require("node:test");
const assert = require("node:assert/strict");
const { adminDb, clearFirestore, rulesEnv } = require("./helpers");

test("emulator firestore round-trips a doc", async () => {
  await clearFirestore();
  const ref = adminDb().doc("smoke/a");
  await ref.set({ ok: true });
  assert.deepEqual((await ref.get()).data(), { ok: true });
});

test("rules env loads", async () => {
  const env = await rulesEnv();
  assert.ok(env);
  await env.cleanup();
});
