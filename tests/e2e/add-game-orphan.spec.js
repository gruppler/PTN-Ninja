// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * A game can be in the database without being in the list. Adding a game
 * under its name failed with "A mutation operation in the transaction failed
 * because a constraint was not satisfied", so a new game of that size could
 * not be created at all.
 */
test("adding a game whose name is taken by a stored game gets a new name", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });

  const name = "Orphaned game";
  await page.evaluate(
    (name) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("games");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("games", "readwrite");
          tx.objectStore("games").put({
            name,
            ptn: '[Size "8"]\n\n',
            lastSeen: new Date(),
          });
          tx.oncomplete = () => {
            db.close();
            resolve(null);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    name
  );

  const added = await page.evaluate(async (name) => {
    await window.app.$store.dispatch("game/ADD_GAME", {
      name,
      ptn: '[Size "8"]\n\n',
    });
    return window.app.$store.state.game.list.map((game) => game.name);
  }, name);

  expect(added).toContain(name + " (1)");
});
