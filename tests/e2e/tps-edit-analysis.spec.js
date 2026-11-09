// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Analysis while editing a position (TPS edit mode).
 *
 * The engine used to keep analyzing the position it was on when editing
 * began: it followed the board's position, which only navigation and moves
 * refresh, so edits never reached it. It now analyzes the position being
 * edited, as a bare TPS since no ply of the game leads to it, and leaves
 * what it finds out of the game.
 *
 * The engine is simulated: `send` is recorded, and replies are fed to
 * `handleResponse`.
 */

const META = {
  name: "Edit Test",
  author: "Test",
  connection: { address: "localhost", port: 1, ssl: false },
  limitTypes: { depth: { min: 1, max: 100, step: 1 } },
  options: {},
  presetOptions: {},
};

const PLAYED = `[Size "5"]\n[Opening "swap"]\n\n1. a1 e5\n2. b1 d5\n`;
// Four in a row on the first rank, one square short of a road
const ONE_SHORT = `[Size "5"]\n[TPS "x5/x5/x5/x5/1,1,1,1,x 2 3"]\n\n`;

async function setUp(page, ptn = PLAYED) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  await page.evaluate(
    async ({ meta, ptn }) => {
      const store = window.app.$store;
      await store.dispatch("game/ADD_GAME", {
        ptn,
        name: "TPS edit analysis",
      });
      await store.dispatch("analysis/SAVE_BOT", { id: "edit-test", meta });
      store.commit("analysis/SET", ["botID", "edit-test"]);
      const bot = store.getters["analysis/bot"];
      window.__sent = [];
      bot.send = (line) => window.__sent.push(line);
      bot.setState({
        isConnected: true,
        isTeiOk: true,
        isReady: true,
        isGameInitialized: true,
        gameID: window.app.$game.name,
        size: 5,
        halfKomi: 0,
      });
      window.__bot = bot;
    },
    { meta: META, ptn }
  );
}

/**
 * Place a white flat on `square` the way a click in edit mode does: the board
 * changes, then the TPS being edited is rebuilt from it.
 */
const editSquare = (page, square) =>
  page.evaluate(async (square) => {
    const store = window.app.$store;
    const game = window.app.$game;
    if (store.state.game.editingTPS === undefined) {
      store.commit("game/EDIT_TPS", game.board.getTPS());
    }
    await store.dispatch("game/SELECT_SQUARE", {
      square,
      alt: false,
      selectedPiece: { color: 1, type: "flat" },
    });
    store.commit("game/EDIT_TPS", game.board.getTPS(1, 3));
    return store.state.game.editingTPS;
  }, square);

const enableInteractive = async (page) => {
  await page.evaluate(() => {
    window.__bot.isInteractiveEnabled = true;
  });
  await sent(page);
};

const sent = (page) =>
  page.evaluate(() => {
    const out = window.__sent;
    window.__sent = [];
    return out;
  });

test.describe("Analysis in TPS edit mode", () => {
  test("analyzes the position being edited", async ({ page }) => {
    await setUp(page);
    await enableInteractive(page);
    const edited = await editSquare(page, "c3");

    // The search on the old position is stopped, then the edited one starts
    expect(await sent(page)).toEqual(["stop"]);
    await page.evaluate(() => window.__bot.handleResponse("bestmove a2"));
    const lines = await sent(page);
    expect(lines).toContain(`position tps ${edited}`);
    expect(lines[lines.length - 1]).toBe("go infinite");
  });

  test("follows each edit", async ({ page }) => {
    await setUp(page);
    await enableInteractive(page);
    await editSquare(page, "c3");
    await sent(page);
    await page.evaluate(() => window.__bot.handleResponse("bestmove a2"));
    await sent(page);

    await editSquare(page, "c4");
    // The piece selector may settle the move number after an edit, so what
    // is searched is whatever is being edited once things have settled
    await page.waitForTimeout(300);
    const edited = await page.evaluate(
      () => window.app.$store.state.game.editingTPS
    );
    await page.evaluate(() => window.__bot.handleResponse("bestmove a2"));
    const lines = await sent(page);
    expect(lines.filter((l) => l.startsWith("position")).pop()).toBe(
      `position tps ${edited}`
    );
  });

  test("doesn't search a position that is already over", async ({ page }) => {
    await setUp(page, ONE_SHORT);
    await enableInteractive(page);
    await editSquare(page, "e1");
    await sent(page);
    await page.evaluate(() => window.__bot.handleResponse("bestmove a2"));
    const lines = await sent(page);
    expect(lines.some((l) => l.startsWith("go"))).toBe(false);
  });

  test("leaves what it finds out of the game", async ({ page }) => {
    await setUp(page);
    await enableInteractive(page);
    const before = await page.evaluate(() => window.app.$game.ptn.text);
    await editSquare(page, "c3");
    await page.evaluate(() => window.__bot.handleResponse("bestmove a2"));
    await page.evaluate(() => {
      window.__bot.handleResponse(
        "info depth 5 time 10 nodes 1000 score cp 30 pv a2 a3"
      );
      window.__bot.saveEvalComments(window.app.$store.state.game.position.tps);
    });
    const after = await page.evaluate(() => window.app.$game.ptn.text);
    expect(after).toBe(before);
  });
});
