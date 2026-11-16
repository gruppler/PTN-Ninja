// @ts-check
const { test, expect } = require("./helpers");

/**
 * Dialogs move by dragging their header, and open in the center again
 * every time: the position isn't kept.
 */

const openSettings = async (page) => {
  await page.evaluate(async () => {
    await window.app.$router.push("/settings/general").catch(() => {});
  });
  await expect(page.locator(".settings-dialog")).toBeVisible();
};
const closeSettings = async (page) => {
  await page.evaluate(async () => {
    await window.app.$router.push("/").catch(() => {});
  });
  await expect(page.locator(".settings-dialog")).toHaveCount(0);
};

test.describe("movable dialogs", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await closeSettings(page);
  });

  const box = (page) =>
    page.locator(".large-dialog .q-layout-container").first().boundingBox();
  const header = (page) => page.locator(".large-dialog .q-header").first();
  // Until the opening transition, which scales the dialog in, has finished:
  // the header measures the same twice running
  const settled = async (page) => {
    let last = null;
    await expect
      .poll(
        async () => {
          const b = await header(page).boundingBox();
          const same =
            !!b &&
            !!last &&
            b.width > 0 &&
            Math.abs(b.width - last.width) < 0.5 &&
            Math.abs(b.y - last.y) < 0.5;
          last = b;
          return same;
        },
        { intervals: [100] }
      )
      .toBe(true);
  };

  test("dragging the header moves the dialog, and it reopens centered", async ({
    page,
  }) => {
    await openSettings(page);
    await settled(page);
    const start = await box(page);
    const handle = await header(page).boundingBox();
    // The header's left part, away from its buttons
    const x = handle.x + 40;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 100, y + 60, { steps: 5 });
    await page.mouse.up();
    const moved = await box(page);
    expect(Math.round(moved.x - start.x)).toBe(-100);
    expect(Math.round(moved.y - start.y)).toBe(60);
    // Still open: the drag's click didn't reach anything
    await expect(page.locator(".settings-dialog")).toBeVisible();

    await closeSettings(page);
    await openSettings(page);
    await settled(page);
    const reopened = await box(page);
    expect(Math.round(reopened.x)).toBe(Math.round(start.x));
    expect(Math.round(reopened.y)).toBe(Math.round(start.y));
    await closeSettings(page);
  });

  test("a dragged dialog stays entirely on screen", async ({ page }) => {
    await openSettings(page);
    await settled(page);
    // Far past each edge in turn
    for (const [dx, dy] of [
      [0, -2000],
      [0, 2000],
      [-2000, 0],
      [2000, 0],
    ]) {
      const handle = await header(page).boundingBox();
      const x = handle.x + 40;
      const y = handle.y + handle.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 5 });
      await page.mouse.up();
      const b = await box(page);
      const where = `after dragging by ${dx}, ${dy}`;
      expect(b.x, where).toBeGreaterThanOrEqual(-0.5);
      expect(b.y, where).toBeGreaterThanOrEqual(-0.5);
      expect(b.x + b.width, where).toBeLessThanOrEqual(1280 + 0.5);
      expect(b.y + b.height, where).toBeLessThanOrEqual(900 + 0.5);
      // Against the edge it was dragged toward
      if (dx < 0) expect(Math.round(b.x)).toBe(0);
      if (dx > 0) expect(Math.round(b.x + b.width)).toBe(1280);
      if (dy < 0) expect(Math.round(b.y)).toBe(0);
      if (dy > 0) expect(Math.round(b.y + b.height)).toBe(900);
    }
    await closeSettings(page);
  });

  test("a click on a header button still works", async ({ page }) => {
    await openSettings(page);
    // The close button, first in the header's reversed row of buttons
    await page
      .locator(".large-dialog .q-header .q-item__section--side .q-btn")
      .first()
      .click();
    await expect(page.locator(".settings-dialog")).toHaveCount(0);
  });

  test("a moved dialog that grows stays on screen", async ({ page }) => {
    await page.evaluate(async () => {
      await window.app.$router.push("/info/edit").catch(() => {});
    });
    const dialog = page.locator(".large-dialog .q-layout-container").first();
    await expect(dialog).toBeVisible();
    await settled(page);
    // Up against the top of the window
    const handle = await header(page).boundingBox();
    const x = handle.x + 40;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, 0, { steps: 5 });
    await page.mouse.up();
    expect(Math.round((await dialog.boundingBox()).y)).toBe(0);

    // More makes it taller, growing up as well as down from the center
    const before = (await dialog.boundingBox()).height;
    await page
      .locator(".large-dialog .q-footer .q-btn", { hasText: "More" })
      .click();
    await expect
      .poll(async () => (await dialog.boundingBox()).height)
      .toBeGreaterThan(before + 100);
    // After its height has eased to the new one
    await page.waitForTimeout(600);
    const after = await dialog.boundingBox();
    expect(after.y).toBeGreaterThanOrEqual(0);
    expect(after.y + after.height).toBeLessThanOrEqual(900 + 0.5);
    expect((await header(page).boundingBox()).y).toBeGreaterThanOrEqual(0);

    await page.evaluate(async () => {
      await window.app.$router.push("/").catch(() => {});
    });
    await expect(page.locator(".large-dialog")).toHaveCount(0);
  });

  test("a maximized dialog doesn't move", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 700 });
    await openSettings(page);
    await settled(page);
    const start = await box(page);
    const handle = await header(page).boundingBox();
    const x = handle.x + 40;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 80, { steps: 5 });
    await page.mouse.up();
    expect(await box(page)).toEqual(start);
    await closeSettings(page);
  });
});
