// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Analyze Position on the tinue solver marks the winning ply with `"`, the
 * way a branch sweep does, including when the solver's table already holds
 * the answer (exploring a solved tree), which answers without searching.
 *
 * e1 makes a double threat: c1 completes row 1 and e4 completes column e.
 * Black can stop only one, so e1 is a three-ply tinue.
 */
const PTN = `[Size "5"]
[TPS "2,2,x2,1/x,2,2,x2/x2,2,2,1/x4,1/1,1,x,1,x 1 7"]

7. e1 c1
8. e4
`;

async function loadGame(page, name) {
  await page.evaluate(
    async ({ ptn, name }) => {
      await window.app.$store.dispatch("game/ADD_GAME", { ptn, name });
    },
    { ptn: PTN, name }
  );
  await page.waitForFunction(
    (name) => window.app.$store.state.game.name === name,
    name
  );
}

/** Loading a game resets the selected engine, so select it afterward */
async function selectSolver(page) {
  await page.evaluate(() => {
    window.app.$store.commit("analysis/SET", ["botID", "tinue-solver"]);
  });
  await page.waitForFunction(
    () => window.app.$store.getters["analysis/bot"].id === "tinue-solver"
  );
}

/** Whether the first ply (e1) carries the tinue mark */
function firstPlyIsTinue(page) {
  return page.evaluate(() => {
    const ply = window.app.$game.plies.find((ply) => ply);
    return {
      text: ply.text,
      tinue: !!(ply.evaluation && ply.evaluation.tinue),
    };
  });
}

test.describe("Tinue solver: Analyze Position marks tinue", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(
      () => window.app && window.app.$store && window.app.$game,
      null,
      { timeout: 30000 }
    );
  });

  test("on a position the solver has already proven", async ({ page }) => {
    // Prove the tree, which leaves the answer in the solver's table
    await loadGame(page, "Tinue Warm");
    await selectSolver(page);
    await page.evaluate(() =>
      window.app.$store.getters["analysis/bot"].analyzeBranch()
    );
    expect((await firstPlyIsTinue(page)).tinue).toBe(true);

    // The same moves, unmarked, as a different game
    await loadGame(page, "Tinue Cold");
    await selectSolver(page);
    expect((await firstPlyIsTinue(page)).tinue).toBe(false);

    await page.evaluate(async () => {
      const store = window.app.$store;
      const first = window.app.$game.plies.find((ply) => ply);
      await store.dispatch("game/GO_TO_PLY", {
        plyID: first.id,
        isDone: false,
      });
      await store.getters["analysis/bot"].analyzeCurrentPosition();
    });

    expect((await firstPlyIsTinue(page)).tinue).toBe(true);
  });

  test("a sweep names the move played from each position, to be checked first", async ({
    page,
  }) => {
    await loadGame(page, "Tinue Sweep");
    await selectSolver(page);
    const asked = await page.evaluate(async () => {
      const bot = window.app.$store.getters["analysis/bot"];
      const asked = [];
      const onSend = bot.onSend.bind(bot);
      bot.onSend = (request) => {
        if (request.kind === "sweep") {
          asked.push([request.tps.split(" ")[2], request.try_first || ""]);
        }
        return onSend(request);
      };
      await bot.analyzeBranch();
      return asked;
    });
    // By move number: e1 and e4 are White's 7th and 8th, c1 Black's 7th
    const played = asked.map(([, moves]) => moves).filter(Boolean);
    expect(played).toContain("e1");
    expect(played).toContain("c1");
    expect(played).toContain("e4");
    expect((await firstPlyIsTinue(page)).tinue).toBe(true);
  });
});
