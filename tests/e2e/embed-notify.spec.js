// @ts-check
const { test, expect, openApp } = require("./helpers");

/** Post an embed API message, as the parent page would */
const post = (page, action, value) =>
  page.evaluate(
    ({ action, value }) =>
      window.dispatchEvent(
        new MessageEvent("message", { data: { action, value } })
      ),
    { action, value }
  );

// The app may show notifications of its own, so count only these tests' own
const mine = (page) =>
  page.locator(".q-notification", { hasText: /embed-test-(one|two|hi)/ });

test.describe("embed notifications", () => {
  test("an id'd notification is replaced, then dismissed", async ({ page }) => {
    await post(page, "NOTIFY", {
      id: "x",
      message: "embed-test-one",
      timeout: 0,
    });
    await expect(mine(page)).toHaveCount(1);
    await post(page, "NOTIFY", {
      id: "x",
      message: "embed-test-two",
      timeout: 0,
    });
    await expect(mine(page)).toHaveCount(1);
    await expect(mine(page)).toContainText("embed-test-two");
    await post(page, "DISMISS_NOTIFY", { id: "x" });
    await expect(mine(page)).toHaveCount(0);
  });

  test("dismissing an unknown or closed id does nothing", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await post(page, "DISMISS_NOTIFY", { id: "nope" });
    await post(page, "NOTIFY", {
      id: "y",
      message: "embed-test-hi",
      timeout: 0,
    });
    await post(page, "DISMISS_NOTIFY", { id: "y" });
    await post(page, "DISMISS_NOTIFY", { id: "y" });
    await expect(mine(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
