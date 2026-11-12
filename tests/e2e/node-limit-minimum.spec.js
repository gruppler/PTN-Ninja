// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * The node limit takes any positive count: 100 nodes is valid, not flagged as
 * below a minimum. The arrow keys still step along multiples of 1,000.
 */

async function openLimits(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$game, null, {
    timeout: 60000,
  });
  await page.evaluate(async () => {
    const store = window.app.$store;
    await store.dispatch("game/ADD_GAME", {
      ptn: '[Size "6"]\n\n1. a1 f6\n',
      name: "Node Limit",
    });
    await store.dispatch("ui/SET_UI", ["showText", true]);
    await store.dispatch("ui/SET_UI", ["textTab", "engines"]);
    store.commit("analysis/SET", ["botID", "tiltak"]);
    store.commit("analysis/ADD_ACTIVE_BOT", "tiltak");
  });
  const panel = page.locator(".bot-suggestions").first();
  // The header's buttons are the engine icon, the gear, then the menu
  await panel.locator(".sticky-header button").nth(1).click();
  const field = panel.locator("label", { hasText: "Nodes" }).locator("input");
  await field.waitFor();
  return field;
}

const isInvalid = (field) =>
  field.evaluate((el) => !!el.closest(".q-field--error"));

test("a small node limit isn't flagged invalid", async ({ page }) => {
  const field = await openLimits(page);
  for (const text of ["100", "1"]) {
    await field.fill(text);
    await expect.poll(() => isInvalid(field)).toBe(false);
  }
  await field.fill("0");
  await expect.poll(() => isInvalid(field)).toBe(true);
});

test("the arrow keys step along multiples of 1,000", async ({ page }) => {
  const field = await openLimits(page);
  await field.fill("100");
  await field.press("ArrowUp");
  await expect(field).toHaveValue(/^1[,.\s ]?000$/);
  await field.fill("2500");
  await field.press("ArrowDown");
  await expect(field).toHaveValue(/^2[,.\s ]?000$/);
  await field.fill("500");
  await field.press("ArrowDown");
  await expect(field).toHaveValue("1");
});

test("deleting the leading digit keeps the zeros to type over", async ({
  page,
}) => {
  const field = await openLimits(page);
  const group = /^000[,.\s ]000$/;
  await field.fill("1000000");
  await field.press("Home");
  await field.press("Delete");
  await expect(field).toHaveValue(group);
  // Typing the new digit in front of them
  await field.press("Home");
  await field.pressSequentially("2");
  await expect(field).toHaveValue(/^2[,.\s ]000[,.\s ]000$/);
  await expect.poll(() => isInvalid(field)).toBe(false);

  // Changing the 1 by typing over it
  await field.fill("1000000");
  await field.press("Home");
  await field.press("Shift+ArrowRight");
  await field.pressSequentially("3");
  await expect(field).toHaveValue(/^3[,.\s ]000[,.\s ]000$/);

  // Leaving the field settles an all-zero entry
  await field.fill("1000000");
  await field.press("Home");
  await field.press("Delete");
  await field.blur();
  await expect(field).toHaveValue("0");
});
