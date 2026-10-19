// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * TEI options follow UCI: they may only change while the engine is idle.
 *
 * Applying options (or pressing a button option) during a search sent the
 * setoption lines straight away. And options went out in the engine's
 * declared order, so Hash could arrive before Threads, which engines that
 * size the hash per thread don't handle well.
 *
 * The engine is simulated: `send` is recorded, and replies are fed to
 * `handleResponse`.
 */

const META = {
  name: "Options Test",
  author: "Test",
  connection: { address: "localhost", port: 1, ssl: false },
  limitTypes: { depth: { min: 1, max: 100, step: 1 } },
  // Declared Hash first, the way many engines list them
  options: {
    Hash: { type: "spin", default: 16, min: 1, max: 1024 },
    MultiPV: { type: "spin", default: 1, min: 1, max: 8 },
    Threads: { type: "spin", default: 1, min: 1, max: 64 },
    "Clear Hash": { type: "button" },
  },
  presetOptions: {},
};

async function setUp(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  await page.evaluate(async (meta) => {
    const store = window.app.$store;
    await store.dispatch("game/ADD_GAME", {
      ptn: `[Size "6"]\n[Opening "swap"]\n\n1. a6 f1\n`,
      name: "TEI Options",
    });
    await store.dispatch("analysis/SAVE_BOT", { id: "options-test", meta });
    store.commit("analysis/SET", ["botID", "options-test"]);
    const bot = store.getters["analysis/bot"];
    // No socket: record what would be sent
    window.__sent = [];
    bot.send = (line) => window.__sent.push(line);
    bot.setMeta({ options: meta.options });
    bot.setState({
      isConnected: true,
      isTeiOk: true,
      isReady: true,
      isGameInitialized: true,
      gameID: window.app.$game.name,
      size: 6,
      halfKomi: 0,
    });
    window.__bot = bot;
  }, META);
}

const sent = (page) =>
  page.evaluate(() => {
    const out = window.__sent;
    window.__sent = [];
    return out;
  });

const optionLines = (lines) =>
  lines.filter((line) => line.startsWith("setoption"));

test.describe("TEI options", () => {
  test.beforeEach(async ({ page }) => {
    await setUp(page);
  });

  test("Threads is sent before Hash", async ({ page }) => {
    await page.evaluate(() => window.__bot.applyOptions());
    const lines = await sent(page);
    const options = optionLines(lines);
    const threads = options.findIndex((l) => l.includes("name Threads "));
    const hash = options.findIndex((l) => l.includes("name Hash "));
    expect(threads).toBeGreaterThanOrEqual(0);
    expect(hash).toBeGreaterThan(threads);
    expect(lines[lines.length - 1]).toBe("isready");
  });

  test("interactive search is stopped before options are sent, then resumes", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.__bot.isInteractiveEnabled = true;
    });
    let lines = await sent(page);
    expect(lines.some((l) => l === "go infinite")).toBe(true);

    await page.evaluate(() => window.__bot.applyOptions());
    lines = await sent(page);
    expect(lines).toEqual(["stop"]);

    // Engine stops
    await page.evaluate(() => window.__bot.handleResponse("bestmove d4"));
    lines = await sent(page);
    expect(optionLines(lines).length).toBeGreaterThan(0);
    expect(optionLines(lines)[0]).toContain("name Threads ");
    expect(lines[lines.length - 1]).toBe("isready");
    expect(lines.some((l) => l.startsWith("go"))).toBe(false);

    // Engine is ready: the same position is searched again
    await page.evaluate(() => window.__bot.handleResponse("readyok"));
    lines = await sent(page);
    expect(lines.some((l) => l.startsWith("position"))).toBe(true);
    expect(lines[lines.length - 1]).toBe("go infinite");
  });

  test("a button option during a search waits for the engine to stop", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.__bot.isInteractiveEnabled = true;
    });
    await sent(page);
    await page.evaluate(() => window.__bot.sendAction("Clear Hash"));
    expect(await sent(page)).toEqual(["stop"]);
    await page.evaluate(() => window.__bot.handleResponse("bestmove d4"));
    const lines = await sent(page);
    expect(lines).toContain("setoption name Clear Hash");
    expect(lines.some((l) => l.startsWith("go"))).toBe(false);
  });

  test("a sweep isn't cut short: options apply before its next search", async ({
    page,
  }) => {
    // Mid-sweep: a search is running for the current position
    await page.evaluate(() => {
      window.__bot.setState({ isRunning: true, isAnalyzingBranch: true });
      window.__bot.applyOptions();
    });
    expect(await sent(page)).toEqual([]);

    // The sweep moves on to its next position
    await page.evaluate(() => {
      const bot = window.__bot;
      const ply = window.app.$game.plies[0];
      bot.searchPosition(6, 0, ply.tpsAfter, ply.id, false);
    });
    let lines = await sent(page);
    expect(optionLines(lines)[0]).toContain("name Threads ");
    expect(lines[lines.length - 1]).toBe("isready");
    expect(lines.some((l) => l.startsWith("go"))).toBe(false);

    await page.evaluate(() => window.__bot.handleResponse("readyok"));
    lines = await sent(page);
    expect(lines.some((l) => l.startsWith("position"))).toBe(true);
    expect(lines.some((l) => l.startsWith("go"))).toBe(true);
  });
});
