// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Analyze Position on a position the side to move has lost says so, and lists
 * the defenses that hold out longest, even where the position is opened cold
 * with nothing before it to have been proven a tinuë.
 *
 * White has a three-ply tinuë here; after c3< black is lost in two.
 */
const BEFORE =
  "1S,1,2,22211S,1S/2,1,1S,x,1S/1,1S,1C,1,x/x,22,211,121,x/2C,221,x,21,21 1 56";

async function ready(page) {
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
}

test("a lost position opened cold lists its three longest defenses", async ({
  page,
}) => {
  await ready(page);
  const found = await page.evaluate(async (before) => {
    const store = window.app.$store;
    // The position after the winning move, as a game's starting position
    await store.dispatch("game/ADD_GAME", {
      ptn: `[Size "5"]\n[TPS "${before}"]\n\n56. c3<`,
      name: "Tinue Winners",
    });
    const lost = window.app.$game.plies.find((ply) => ply).tpsAfter;
    await store.dispatch("game/ADD_GAME", {
      ptn: `[Size "5"]\n[TPS "${lost}"]\n\n56. -- a2`,
      name: "Lost Cold",
    });
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
    await bot.analyzeCurrentPosition();
    const tps = store.state.game.position.tps;
    const listed = (store.state.analysis.botPositions[bot.id] || {})[tps] || [];
    return {
      isLostPosition: tps === lost,
      asked,
      verdict: bot.state.tinueVerdict,
      scores: listed.map((s) => s.scoreText),
      lines: listed.map((s) =>
        [s.ply, ...(s.followingPlies || [])].map((ply) =>
          String((ply && ply.text) || ply)
        )
      ),
    };
  }, BEFORE);

  expect(found.isLostPosition).toBe(true);
  // Nothing came before this position, so nothing else was searched
  expect(found.asked).toEqual(["stream", "defenses"]);
  expect(found.verdict.tinue).toBe(false);
  expect(found.verdict.lostIn).toBe(1);
  expect(found.lines.length).toBeGreaterThan(0);
  expect(found.lines.length).toBeLessThanOrEqual(3);
  // Each defense comes with the move that beats it, and no two fall to the
  // same one
  for (const line of found.lines) {
    expect(line.length).toBe(2);
  }
  const answers = found.lines.map((line) => line[1]);
  expect(new Set(answers).size).toBe(answers.length);
  expect(new Set(found.scores)).toEqual(new Set(["R1"]));
});

test("the Tinuë Solver has no Edit Engine dialog to open", async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const store = window.app.$store;
    await store.dispatch("analysis/SET", [
      "activeBots",
      ["tiltak", "tinue-solver"],
    ]);
    await window.app.$router.push("/settings/analysis/engines").catch(() => {});
  });
  const solver = page.locator('.settings-dialog [data-engine="tinue-solver"]');
  const tiltak = page.locator('.settings-dialog [data-engine="tiltak"]');
  await expect(solver).toBeVisible();
  // Another engine's row leads to its dialog; the solver's leads nowhere
  await expect(tiltak).toHaveAttribute("href", /engine\/tiltak/);
  await expect(solver).not.toHaveAttribute("href", /.*/);
  await solver.click();
  await expect(page).toHaveURL(/settings\/analysis\/engines/);
});
