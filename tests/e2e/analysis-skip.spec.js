// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * A sweep skips positions that are already analyzed deeply enough — and only
 * those.
 *
 * Results held in memory have always been judged on depth: a stored result
 * counts as done only if it reached half the configured node/time budget, so
 * raising the budget re-analyzes. Saved results were judged on existence
 * alone, which left a fully-analyzed game with no way to run a deeper sweep:
 * every position was skipped, and the "nothing left to analyze" notice
 * offered to clear *unsaved* results, which by definition changed nothing.
 * The only way through was deleting the saved results by hand.
 */

// Ply 2's Tiltak note in this PTN reports 126449 nodes over 1807 ms.
const SAVED_NODES = 126449;

const PTN_WITH_ANALYSIS = `[Size "6"]
[Opening "swap"]

1. a6 {name:"Tiltak (wasm)" +0.208/12 143449 nodes 1807ms pv> f6 d4} f1
2. f4 {name:"Tiltak (wasm)" +0.1/10 ${SAVED_NODES} nodes 1807ms pv> c3 f3} d4
`;

async function loadPTN(page, ptn) {
  await page.evaluate(async (ptnText) => {
    await window.app.$store.dispatch("game/ADD_GAME", {
      ptn: ptnText,
      name: "Analysis Skip Test",
    });
  }, ptn);
  await page.waitForFunction(
    () => {
      const game = window.app && window.app.$game;
      return game && game.plies && game.plies.length >= 4;
    },
    { timeout: 10000 }
  );
}

// `bot.settings` is a getter bound to the store (analysis/mutations ADD_BOT),
// so it has to be set the way the UI sets it — assigning to it silently does
// nothing.
const SET_BUDGET = `
  const store = window.app.$store;
  store.commit("analysis/SET", ["botID", "tiltak"]);
  const all = store.state.analysis.botSettings;
  await store.dispatch("analysis/SET", [
    "botSettings",
    {
      ...all,
      tiltak: { ...all.tiltak, limitTypes: ["nodes"], nodes: budget },
    },
  ]);
  const bot = store.getters["analysis/bot"];
`;

/** Ask the tiltak bot how it judges a result at a given node budget. */
async function judge(page, { nodes, budget }) {
  return page.evaluate(
    new Function(
      "args",
      `return (async ({ nodes, budget }) => {
        ${SET_BUDGET}
        return {
          sufficient: bot.meetsAnalysisBudget({ nodes, time: 1807 }),
          budget: bot.getAnalysisBudget(),
        };
      })(args)`
    ),
    { nodes, budget }
  );
}

test.describe("Analysis sweep skipping", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });
  });

  test("judges an existing result against the configured budget", async ({
    page,
  }) => {
    await loadPTN(page, PTN_WITH_ANALYSIS);

    // A budget the saved result already covers — nothing to gain.
    const covered = await judge(page, {
      nodes: SAVED_NODES,
      budget: SAVED_NODES,
    });
    expect(covered.budget.nodeLimit).toBe(SAVED_NODES);
    expect(covered.sufficient).toBe(true);

    // Ten times the nodes: the saved result is well under half, so it is
    // worth searching again. This is the case that used to be unreachable.
    const deeper = await judge(page, {
      nodes: SAVED_NODES,
      budget: SAVED_NODES * 10,
    });
    expect(deeper.sufficient).toBe(false);
  });

  test("skips saved positions only until the budget outgrows them", async ({
    page,
  }) => {
    await loadPTN(page, PTN_WITH_ANALYSIS);

    const botName = "Tiltak (wasm)";
    const countToAnalyze = (budget, force = false) =>
      page.evaluate(
        new Function(
          "args",
          `return (async ({ budget, force, botName }) => {
            ${SET_BUDGET}
            return bot.getPositionsToAnalyze(true, null, {
              shouldAnalyzePosition: bot.getSavedResultFilter(botName),
              force,
            }).length;
          })(args)`
        ),
        { budget, force, botName }
      );

    const result = {
      atSavedDepth: await countToAnalyze(SAVED_NODES),
      deeper: await countToAnalyze(SAVED_NODES * 10),
      forced: await countToAnalyze(SAVED_NODES, true),
      all: await page.evaluate(() => {
        const store = window.app.$store;
        store.commit("analysis/SET", ["botID", "tiltak"]);
        return store.getters["analysis/bot"].getPositionsToAnalyze(true, null, {
          force: true,
        }).length;
      }),
    };

    // The two positions carrying saved notes drop out at their own depth...
    expect(result.atSavedDepth).toBe(result.all - 2);
    // ...and come back once the budget outgrows what they recorded.
    expect(result.deeper).toBe(result.all);
    // Forcing ignores saved results entirely.
    expect(result.forced).toBe(result.all);
  });
});
