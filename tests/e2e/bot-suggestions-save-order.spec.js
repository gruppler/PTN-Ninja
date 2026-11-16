// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Saving engine results over a position that already has saved results from
 * the same engine must leave the best result first, since the first saved
 * note is what the Saved Results list, the eval bar and the board's
 * suggestion arrows read.
 */

const SIMPLE_PTN = `[Size "6"]
[Komi "2"]

1. a6 f1
2. f4 d4
`;

// Position after ply 2 (f4), where these tests save
const TPS = "2,x5/x6/x5,1/x6/x6/x5,1 2 2";
const PLY_ID = 2;

// The name the built-in engine writes on its notes
const TILTAK = "Tiltak (wasm)";

const note = (move, depth, nodes, evaluation = "+0.1") =>
  `name:"${TILTAK}" ${evaluation}/${depth} ${nodes} nodes 2000ms pv> ${move} f5 f3`;

const result = (move, depth, nodes, evaluation = 10) => ({
  ply: { ptn: move },
  followingPlies: [{ ptn: "f5" }, { ptn: "f3" }],
  time: 3000,
  depth,
  nodes,
  evaluation,
});

async function loadPTN(page, ptn) {
  await page.evaluate(async (ptnText) => {
    await window.app.$store.dispatch("game/ADD_GAME", {
      ptn: ptnText,
      name: "Test Game",
    });
  }, ptn);
  await page.waitForFunction(
    () => window.app.$game && window.app.$game.plies.length > 0,
    { timeout: 10000 }
  );
}

async function setAnalysisSettings(page, settings) {
  await page.evaluate((s) => {
    const store = window.app.$store;
    for (const [key, value] of Object.entries(s)) {
      store.commit("analysis/SET", [key, value]);
    }
  }, settings);
}

async function addNotes(page, plyID, messages) {
  await page.evaluate(
    async ({ id, messages }) => {
      await window.app.$store.dispatch("game/ADD_NOTES", { [id]: messages });
    },
    { id: plyID, messages }
  );
}

// Give the built-in engine `results` for `tps`, then save that position
// (or, with `sweep`, every ply, as Analyze Game does)
async function save(page, tps, results, { sweep = false } = {}) {
  await page.evaluate(
    async ({ tps, results, sweep }) => {
      const store = window.app.$store;
      const originalBotID = store.state.analysis.botID;
      store.commit("analysis/SET", ["botID", "tiltak"]);
      const bot = store.getters["analysis/bot"];
      bot.positions[tps] = results;
      bot.plies = window.app.$game.plies;
      bot.saveEvalComments(sweep ? null : tps);
      await new Promise((resolve) => setTimeout(resolve, 100));
      store.commit("analysis/SET", ["botID", originalBotID]);
    },
    { tps, results, sweep }
  );
}

// This engine's saved notes on the ply, in order, as "move/depth/nodes"
async function savedOrder(page, plyID) {
  return page.evaluate(
    ({ id, name }) =>
      (window.app.$game.notes[id] || [])
        .filter((n) => n.botName === name)
        .map((n) => `${n.pvAfter[0][0]}/${n.depth}/${n.nodes}`),
    { id: plyID, name: TILTAK }
  );
}

// The first saved suggestion for the position, as the app reads it
async function firstSavedSuggestion(page, tps) {
  return page.evaluate(
    ({ tps, name }) => {
      const s = window.app.$store.getters["game/suggestions"](tps).find(
        (s) => s.botName === name
      );
      return s ? `${s.ply.ptn}/${s.depth}/${s.nodes}` : null;
    },
    { tps, name: TILTAK }
  );
}

test.describe("Saved results order", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store);
    await loadPTN(page, SIMPLE_PTN);
    await setAnalysisSettings(page, {
      pvsToSave: 2,
      pvLimit: 5,
      saveSearchStats: true,
    });
  });

  test("a deeper result for the second saved line moves it first", async ({
    page,
  }) => {
    await addNotes(page, PLY_ID, [
      note("e5", 12, 2000000),
      note("e4", 12, 2000000),
    ]);

    // A deeper search now prefers e4, and only its best line is ready
    await save(page, TPS, [result("e4", 14, 3000000)]);

    expect(await savedOrder(page, PLY_ID)).toEqual([
      "e4/14/3000000",
      "e5/12/2000000",
    ]);
    expect(await firstSavedSuggestion(page, TPS)).toBe("e4/14/3000000");
  });

  test("a new best line goes first even when its second line is stale", async ({
    page,
  }) => {
    await addNotes(page, PLY_ID, [
      note("e5", 12, 2000000),
      note("e4", 12, 2000000),
    ]);

    // e4 is now best; the e5 line still holds an earlier, shallower report,
    // so the saved e5 note is kept
    await save(page, TPS, [
      result("e4", 14, 3000000),
      result("e5", 11, 1500000),
    ]);

    expect(await savedOrder(page, PLY_ID)).toEqual([
      "e4/14/3000000",
      "e5/12/2000000",
    ]);
  });

  test("an Analyze Game sweep puts its better result first", async ({
    page,
  }) => {
    await addNotes(page, PLY_ID, [
      note("e5", 12, 2000000),
      note("e4", 12, 2000000),
    ]);

    await save(page, TPS, [result("e4", 14, 3000000)], { sweep: true });

    expect(await savedOrder(page, PLY_ID)).toEqual([
      "e4/14/3000000",
      "e5/12/2000000",
    ]);
  });

  test("a shallower search's new line goes after a deeper saved one", async ({
    page,
  }) => {
    await addNotes(page, PLY_ID, [note("e5", 20, 9000000)]);

    await save(page, TPS, [
      result("c6", 10, 1000000),
      result("e5", 10, 1000000),
    ]);

    expect(await savedOrder(page, PLY_ID)).toEqual([
      "e5/20/9000000",
      "c6/10/1000000",
    ]);
  });
});
