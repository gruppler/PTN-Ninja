// @ts-check
const { test, expect } = require("@playwright/test");
const { compressToEncodedURIComponent: compress } = require("lz-string");

test("S toggles Stack Counts", async ({ page }) => {
  await page.goto("/" + compress('[Size "5"]\n\n1. a1 e5'));
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  await page.waitForSelector(".stone");
  const stackCounts = () =>
    page.evaluate(() => window.app.$store.state.ui.stackCounts);
  const before = await stackCounts();
  await page.locator(".board").click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("Escape");
  await page.keyboard.press("s");
  await expect.poll(stackCounts).toBe(!before);
  await page.keyboard.press("s");
  await expect.poll(stackCounts).toBe(before);
});
