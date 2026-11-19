// @ts-check
const { test, expect, loadPTN } = require("./helpers");

/**
 * The scrub bar moves only by its thumb: a press on its track, easy to make
 * by accident, leaves the game where it is.
 */

const GAME = '[Size "5"]\n\n1. a1 e5 2. c3 e4 3. d3 b2 4. b3 d4 5. a2 c2';

const plyText = (page) =>
  page.evaluate(() => {
    const { ply, plyIsDone } = window.app.$store.state.game.position;
    return ply ? ply.text + (plyIsDone ? " done" : "") : null;
  });

test.describe("scrub bar", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() =>
      window.app.$store.dispatch("ui/SET_UI", ["showScrubber", true])
    );
    await loadPTN(page, GAME);
    await page.evaluate(() => window.app.$store.dispatch("game/LAST", {}));
    await expect.poll(() => plyText(page)).toBe("c2 done");
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() =>
      window.app.$store.dispatch("ui/SET_UI", ["showScrubber", false])
    );
  });

  const parts = async (page) => {
    const track = await page.locator(".scrubber").first().boundingBox();
    const thumb = await page
      .locator(".scrubber .q-slider__thumb")
      .first()
      .boundingBox();
    return { track, thumb };
  };

  test("a click on the track doesn't jump there", async ({ page }) => {
    const { track } = await parts(page);
    await page.mouse.click(
      track.x + track.width * 0.2,
      track.y + track.height / 2
    );
    await page.waitForTimeout(300);
    expect(await plyText(page)).toBe("c2 done");
  });

  test("a drag that starts on the track doesn't move it", async ({ page }) => {
    const { track } = await parts(page);
    const y = track.y + track.height / 2;
    await page.mouse.move(track.x + track.width * 0.3, y);
    await page.mouse.down();
    await page.mouse.move(track.x + track.width * 0.1, y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await plyText(page)).toBe("c2 done");
  });

  test("dragging the thumb moves through the game", async ({ page }) => {
    const { track, thumb } = await parts(page);
    const y = thumb.y + thumb.height / 2;
    // At the end of the bar, the thumb's middle is the window's edge
    await page.mouse.move(
      Math.min(thumb.x + thumb.width / 2, track.x + track.width - 3),
      y
    );
    await page.mouse.down();
    await page.mouse.move(track.x + track.width * 0.3, y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => plyText(page)).not.toBe("c2 done");
  });
});
