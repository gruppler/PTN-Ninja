// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * In the image and GIF export dialogs, Player Names and Flat Counts depend on
 * Turn Indicator: their toggles must be usable exactly when Turn Indicator is
 * on, matching how their rows look.
 */

const row = (page, label) =>
  page.locator(".q-dialog .q-item").filter({
    has: page.locator(".q-item__label", { hasText: new RegExp(`^${label}$`) }),
  });

const toggleIsDisabled = (page, label) =>
  row(page, label)
    .locator(".q-toggle")
    .evaluate((el) => el.classList.contains("disabled"));

for (const route of ["image", "gif"]) {
  test(`${route} dialog: Turn Indicator enables Player Names and Flat Counts`, async ({
    page,
  }) => {
    await page.goto("/" + route);
    await page.waitForSelector(".q-dialog .q-item");
    const turnIndicator = row(page, "Turn Indicator").locator(".q-toggle");

    for (const on of [true, false]) {
      const isOn =
        (await turnIndicator.getAttribute("aria-checked")) === "true";
      if (isOn !== on) {
        await turnIndicator.click();
      }
      await expect(turnIndicator).toHaveAttribute("aria-checked", String(on));
      for (const label of ["Player Names", "Flat Counts"]) {
        expect(await toggleIsDisabled(page, label)).toBe(!on);
        await expect(row(page, label)).toHaveClass(
          on ? /^(?!.*disabled)/ : /disabled/
        );
      }
    }
  });
}
