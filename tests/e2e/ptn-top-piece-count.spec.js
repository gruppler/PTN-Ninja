// @ts-check
const { test, expect } = require("@playwright/test");
const { openApp, loadPTN } = require("./helpers");

/**
 * Minimal notation keeps the "1" of a stack move that takes the top piece of
 * a taller stack, and drops it only when the piece is the whole stack. The
 * ply's `text`, which the app matches moves by, never carries it.
 */

// 2. b1< moves a lone piece (stack of 1) onto a1, making a stack of 2.
// 3. 1a1+ takes its top piece. The PTN is written against the rule both
// ways, to show the output doesn't depend on how the input was written.
const PTN = '[Size "5"]\n[Opening "swap"]\n\n1. a1 b1\n2. 1b1< a2\n3. a1+ b2\n';

const plies = (page) =>
  page.evaluate(() =>
    window.app.$store.state.game.ptn.allPlies.filter(Boolean).map((ply) => ({
      text: ply.text,
      count: ply.minPieceCount,
    }))
  );

test("a stack move's 1 is written unless it takes the whole stack", async ({
  page,
}) => {
  await openApp(page);
  await loadPTN(page, PTN);

  const list = await plies(page);
  expect(list[2]).toEqual({ text: "b1<", count: "" });
  expect(list[4]).toEqual({ text: "a1+", count: "1" });

  const ptn = await page.evaluate(() => window.app.$game.toString());
  expect(ptn).toContain("2. b1< a2");
  expect(ptn).toContain("3. 1a1+ b2");

  // The move list shows it too
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll(".ptn.ply span.ply")]
      .map((el) => el.textContent.replace(/\s+/g, ""))
      .filter((text) => /a1\+|b1</.test(text))
  );
  expect(shown).toContain("1a1+");
  expect(shown).toContain("b1<");
});

test("a move played on the board follows the same rule", async ({ page }) => {
  await openApp(page);
  await loadPTN(page, PTN);

  // a2 now holds two pieces (black under white); b2 holds one black piece
  await page.evaluate(async () => {
    const store = window.app.$store;
    await store.dispatch("game/INSERT_PLY", "a2>");
    await store.dispatch("game/INSERT_PLY", "c1");
    await store.dispatch("game/INSERT_PLY", "2b2>");
    await store.dispatch("game/INSERT_PLY", "c1+");
  });

  const ptn = await page.evaluate(() => window.app.$game.toString());
  expect(ptn).toContain("4. 1a2> c1");
  expect(ptn).toContain("5. 2b2> c1+");
});

test("an engine's line counts each stack as the line goes", async ({
  page,
}) => {
  await openApp(page);
  await loadPTN(
    page,
    PTN.trimEnd() +
      ' {name:"Tiltak" +0.1/10 100000 nodes 1000ms pv> a2> c1 2b2> c1+}\n'
  );

  const line = await page.evaluate(() => {
    const store = window.app.$store;
    const [suggestion] = store.getters["game/suggestions"](
      store.state.game.position.tps
    );
    return [suggestion.ply, ...suggestion.followingPlies].map(
      (ply) => ply.minPieceCount + "|" + ply.text
    );
  });
  expect(line).toEqual(["1|a2>", "|c1", "2|2b2>", "|c1+"]);
});
