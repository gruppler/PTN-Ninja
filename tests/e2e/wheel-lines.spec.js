// @ts-check
const { test, expect } = require("@playwright/test");
const { compressToEncodedURIComponent: compress } = require("lz-string");

/**
 * Firefox reports a mouse wheel notch in lines when deltaMode is read first.
 * One three-line notch must count as one scroll step at the default threshold,
 * the same as a pixel notch of that size, wherever the pointer is.
 */

// Steps taken from the start: the first step finishes ply 0 without
// changing plyIndex
const ply = (page) =>
  page.evaluate(() => {
    const { plyIndex, plyIsDone } = window.app.$store.state.game.position;
    return plyIndex + (plyIsDone ? 1 : 0);
  });

async function wheel(page, deltaMode, deltaY) {
  await page.evaluate(
    ({ deltaMode, deltaY }) => {
      const board = document.querySelector(".board-space");
      const r = board.getBoundingClientRect();
      board.dispatchEvent(
        new WheelEvent("wheel", {
          deltaMode,
          deltaY,
          clientX: r.x + r.width / 2,
          clientY: r.y + r.height / 2,
          bubbles: true,
          cancelable: true,
        })
      );
    },
    { deltaMode, deltaY }
  );
}

test("a line-mode wheel notch steps one ply", async ({ page }) => {
  await page.goto(
    "/" + compress('[Size "5"]\n\n1. a1 e5 2. c3 d4 3. b2 b3') + "&ply=0"
  );
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  await page.waitForSelector(".stone");
  await page.evaluate(async () => {
    await window.app.$store.dispatch("ui/SET_UI", ["scrollNavigation", true]);
    await window.app.$store.dispatch("ui/SET_UI", ["scrollThreshold", 0]);
  });
  const start = await ply(page);

  // DOM_DELTA_LINE, three lines down: one notch
  await wheel(page, 1, 3);
  await expect.poll(() => ply(page)).toBe(start + 1);

  // A pixel-mode notch of the default threshold still steps one too
  const px = await page.evaluate(() => window.devicePixelRatio * 100);
  await wheel(page, 0, px);
  await expect.poll(() => ply(page)).toBe(start + 2);
});
