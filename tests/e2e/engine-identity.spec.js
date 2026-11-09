// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * What an engine says about itself: its name, version and author.
 *
 * A version in the name ("id name syntaks 0.1.0") is split off. A saved
 * engine can be edited by the user, and the edits stand while the engine keeps
 * saying what it said before; when it says something different, it wins.
 *
 * The engine is simulated: replies are fed to `handleResponse`.
 */

const META = {
  name: "Engine",
  author: "Author",
  version: "1",
  connection: { address: "localhost", port: 1, ssl: false },
  limitTypes: { depth: { min: 1, max: 100, step: 1 } },
  sizeHalfKomis: { 6: [0] },
  options: {},
  presetOptions: {},
};

async function setUp(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  await page.evaluate(async (meta) => {
    const store = window.app.$store;
    await store.dispatch("analysis/SAVE_BOT", { id: "identity-test", meta });
    window.__bot = store.getters["analysis/bot"];
    window.__meta = () => ({
      ...window.app.$store.state.analysis.botMetas["identity-test"],
    });
    window.__saved = () => ({
      ...window.app.$store.state.analysis.customBots["identity-test"].meta,
    });
  }, META);
}

const report = (page, line) =>
  page.evaluate((line) => window.__bot.handleResponse(line), line);
const meta = (page) => page.evaluate(() => window.__meta());
const saved = (page) => page.evaluate(() => window.__saved());

test.describe("engine identity", () => {
  test.beforeEach(async ({ page }) => {
    await setUp(page);
  });

  test("a version in the name is split off", async ({ page }) => {
    // The first report is only a baseline; the ones after it count
    await report(page, "id name Foo 1.0.0");
    await report(page, "id name Foo 2.3.4");
    expect(await meta(page)).toMatchObject({
      name: "Engine",
      version: "2.3.4",
    });

    await report(page, "id name Bar v1.0.0-beta");
    expect(await meta(page)).toMatchObject({
      name: "Bar",
      version: "1.0.0-beta",
    });
  });

  test("a bare number is part of the name", async ({ page }) => {
    await report(page, "id name Engine 1.0");
    await report(page, "id name Stockfish 16");
    expect(await meta(page)).toMatchObject({
      name: "Stockfish 16",
      version: "1",
    });
  });

  test("the first report doesn't replace what's already set", async ({
    page,
  }) => {
    await report(page, "id name Other 9.9");
    await report(page, "id author Someone");
    // Saved before the engine's reports could be compared with anything
    expect(await meta(page)).toMatchObject({
      name: "Engine",
      version: "1",
      author: "Author",
    });
  });

  test("the user's edits stand while the engine says the same", async ({
    page,
  }) => {
    await report(page, "id name Engine 1.0");
    await page.evaluate(async () => {
      await window.app.$store.dispatch("analysis/SAVE_BOT", {
        id: "identity-test",
        meta: { ...window.__meta(), name: "My Engine", author: "Me" },
      });
    });
    await report(page, "id name Engine 1.0");
    expect(await meta(page)).toMatchObject({
      name: "My Engine",
      author: "Me",
      version: "1",
    });
  });

  test("a change by the engine overrides the user's edits, and is saved", async ({
    page,
  }) => {
    await report(page, "id name Engine 1.0");
    await report(page, "id author Original");
    await page.evaluate(async () => {
      await window.app.$store.dispatch("analysis/SAVE_BOT", {
        id: "identity-test",
        meta: { ...window.__meta(), name: "My Engine", author: "Me" },
      });
    });

    // Only what the engine changed is replaced
    await report(page, "id name Engine 1.1");
    for (const read of [meta, saved]) {
      expect(await read(page)).toMatchObject({
        name: "My Engine",
        version: "1.1",
        author: "Me",
      });
    }
    await report(page, "id name Engine Pro 1.1");
    await report(page, "id author Someone Else");
    for (const read of [meta, saved]) {
      expect(await read(page)).toMatchObject({
        name: "Engine Pro",
        version: "1.1",
        author: "Someone Else",
      });
    }
  });
});
