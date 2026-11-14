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

test("on a narrow screen, rows of buttons fit their rows", async ({ page }) => {
  await page.goto("/settings/board/sound");
  await page.waitForSelector(".settings-dialog");
  // Every row of buttons, in each category that has them
  const seen = [];
  for (const path of [
    "/settings/board/onBoard",
    "/settings/board/sound",
    "/settings/general",
  ]) {
    await page.evaluate(async (path) => {
      await window.app.$router.push(path).catch(() => {});
    }, path);
    await expect
      .poll(() => page.evaluate(() => window.app.$route.path))
      .toBe(path);
    await expect(
      page.locator(".settings-dialog .setting-buttons").first()
    ).toBeVisible();
    const fits = await page
      .locator(".settings-dialog .setting-buttons")
      .evaluateAll((rows) =>
        rows
          .filter((el) => el.offsetParent)
          .map((el) => {
            const buttons = [...el.querySelectorAll("button")];
            const tops = new Set(
              buttons.map((b) => Math.round(b.getBoundingClientRect().top))
            );
            const row = el.closest("[data-setting]");
            return {
              id: row.dataset.setting,
              overflows:
                el.scrollWidth > el.clientWidth ||
                row.scrollWidth > row.clientWidth,
              wraps: tops.size > 1,
              cut: buttons
                .map((b) => b.querySelector(".block") || b)
                .filter((label) => label.scrollWidth > label.clientWidth)
                .map((label) => label.textContent),
            };
          })
      );
    for (const fit of fits) {
      seen.push(fit.id);
      expect(fit, fit.id).toEqual({
        id: fit.id,
        overflows: false,
        wraps: false,
        cut: [],
      });
    }
  }
  expect(seen).toEqual(
    expect.arrayContaining([
      "ui:highlightSquares",
      "ui:sound",
      "ui:openDuplicate",
    ])
  );
});
