// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * The DoubleBlackStack TEI option.
 *
 * An engine that declares `option name DoubleBlackStack type check` plays the
 * double-black-stack opening itself, so it is told per game whether the
 * Opening tag asks for it, is not offered to the user as an option, and gets
 * the moves as they were played. An engine without the option still has the
 * first move replaced by the TPS it produces.
 *
 * The engine is simulated: `send` is recorded, and replies are fed to
 * `handleResponse`.
 */

const META = {
  name: "DBS Test",
  author: "Test",
  connection: { address: "localhost", port: 1, ssl: false },
  limitTypes: { depth: { min: 1, max: 100, step: 1 } },
  options: {},
  presetOptions: {},
};

async function setUp(page, { opening, supported }) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  await page.evaluate(
    async ({ meta, opening, supported }) => {
      const store = window.app.$store;
      await store.dispatch("game/ADD_GAME", {
        ptn: `[Size "6"]\n[Opening "${opening}"]\n\n1. a1 f6\n2. b1 e6\n`,
        name: "DBS " + opening,
      });
      await store.dispatch("analysis/SAVE_BOT", { id: "dbs-test", meta });
      store.commit("analysis/SET", ["botID", "dbs-test"]);
      const bot = store.getters["analysis/bot"];
      window.__sent = [];
      bot.send = (line) => window.__sent.push(line);
      bot.setMeta({ options: {} });
      bot.setState({ isConnected: true, isTeiOk: true, isReady: true });
      if (supported) {
        bot.handleResponse(
          "option name DoubleBlackStack type check default false"
        );
      }
      window.__bot = bot;
    },
    { meta: META, opening, supported }
  );
}

/** Start a search on the last ply of the main line and return what was sent */
async function search(page) {
  return page.evaluate(async () => {
    const game = window.app.$game;
    const plies = game.plies.filter((ply) => !ply.branch);
    const ply = plies[plies.length - 1];
    const bot = window.__bot;
    bot.searchPosition(6, 0, ply.tpsAfter, ply.id, true);
    // The engine answers the isready sent with the new game
    bot.handleResponse("readyok");
    return window.__sent;
  });
}

test.describe("DoubleBlackStack option", () => {
  test("is told the opening, and not shown as a user option", async ({
    page,
  }) => {
    await setUp(page, { opening: "double black stack", supported: true });
    expect(
      await page.evaluate(() => Object.keys(window.__bot.meta.options))
    ).toEqual([]);

    const lines = await search(page);
    const option = lines.indexOf("setoption name DoubleBlackStack value true");
    const position = lines.findIndex((l) => l.startsWith("position"));
    expect(option).toBeGreaterThanOrEqual(0);
    expect(position).toBeGreaterThan(option);
    // Moves as played, not the TPS substitution
    expect(lines[position]).toBe("position startpos moves a1 f6 b1 e6");
  });

  test("is turned off for an ordinary opening", async ({ page }) => {
    await setUp(page, { opening: "swap", supported: true });
    const lines = await search(page);
    expect(lines).toContain("setoption name DoubleBlackStack value false");
  });

  test("an engine without the option gets the TPS substitution", async ({
    page,
  }) => {
    await setUp(page, { opening: "double black stack", supported: false });
    const lines = await search(page);
    expect(lines.some((l) => /DoubleBlackStack/i.test(l))).toBe(false);
    const position = lines.find((l) => l.startsWith("position"));
    expect(position).toMatch(/^position tps /);
  });
});
