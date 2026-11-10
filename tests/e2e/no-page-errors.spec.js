// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * The app must load and render its pieces without uncaught errors. A getter
 * that throws (e.g. disabledOptions reading an undefined rootState) leaves
 * the board drawn without its pieces.
 */
test("a game loads with no page errors and renders its pieces", async ({
  page,
}) => {
  const errors = [];
  // "Game not found" comes from the dev persistence layer, not the code under test
  page.on("pageerror", (error) => {
    if (!/Game not found/.test(error.message)) {
      errors.push(error.message);
    }
  });

  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  await page.evaluate(async () => {
    await window.app.$store.dispatch("game/ADD_GAME", {
      ptn: '[Size "5"]\n\n1. a1 e5 2. b1',
      name: "Pieces render",
    });
  });
  await page.waitForTimeout(1000);

  expect(
    await page.evaluate(() => window.app.$store.getters["game/disabledOptions"])
  ).toBeInstanceOf(Array);
  expect(errors).toEqual([]);
});
