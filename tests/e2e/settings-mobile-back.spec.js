// @ts-check
const { test, expect, devices } = require("@playwright/test");

test.use({ ...devices["Pixel 5"] });

test("on a narrow screen, the header's back arrow returns to the categories", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.waitForSelector(".settings-dialog");
  await page.locator('[data-category="board"]').click();
  await expect
    .poll(() => page.evaluate(() => window.app.$route.path))
    .toBe("/settings/board");

  await page.locator(".settings-dialog .q-item button").first().click();
  await expect
    .poll(() => page.evaluate(() => window.app.$route.path))
    .toBe("/settings");
  await expect(page.locator('[data-category="board"]')).toBeVisible();
});
