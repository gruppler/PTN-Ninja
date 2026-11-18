// @ts-check
const { test, expect, loadPTN } = require("./helpers");

/**
 * Navigating animates each position, as Lichess does: a new position that
 * arrives while the last is still animating ends that animation at once,
 * where it was going, and animates the new one from there. Only dragging the
 * scrub bar moves without animating.
 */

const GAME = '[Size "5"]\n\n1. a1 e5 2. c3 e4';

const setUI = (page, values) =>
  page.evaluate(async (values) => {
    for (const [key, value] of Object.entries(values)) {
      await window.app.$store.dispatch("ui/SET_UI", [key, value]);
    }
  }, values);

// Whether the top piece on `coord` is still sliding: a running transition
// of its transform
const sliding = (page, coord) =>
  page.evaluate((coord) => {
    const walk = (vm) =>
      vm.$options.name === "Piece" && vm.piece && vm.piece.square === coord
        ? vm
        : vm.$children.map(walk).find(Boolean);
    const piece = walk(window.app);
    if (!piece) return null;
    return piece.$el
      .getAnimations()
      .some(
        (animation) =>
          animation.transitionProperty === "transform" &&
          animation.playState === "running"
      );
  }, coord);

const dispatch = (page, action) =>
  page.evaluate((action) => window.app.$store.dispatch(action, {}), action);
// Two frames: the board has drawn the new position, and its transitions
// have started
const drawn = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );

test.describe("board animation", () => {
  test.beforeEach(async ({ page }) => {
    await setUI(page, { animateBoard: true, board3D: false });
    await loadPTN(page, GAME);
    await dispatch(page, "game/FIRST");
    // Nothing left moving from loading the game
    await page.waitForTimeout(500);
  });

  test("a new position ends the last one's animation, then animates", async ({
    page,
  }) => {
    await dispatch(page, "game/NEXT");
    await drawn(page);
    expect(await sliding(page, "a1")).toBe(true);

    // Well within the first slide's time
    await dispatch(page, "game/NEXT");
    await drawn(page);
    // a1 is on its square already, and e5 slides
    expect(await sliding(page, "a1")).toBe(false);
    expect(await sliding(page, "e5")).toBe(true);
  });

  test("positions further apart each animate to the end", async ({ page }) => {
    await dispatch(page, "game/NEXT");
    await drawn(page);
    expect(await sliding(page, "a1")).toBe(true);
    await expect.poll(() => sliding(page, "a1")).toBe(false);
    await dispatch(page, "game/NEXT");
    await drawn(page);
    expect(await sliding(page, "e5")).toBe(true);
  });

  test("scrolling animates; dragging the scrub bar doesn't", async ({
    page,
  }) => {
    await setUI(page, { scrollNavigation: true, scrollThreshold: 100 });
    const board = await page.locator(".board-container").boundingBox();
    await page.mouse.move(
      board.x + board.width / 2,
      board.y + board.height / 2
    );
    await page.mouse.wheel(0, 100);
    await drawn(page);
    expect(await sliding(page, "a1")).toBe(true);
    await expect(page.locator(".board-container")).not.toHaveClass(
      /\bscrubbing\b/
    );

    // As the scrub bar marks its drag
    await page.waitForTimeout(500);
    await page.evaluate(() =>
      window.app.$store.commit("ui/SET_SCRUBBING", "start")
    );
    await dispatch(page, "game/NEXT");
    await drawn(page);
    await expect(page.locator(".board-container")).toHaveClass(/\bscrubbing\b/);
    expect(await sliding(page, "e5")).toBe(false);
    await page.evaluate(() =>
      window.app.$store.commit("ui/SET_SCRUBBING", "end")
    );
  });
});
