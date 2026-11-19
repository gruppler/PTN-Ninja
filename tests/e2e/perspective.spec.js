// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Perspective 0 is orthographic: the board drawn without perspective, in
 * place of the old Orthographic switch, which carries over to it.
 */

const ready = (page) =>
  page.waitForFunction(() => window.app && window.app.$game, null, {
    timeout: 60000,
  });
const ui = (page, key) =>
  page.evaluate((key) => window.app.$store.state.ui[key], key);
const setUI = (page, key, value) =>
  page.evaluate(
    ([key, value]) => window.app.$store.dispatch("ui/SET_UI", [key, value]),
    [key, value]
  );
// The perspective the 3D board is drawn with
const drawnPerspective = (page) =>
  page.evaluate(
    () => getComputedStyle(document.querySelector(".board-space")).perspective
  );

test("the slider goes to 0, which draws the board without perspective", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  const entry = await page.evaluate(() =>
    window.app.$settingsRegistry.byId("ui:perspective")
  );
  expect(entry.min).toBe(0);
  expect(
    await page.evaluate(() =>
      window.app.$settingsRegistry.byId("ui:orthographic")
    )
  ).toBeUndefined();

  await setUI(page, "board3D", true);
  await setUI(page, "perspective", 5);
  await expect.poll(() => drawnPerspective(page)).not.toBe("none");
  await setUI(page, "perspective", 0);
  await expect.poll(() => drawnPerspective(page)).toBe("none");
  await setUI(page, "perspective", 5);
  await setUI(page, "board3D", false);
});

test("a saved Orthographic becomes a perspective of 0", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  // As an earlier version stored it, through Quasar's LocalStorage
  await page.evaluate(() => {
    window.app.$q.localStorage.set("orthographic", true);
    window.app.$q.localStorage.set("perspective", 7);
  });
  await page.reload();
  await ready(page);
  expect(await ui(page, "perspective")).toBe(0);
  expect(
    await page.evaluate(() => window.app.$q.localStorage.has("orthographic"))
  ).toBe(false);
  // Kept from now on
  await page.reload();
  await ready(page);
  expect(await ui(page, "perspective")).toBe(0);
});

test("an embed's host setting the old switch gets a perspective of 0", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await setUI(page, "perspective", 5);
  await page.evaluate(() =>
    window.app.$store.commit("ui/SET_UI", ["orthographic", true])
  );
  expect(await ui(page, "perspective")).toBe(0);
  expect(await ui(page, "orthographic")).toBeUndefined();
});
