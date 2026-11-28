// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Find Quiet Tinuës: a quiet tinuë is a forced road win whose first move
 * threatens nothing, so the strict search, which only follows road threats,
 * can't find it. 3b3+ here is one, five plies long.
 */
const PTN = `[Size "5"]
[TPS "2,2,x,x,1/2,2,x,1,x/x,212,1,x,x/x,1,1,x,x/1,x,x,x,x 2 8"]

8. -- a2
`;

async function open(page, findQuietTinue) {
  await page.goto("/");
  await page.waitForFunction(
    () =>
      window.app &&
      window.app.$store &&
      window.app.$game &&
      window.app.$store.state.game.list.length > 0,
    null,
    { timeout: 30000 }
  );
  await page.evaluate(
    async ({ ptn, findQuietTinue }) => {
      const store = window.app.$store;
      await store.dispatch("game/ADD_GAME", { ptn, name: "Quiet Tinue" });
      store.commit("analysis/SET", ["botID", "tinue-solver"]);
      const bot = store.getters["analysis/bot"];
      bot.settings.findQuietTinue = findQuietTinue;
    },
    { ptn: PTN, findQuietTinue }
  );
  await page.waitForFunction(
    () => window.app.$store.getters["analysis/bot"].id === "tinue-solver"
  );
}

// Analyze the starting position and give the solver's verdict on it, the
// kinds of search it asked its worker for, and the score of its suggestion
const analyze = (page, depth) =>
  page.evaluate(async (depth) => {
    const store = window.app.$store;
    const first = window.app.$game.plies.find((ply) => ply);
    await store.dispatch("game/GO_TO_PLY", { plyID: first.id, isDone: false });
    const bot = store.getters["analysis/bot"];
    if (depth) {
      bot.settings.depth = depth;
    }
    const asked = [];
    const onSend = bot.onSend.bind(bot);
    bot.onSend = (request) => {
      asked.push(request.kind + (request.scope ? ":" + request.scope : ""));
      return onSend(request);
    };
    await bot.analyzeCurrentPosition();
    const { tinue, scope, aborted } = bot.state.tinueVerdict;
    const tps = store.state.game.position.tps;
    const found = (store.state.analysis.botPositions[bot.id] || {})[tps] || [];
    return {
      tinue,
      scope,
      aborted,
      asked,
      scores: found.map((suggestion) => suggestion.scoreText),
      firstMoves: found.map((suggestion) =>
        String((suggestion.ply && suggestion.ply.text) || suggestion.ply)
      ),
    };
  }, depth);

test.describe("Tinue solver: Find Quiet Tinuës", () => {
  test("off, a quiet tinuë is not found, and the verdict says only that no strict one was", async ({
    page,
  }) => {
    await open(page, false);
    const verdict = await analyze(page);
    expect(verdict.tinue).toBe(false);
    expect(verdict.aborted).toBe(false);
    expect(verdict.scope).not.toBe("full");
  });

  test("on, the same search goes on to every move and finds it", async ({
    page,
  }) => {
    await open(page, true);
    const verdict = await analyze(page);
    expect(verdict.tinue).toBe(true);
    expect(verdict.scope).toBe("full");
    // Strict first, then a proof that a win exists, then the shortest line,
    // then the other winning first moves
    expect(verdict.asked).toEqual([
      "stream:tak-chain",
      "prove",
      "stream:full",
      "winners:full",
    ]);
    // Three moves: the five plies it is known to take
    expect(verdict.scores).toContain("R3");
    expect(verdict.firstMoves).toContain("3b3+");
  });

  test("on, with too little Depth for the shortest line, the proof is the answer", async ({
    page,
  }) => {
    await open(page, true);
    // The shortest line is five plies; the search for it may only go to three
    const verdict = await analyze(page, 3);
    expect(verdict.tinue).toBe(true);
    expect(verdict.scope).toBe("full");
    expect(verdict.scores.length).toBe(1);
    expect(verdict.scores[0]).toMatch(/^R≤\d+$/);
    expect(verdict.firstMoves).toEqual(["3b3+"]);
  });
});
