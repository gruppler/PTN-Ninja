// @ts-check
const { test, expect } = require("@playwright/test");
const { compressToEncodedURIComponent: compress } = require("lz-string");

/**
 * What an embed tells its host as it loads: READY once its game is there, or
 * ERROR when the game in its URL can't be loaded.
 */

// Chrome refuses a framed app on another origin without this
test.use({
  launchOptions: {
    args: ["--disable-features=LocalNetworkAccessChecks"],
  },
});

async function openEmbed(page, ptn, params = "") {
  // A different origin from the app (127.0.0.1 vs localhost), as a parent
  // site would be. The listener is in place before the frame loads.
  await page.route("http://localhost:8081/embed-host", (route) =>
    route.fulfill({
      contentType: "text/html",
      body:
        "<script>window.replies = [];" +
        'window.addEventListener("message", ({ data }) => ' +
        "window.replies.push(data));</script>" +
        '<iframe id="embed" style="width:900px;height:700px" ' +
        `src="http://127.0.0.1:8081/${compress(ptn)}${params}"></iframe>`,
    })
  );
  await page.goto("http://localhost:8081/embed-host");
}

const heard = (page, action) =>
  page.evaluate(
    (action) =>
      window.replies.filter((r) => r.action === action).map((r) => r.value),
    action
  );

test.describe("embed loading", () => {
  test("READY follows the first GAME_STATE, once, with the settings", async ({
    page,
  }) => {
    await openEmbed(page, '[Size "5"]\n\n1. a1 e5', "&showRoads=true");
    await page.waitForFunction(() =>
      window.replies.some((r) => r.action === "READY")
    );
    await page.waitForTimeout(2000);
    const order = await page.evaluate(() =>
      window.replies.map((r) => r.action)
    );
    expect(order.indexOf("GAME_STATE")).toBeGreaterThan(-1);
    expect(order.indexOf("READY")).toBeGreaterThan(order.indexOf("GAME_STATE"));
    const ready = await heard(page, "READY");
    expect(ready).toHaveLength(1);
    expect(ready[0].version).toMatch(/^\d+\.\d+\.\d+/);
    expect(ready[0].ui.showRoads).toBe(true);
    expect(await heard(page, "ERROR")).toEqual([]);
  });

  test("ERROR is sent instead when the game can't be loaded", async ({
    page,
  }) => {
    await openEmbed(page, '[Size "5"]\n\n1. z9 e5');
    await page.waitForFunction(() =>
      window.replies.some((r) => r.action === "ERROR")
    );
    await page.waitForTimeout(2000);
    const errors = await heard(page, "ERROR");
    expect(errors).toHaveLength(1);
    expect(typeof errors[0].message).toBe("string");
    expect(errors[0].message.length).toBeGreaterThan(0);
    expect(await heard(page, "READY")).toEqual([]);
  });
});
