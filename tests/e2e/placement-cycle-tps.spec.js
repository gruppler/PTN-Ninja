// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Clicking a square again cycles its placement (flat, wall, capstone) by
 * replacing the ply. The replacement started from the position the previous
 * variant left on the board, so its tpsBefore was that position, and eval
 * marks compared each variant with the one before it instead of with the
 * previous ply.
 */
test("a cycled placement starts from the position before it", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });

  const result = await page.evaluate(async () => {
    const store = window.app.$store;
    await store.dispatch("game/ADD_GAME", {
      ptn: '[Size "6"]\n\n1. a1 f1\n',
      name: "Placement Cycle",
    });
    const game = window.app.$game;
    const last = () => game.plies.filter(Boolean).pop();
    const before = [];

    for (let i = 0; i < 4; i++) {
      await store.dispatch("game/SELECT_SQUARE", { square: "a6" });
      before.push({
        text: last().text,
        tpsBefore: last().tpsBefore,
        plyCount: game.plies.filter(Boolean).length,
      });
    }
    return { before, previousTpsAfter: game.plies[1].tpsAfter };
  });

  expect(result.before.map((b) => b.text)).toEqual(["a6", "Sa6", "Ca6", "a6"]);
  for (const b of result.before) {
    expect(b.tpsBefore).toBe(result.previousTpsAfter);
    expect(b.plyCount).toBe(3);
  }
});
