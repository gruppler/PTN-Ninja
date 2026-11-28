// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Analyze Position shows its first winning move at once, then goes on to
 * list the others. This position is a three-ply tinuë with five winning
 * first moves; c3< is the one that was played.
 */
const WINNERS = ["3b1+", "3c2<21", "c2<", "c3-", "c3<"];
const PTN = `[Size "5"]
[TPS "1S,1,2,22211S,1S/2,1,1S,x,1S/1,1S,1C,1,x/x,22,211,121,x/2C,221,x,21,21 1 56"]

56. c3<
`;

test("Analyze Position lists every winning first move, the played one first", async ({
  page,
}) => {
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
  const found = await page.evaluate(async (ptn) => {
    const store = window.app.$store;
    await store.dispatch("game/ADD_GAME", { ptn, name: "Tinue Winners" });
    store.commit("analysis/SET", ["botID", "tinue-solver"]);
    const bot = store.getters["analysis/bot"];
    const first = window.app.$game.plies.find((ply) => ply);
    await store.dispatch("game/GO_TO_PLY", { plyID: first.id, isDone: false });

    const asked = [];
    const onSend = bot.onSend.bind(bot);
    bot.onSend = (request) => {
      asked.push(request.kind);
      return onSend(request);
    };
    // The list as it stood each time it was shown
    const shown = [];
    const storeResults = bot.storeResults.bind(bot);
    bot.storeResults = (bundle) => {
      shown.push(bundle.suggestions.map((s) => String(s.pv[0])));
      return storeResults(bundle);
    };

    await bot.analyzeCurrentPosition();
    const tps = store.state.game.position.tps;
    const listed = (store.state.analysis.botPositions[bot.id] || {})[tps] || [];
    const played = window.app.$game.plies.find((ply) => ply);
    return {
      asked,
      shown,
      moves: listed.map((s) => String((s.ply && s.ply.text) || s.ply)),
      scores: listed.map((s) => s.scoreText),
      playedIsMarked: !!(played.evaluation && played.evaluation.tinue),
    };
  }, PTN);

  expect(found.asked).toContain("winners");
  // One winning move first, then the rest as they are confirmed
  expect(found.shown[0]).toHaveLength(1);
  // The played move is asked before the others, so it is in the list by
  // the time it holds two moves
  const firstTwo = found.shown.find((moves) => moves.length === 2);
  expect(firstTwo).toContain("c3<");
  // and the list grows one move at a time
  expect(found.shown[found.shown.length - 1]).toHaveLength(WINNERS.length);
  expect([...found.moves].sort()).toEqual(WINNERS);
  // All of them are roads in two moves
  expect(new Set(found.scores)).toEqual(new Set(["R2"]));
  expect(found.playedIsMarked).toBe(true);
});
