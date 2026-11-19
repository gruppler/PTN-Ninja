// @ts-check
const { test, expect, loadPTN } = require("./helpers");

/**
 * Navigating animates each position. Scrolling with the wheel, as Lichess
 * does: a new position that arrives while the last is still animating ends
 * that animation at once, where it was going, and animates the new one from
 * there. Any other way, what still moves goes on from where it is drawn.
 * Only dragging the scrub bar moves without animating.
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

// The ids of the pieces still sliding, as `sliding` tells it, sorted
const slidingPieces = (page) =>
  page.evaluate(() => {
    const found = [];
    const walk = (vm) => {
      if (
        vm.$options.name === "Piece" &&
        vm.piece &&
        vm.$el
          .getAnimations()
          .some(
            (animation) =>
              animation.transitionProperty === "transform" &&
              animation.playState === "running"
          )
      ) {
        found.push(vm.piece.id);
      }
      vm.$children.forEach(walk);
    };
    walk(window.app);
    return found.sort();
  });

// The id of the top piece on each of `coords`
const piecesOn = (page, coords) =>
  page.evaluate(
    (coords) =>
      coords.map((coord) => {
        const { pieces } = window.app.$store.state.game.board;
        const on = Object.values(pieces).filter(
          (piece) => piece.square === coord
        );
        on.sort((a, b) => b.z - a.z);
        return on.length ? on[0].id : null;
      }),
    coords
  );

// One step by the wheel, over the board, of `plies` plies at the 100 px
// threshold (one wheel event)
const wheelStep = async (page, plies = 1) => {
  const board = await page.locator(".board-container").boundingBox();
  await page.mouse.move(board.x + board.width / 2, board.y + board.height / 2);
  await page.mouse.wheel(0, 100 * plies);
};

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

  test("a step by the wheel ends the last one's animation, then animates", async ({
    page,
  }) => {
    await setUI(page, { scrollNavigation: true, scrollThreshold: 100 });
    await wheelStep(page);
    await drawn(page);
    expect(await sliding(page, "a1")).toBe(true);

    // Well within the first slide's time
    await wheelStep(page);
    await drawn(page);
    // a1 is on its square already, and e5 slides
    expect(await sliding(page, "a1")).toBe(false);
    expect(await sliding(page, "e5")).toBe(true);
  });

  // One wheel event worth three plies: the first two are drawn at once, and
  // only the third's piece slides. The same backwards: only the piece of the
  // last ply undone slides back. From the start, and towards the end with
  // fewer plies left than the step is worth, the last ply taken slides.
  test("a step by the wheel of several plies animates only the last", async ({
    page,
  }) => {
    await setUI(page, {
      scrollNavigation: true,
      scrollThreshold: 100,
      unplayedPieces: true,
    });
    await loadPTN(page, '[Size "5"]\n\n1. a1 e5 2. c3 e4 3. b2 d4');
    // From `ply` plies on, a wheel step of `plies`, once nothing moves and
    // the last scrolling has ended
    const stepFrom = async (ply, plies) => {
      await expect
        .poll(() => page.evaluate(() => window.app.$store.state.ui.scrubbing))
        .toBe(false);
      await page.evaluate(async (ply) => {
        const { dispatch } = window.app.$store;
        await dispatch("game/FIRST");
        for (let i = 0; i < ply; i++) {
          await dispatch("game/NEXT", { half: false, times: 1 });
        }
      }, ply);
      await expect.poll(() => slidingPieces(page)).toEqual([]);
      await wheelStep(page, plies);
      await drawn(page);
    };
    const all = ["a1", "e5", "c3", "e4", "b2", "d4"];
    const ids = await piecesOn(page, all);
    expect(ids).not.toContain(null);
    const [a1, e5, c3, e4, b2, d4] = ids;

    await stepFrom(1, 3);
    expect(await piecesOn(page, all)).toEqual([a1, e5, c3, e4, null, null]);
    expect(await slidingPieces(page)).toEqual([e4]);

    await stepFrom(6, -3);
    expect(await piecesOn(page, all)).toEqual([a1, e5, c3, null, null, null]);
    expect(await slidingPieces(page)).toEqual([e4]);

    await stepFrom(0, 3);
    expect(await piecesOn(page, all)).toEqual([a1, e5, c3, null, null, null]);
    expect(await slidingPieces(page)).toEqual([c3]);

    await stepFrom(5, 3);
    expect(await piecesOn(page, all)).toEqual(ids);
    expect(await slidingPieces(page)).toEqual([d4]);
  });

  test("a step by the hotkey goes on from where the last one is drawn", async ({
    page,
  }) => {
    // Watched in the page: at each new position, whether a1 still slides
    // just before the board takes it, and once it has (its watchers run,
    // finishAnimations among them), and e5 then. The play controls throttle
    // a quick second press to a step 0.25 s after the first, near the end
    // of a1's 0.3 s slide: on a loaded machine it may come after, and then
    // it is tried again.
    const watch = () =>
      page.evaluate(() => {
        // As `sliding` above
        const sliding = (coord) => {
          const walk = (vm) =>
            vm.$options.name === "Piece" &&
            vm.piece &&
            vm.piece.square === coord
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
        };
        window.__seen = [];
        if (window.__unwatch) window.__unwatch();
        window.__unwatch = window.app.$store.watch(
          (state) => state.game.position.tps,
          () => {
            const seen = { before: sliding("a1") };
            window.__seen.push(seen);
            // After the board's own flush
            window.app.$nextTick(() =>
              window.app.$nextTick(() => {
                seen.a1 = sliding("a1");
                seen.e5 = sliding("e5");
              })
            );
          },
          { sync: true }
        );
      });
    let seen;
    for (let attempt = 0; attempt < 5; attempt++) {
      await dispatch(page, "game/FIRST");
      await page.waitForTimeout(500);
      await watch(page);
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() =>
          page.evaluate(
            () => window.__seen.length === 2 && "e5" in window.__seen[1]
          )
        )
        .toBe(true);
      seen = await page.evaluate(() => window.__seen);
      if (seen[1].before) break;
    }
    await page.evaluate(() => window.__unwatch());
    // The second position came while a1 was still sliding...
    expect(seen[1].before).toBe(true);
    // ...and a1 still slides once the board has it, not put on its square,
    // and e5 slides too
    expect(seen[1].a1).toBe(true);
    expect(seen[1].e5).toBe(true);
  });

  test("a step by the wheel right after another way ends that one's animation", async ({
    page,
  }) => {
    await setUI(page, { scrollNavigation: true, scrollThreshold: 100 });
    await dispatch(page, "game/NEXT");
    await drawn(page);
    expect(await sliding(page, "a1")).toBe(true);
    await wheelStep(page);
    await drawn(page);
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
