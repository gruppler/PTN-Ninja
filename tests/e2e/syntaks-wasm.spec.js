// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * The Syntaks engine, running for real in its worker.
 *
 * Its threads need shared memory, so the page has to be cross-origin
 * isolated; its stdin is a ring buffer the page writes to
 * (public/syntaks-wasm/syntaks.worker.js).
 */

test("Syntaks starts, reports itself and searches", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$game, null, {
    timeout: 90000,
  });
  expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(true);
  await page.waitForLoadState("networkidle");

  // Not until it's wanted: it's a 13 MB download
  const loaded = () =>
    page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((entry) => /syntaks/.test(entry.name))
    );
  expect(await loaded()).toBe(false);

  await page.evaluate(async () => {
    const store = window.app.$store;
    await store.dispatch("game/ADD_GAME", {
      ptn: '[Size "6"]\n\n1. a1 f6\n',
      name: "Syntaks",
    });
    store.commit("analysis/SET", ["botID", "syntaks"]);
    store.commit("analysis/ADD_ACTIVE_BOT", "syntaks");
  });
  await page.waitForFunction(
    () => {
      const state = window.app.$store.state.analysis.botStates.syntaks;
      return state && state.isTeiOk;
    },
    null,
    { timeout: 60000 }
  );

  const meta = await page.evaluate(
    () => window.app.$store.state.analysis.botMetas.syntaks
  );
  // The version is split off the name
  expect(meta.name).toBe("syntaks");
  expect(meta.version).toMatch(/^\d+\.\d+/);
  // Set from the game's opening, not the user's to change
  expect(Object.keys(meta.options)).not.toContain("DoubleBlackStack");

  await page.evaluate(() => {
    window.app.$store.getters["analysis/bot"].isInteractiveEnabled = true;
  });
  await page.waitForFunction(
    () => {
      const state = window.app.$store.state.analysis;
      return (
        state.botStates.syntaks.nodes > 0 &&
        Object.keys(state.botPositions.syntaks || {}).length > 0
      );
    },
    null,
    { timeout: 60000 }
  );
});
