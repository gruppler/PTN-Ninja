// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * The tinue solver analyzes the position a newly played move leads to, but
 * only when the move was played out of a position it has already answered.
 */
const SOLVED = `[Size "5"]
[TPS "2,2,x2,1/x,2,2,x2/x2,2,2,1/x4,1/1,1,x,1,x 1 7"]

7. e1 c1
8. e4
`;

const UNSEARCHED = `[Size "5"]

1. a1 e5
2. b1
`;

async function loadGame(page, ptn, name) {
  await page.evaluate(
    async ({ ptn, name }) => {
      await window.app.$store.dispatch("game/ADD_GAME", { ptn, name });
    },
    { ptn, name }
  );
  await page.waitForFunction(
    (name) => window.app.$store.state.game.name === name,
    name
  );
  // Loading a game resets the selected engine, so select it afterward
  await page.evaluate(() => {
    const store = window.app.$store;
    store.commit("analysis/SET", ["botID", "tinue-solver"]);
    window.__calls = 0;
    const bot = store.getters["analysis/bot"];
    if (!bot.__wrapped) {
      const analyze = bot.analyzeCurrentPosition.bind(bot);
      bot.analyzeCurrentPosition = () => {
        window.__calls++;
        return analyze();
      };
      bot.__wrapped = true;
    }
  });
}

/** Play `ply` from just after the first ply of the current game */
async function playFromFirst(page, ply) {
  await page.evaluate(async (ply) => {
    const store = window.app.$store;
    const first = window.app.$game.plies.find((ply) => ply);
    await store.dispatch("game/GO_TO_PLY", { plyID: first.id, isDone: true });
    await store.dispatch("game/INSERT_PLY", ply);
  }, ply);
  // Give a triggered search time to start
  await page.waitForTimeout(500);
}

test.describe("Tinue solver: analyze a played move", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(
      () => window.app && window.app.$store && window.app.$game,
      null,
      { timeout: 30000 }
    );
  });

  test("a new move out of an analyzed position is analyzed", async ({
    page,
  }) => {
    await loadGame(page, SOLVED, "Played Solved");
    await page.evaluate(() =>
      window.app.$store.getters["analysis/bot"].analyzeBranch()
    );
    await page.evaluate(() => (window.__calls = 0));

    await playFromFirst(page, "a4");
    expect(await page.evaluate(() => window.__calls)).toBe(1);
  });

  test("a new move out of an unsearched position is not", async ({ page }) => {
    await loadGame(page, UNSEARCHED, "Played Unsearched");
    await playFromFirst(page, "c1");
    expect(await page.evaluate(() => window.__calls)).toBe(0);
  });

  test("replaying an existing move is not", async ({ page }) => {
    await loadGame(page, SOLVED, "Played Existing");
    await page.evaluate(() =>
      window.app.$store.getters["analysis/bot"].analyzeBranch()
    );
    await page.evaluate(() => (window.__calls = 0));

    await playFromFirst(page, "c1");
    expect(await page.evaluate(() => window.__calls)).toBe(0);
  });
});

/**
 * The mark belongs to the ply played out of a tinue, so playing the winning
 * move marks it. Here white first plays a4, missing the win that e1 is.
 */
const MISSED = `[Size "5"]
[TPS "2,2,x2,1/x,2,2,x2/x2,2,2,1/x4,1/1,1,x,1,x 1 7"]

7. a4 a3
`;

for (const cold of [false, true]) {
  test(`playing the winning move marks it as tinue (${
    cold ? "saved results" : "solved tree"
  })`, async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(
      () => window.app && window.app.$store && window.app.$game,
      null,
      { timeout: 30000 }
    );
    await loadGame(page, MISSED, `Played Winner ${cold}`);
    await page.evaluate(() =>
      window.app.$store.getters["analysis/bot"].analyzeBranch()
    );
    if (cold) {
      // The solver's table is gone, as after a reload; the results remain
      await page.evaluate(() =>
        window.app.$store.getters["analysis/bot"].clearCaches()
      );
    }

    await page.evaluate(async () => {
      const store = window.app.$store;
      const first = window.app.$game.plies.find((ply) => ply);
      await store.dispatch("game/GO_TO_PLY", {
        plyID: first.id,
        isDone: false,
      });
      await store.dispatch("game/INSERT_PLY", "e1");
    });

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const plies = window.app.$game.plies.filter((ply) => ply);
            const played = plies[plies.length - 1];
            return {
              text: played.text,
              tinue: !!(played.evaluation && played.evaluation.tinue),
            };
          }),
        { timeout: 20000 }
      )
      .toEqual({ text: "e1", tinue: true });
  });
}
