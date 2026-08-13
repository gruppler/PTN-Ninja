// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Storage Persistence E2E Tests
 *
 * Games live in IndexedDB, which browsers may evict unless the origin has been
 * granted persistent storage. These tests stub the StorageManager API so we can
 * assert the request behavior deterministically, since a real browser decides
 * on its own (Chrome by engagement heuristics, Firefox by prompting).
 */

const PTN = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
`;

/**
 * Replace navigator.storage with a stub that records calls.
 * Must run before the app boots, so call this before page.goto().
 */
async function stubStorageManager(page, { alreadyPersisted = false } = {}) {
  await page.addInitScript((persisted) => {
    const calls = { persist: 0, persisted: 0 };
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persisted: async () => {
          calls.persisted++;
          return persisted;
        },
        persist: async () => {
          calls.persist++;
          return true;
        },
      },
    });
    // @ts-ignore - test-only handle
    window.__storageCalls = calls;
  }, alreadyPersisted);
}

/** Remove the StorageManager API entirely, as on an unsupporting browser. */
async function removeStorageManager(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: undefined,
    });
  });
}

async function waitForApp(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
}

async function addGame(page, name) {
  await page.evaluate(
    async ({ ptn, gameName }) => {
      await window.app.$store.dispatch("game/ADD_GAME", {
        ptn,
        name: gameName,
      });
    },
    { ptn: PTN, gameName: name }
  );
}

const calls = (page) => page.evaluate(() => window.__storageCalls);

test.describe("Storage Persistence", () => {
  // A first-time visitor gets a starter game created for them during init.
  // That must not trigger a permission prompt before they have done anything.
  test("does not request on load for a first-time visitor", async ({
    page,
  }) => {
    await stubStorageManager(page);
    await waitForApp(page);
    await page.waitForTimeout(1000);

    expect((await calls(page)).persist).toBe(0);
  });

  test("requests persistence once a game is added", async ({ page }) => {
    await stubStorageManager(page);
    await waitForApp(page);

    await addGame(page, "Persistence Test");

    await expect.poll(async () => (await calls(page)).persist).toBe(1);
  });

  test("only requests once per session", async ({ page }) => {
    await stubStorageManager(page);
    await waitForApp(page);

    await addGame(page, "First Game");
    await expect.poll(async () => (await calls(page)).persist).toBe(1);

    await addGame(page, "Second Game");
    await page.waitForTimeout(500);

    expect((await calls(page)).persist).toBe(1);
  });

  test("skips the request when already persisted", async ({ page }) => {
    await stubStorageManager(page, { alreadyPersisted: true });
    await waitForApp(page);

    await addGame(page, "Already Persisted");
    await page.waitForTimeout(500);

    const result = await calls(page);
    expect(result.persisted).toBeGreaterThan(0);
    expect(result.persist).toBe(0);
  });

  test("stays inert when the browser has no StorageManager", async ({
    page,
  }) => {
    await removeStorageManager(page);
    await waitForApp(page);

    await addGame(page, "Unsupported Test");
    await page.waitForTimeout(500);

    // The game itself must still load normally.
    expect(await page.evaluate(() => window.app.$game.plies.length > 0)).toBe(
      true
    );
  });
});
