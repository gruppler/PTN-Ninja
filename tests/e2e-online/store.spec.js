// @ts-check
const { test, expect } = require("@playwright/test");
const { signInAsGuest, openApp, FIRESTORE, PROJECT } = require("./helpers");

const CREATE_PRIVATE = {
  config: { isPrivate: true, playerSeat: 1, playerName: "Guesty" },
  tags: { size: 5, komi: 0, opening: "swap" },
  tps: "x5/x5/x5/x5/x5 1 1",
};

/** Create a private game as the page's current (guest) user */
function createPrivateGame(page) {
  return page.evaluate(async (data) => {
    const { data: result } = await window.functions.httpsCallable("createGame")(
      data
    );
    return result;
  }, CREATE_PRIVATE);
}

test("online/INIT registers one auth listener", async ({ page }) => {
  await openApp(page);
  const count = await page.evaluate(async () => {
    let count = 0;
    const original = window.auth.onAuthStateChanged.bind(window.auth);
    window.auth.onAuthStateChanged = (...args) => {
      count++;
      return original(...args);
    };
    const store = window.app.$store;
    await store.dispatch("online/INIT");
    await store.dispatch("online/INIT");
    window.auth.onAuthStateChanged = original;
    return count;
  });
  expect(count).toBe(0);
});

test("UNLISTEN(listenerPath) stops a LISTEN_DOC", async ({ page }) => {
  await signInAsGuest(page);
  const { id } = await createPrivateGame(page);
  const path = `gamesPrivate/${id}`;

  await page.evaluate(async (path) => {
    const converter = {
      toFirestore: (x) => x,
      fromFirestore: (snapshot) => ({ id: snapshot.id, ...snapshot.data() }),
    };
    await window.app.$store.dispatch("online/LISTEN_DOC", {
      converter,
      path,
      stateKey: "gamesPrivate",
      listenerPath: "x",
    });
  }, path);
  await page.waitForFunction(
    (id) => window.app.$store.state.online.gamesPrivate[id],
    id
  );

  const write = async (value) => {
    const response = await fetch(
      `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${path}?updateMask.fieldPaths=probe`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer owner",
        },
        body: JSON.stringify({ fields: { probe: { stringValue: value } } }),
      }
    );
    expect(response.ok).toBe(true);
  };
  const probe = () =>
    page.evaluate(
      (id) => window.app.$store.state.online.gamesPrivate[id].probe,
      id
    );

  await write("before");
  await expect.poll(probe).toBe("before");

  await page.evaluate(() => window.app.$store.dispatch("online/UNLISTEN", "x"));
  await write("after");
  await page.waitForTimeout(1500);
  expect(await probe()).toBe("before");
});

test("guest online/player is their seat in the current game", async ({
  page,
}) => {
  await signInAsGuest(page);
  const { id, isPrivate } = await createPrivateGame(page);
  const seat = await page.evaluate(
    async ({ id, isPrivate }) => {
      const store = window.app.$store;
      const snapshot = await window.db.doc(`gamesPrivate/${id}`).get();
      store.commit("online/SET_CURRENT_GAME", {
        id,
        isPrivate,
        game: snapshot.data(),
        root: { uid: null, plies: [] },
      });
      return store.getters["online/player"];
    },
    { id, isPrivate }
  );
  expect(seat).toBe(1);
});
