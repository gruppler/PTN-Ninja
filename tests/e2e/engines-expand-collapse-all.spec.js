// @ts-check
const { test, expect } = require("@playwright/test");

/** The Engines tab header collapses or expands every engine panel at once */
test("expand and collapse all engines from the tab header", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(
    () => window.app && window.app.$store && window.app.$game,
    null,
    { timeout: 30000 }
  );
  await page.evaluate(async () => {
    const store = window.app.$store;
    await store.dispatch("game/ADD_GAME", {
      ptn: '[Size "5"]\n\n1. a1 e5\n',
      name: "Expand Collapse",
    });
    await store.dispatch("ui/SET_UI", ["showText", true]);
    await store.dispatch("ui/SET_UI", ["textTab", "engines"]);
    // Make two engines active, which puts a panel for each in the list
    for (const id of ["tiltak", "tinue-solver"]) {
      store.commit("analysis/SET", ["botID", id]);
    }
  });

  const collapsedState = () =>
    page.evaluate(() => {
      const { activeBots, collapsedBots } = window.app.$store.state.analysis;
      return activeBots.filter(Boolean).map((id) => collapsedBots[id] === true);
    });

  // The row above the tab panels, which holds the tab's stats and buttons
  const header = page.locator('div.row.bg-ui[style*="height: 34px"]');

  expect((await collapsedState()).length).toBeGreaterThan(0);

  await header.locator("button:has(i.mdi-unfold-less-horizontal)").click();
  expect((await collapsedState()).every((collapsed) => collapsed)).toBe(true);

  await header.locator("button:has(i.mdi-unfold-more-horizontal)").click();
  expect((await collapsedState()).every((collapsed) => !collapsed)).toBe(true);
});
