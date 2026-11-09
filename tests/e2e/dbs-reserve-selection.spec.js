// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Clicking a reserve piece in a double black stack game.
 *
 * Only white's first move places two pieces (the double stack). Black's first
 * move is a single piece, like any other swap opening, but clicking a reserve
 * on it used to select two as well.
 */

async function setUp(page, ptn) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  await page.evaluate(async (ptn) => {
    await window.app.$store.dispatch("game/ADD_GAME", {
      ptn,
      name: "DBS reserve",
    });
  }, ptn);
}

const selectedCount = (page) =>
  page.evaluate(() => {
    const game = window.app.$game;
    game.board.selectUnplayedPiece("flat");
    return game.board.selected.pieces.length;
  });

test.describe("Double black stack reserve selection", () => {
  test("white's first move selects two pieces", async ({ page }) => {
    await setUp(page, `[Size "6"]\n[Opening "double black stack"]\n\n`);
    expect(await selectedCount(page)).toBe(2);
  });

  test("black's first move selects one piece", async ({ page }) => {
    await setUp(page, `[Size "6"]\n[Opening "double black stack"]\n\n1. a1`);
    expect(await selectedCount(page)).toBe(1);
  });
});
