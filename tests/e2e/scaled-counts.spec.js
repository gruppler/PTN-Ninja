// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Node counts and speeds are shown in the unit that suits their size, not
 * always in thousands: 100 nodes reads 100, not 0 knodes.
 */

async function open(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$game, null, {
    timeout: 60000,
  });
  await page.evaluate(async () => {
    const store = window.app.$store;
    await store.dispatch("game/ADD_GAME", {
      ptn: '[Size "6"]\n\n1. a1 f6\n',
      name: "Scaled Counts",
    });
    await store.dispatch("ui/SET_UI", ["showText", true]);
    await store.dispatch("ui/SET_UI", ["textTab", "engines"]);
    store.commit("analysis/SET", ["botID", "tiltak"]);
    store.commit("analysis/ADD_ACTIVE_BOT", "tiltak");
  });
  await page.waitForTimeout(2500);
}

const cases = [
  [0, /\s0\s+N\/s\s*$/],
  [842, /\s842\s+N\/s\s*$/],
  [12400, /\s12\.4\s+kN\/s\s*$/],
  [267000, /\s267\s+kN\/s\s*$/],
  [999960, /\s1\.00\s+MN\/s\s*$/],
  [1500000, /\s1\.50\s+MN\/s\s*$/],
  [2.4e9, /\s2\.40\s+GN\/s\s*$/],
];

for (const [nps, expected] of cases) {
  test(`${nps} nodes per second reads in the right unit`, async ({ page }) => {
    await open(page);
    await page.evaluate((nps) => {
      const bot = window.app.$store.getters["analysis/bot"];
      bot.setState({ nps, time: 1000 });
    }, nps);
    // The time, then the speed, in the first engine's panel
    const readout = page
      .locator(".bot-suggestions")
      .first()
      .locator(".text-caption.text-right");
    await expect(readout).toHaveText(expected);
  });
}

for (const [nodes, text] of [
  [100, "100 nodes"],
  [12400, "12.4 knodes"],
  [1500000, "1.50 Mnodes"],
]) {
  test(`a suggestion's ${nodes} nodes read ${text}`, async ({ page }) => {
    await open(page);
    await page.evaluate((nodes) => {
      const bot = window.app.$store.getters["analysis/bot"];
      bot.setPosition(window.app.$game.board.getTPS?.() || bot.state.tps, [
        { nodes, time: 10, pv: [] },
      ]);
    }, nodes);
    await expect(
      page.locator(".bot-suggestions .count", { hasText: text }).first()
    ).toBeVisible();
  });
}
