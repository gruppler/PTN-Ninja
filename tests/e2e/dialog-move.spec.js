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

  test("dragging the header moves the dialog, and it reopens centered", async ({
    page,
  }) => {
    await openSettings(page);
    // After the opening transition
    await page.waitForTimeout(400);
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
    await page.waitForTimeout(400);
    const reopened = await box(page);
    expect(Math.round(reopened.x)).toBe(Math.round(start.x));
    expect(Math.round(reopened.y)).toBe(Math.round(start.y));
    await closeSettings(page);
  });

  test("the header stays on screen", async ({ page }) => {
    await openSettings(page);
    await page.waitForTimeout(400);
    const handle = await header(page).boundingBox();
    const x = handle.x + 40;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, -500, { steps: 5 });
    await page.mouse.up();
    expect((await header(page).boundingBox()).y).toBeGreaterThanOrEqual(0);
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

  test("a maximized dialog doesn't move", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 700 });
    await openSettings(page);
    await page.waitForTimeout(400);
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
