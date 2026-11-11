// @ts-check
const { test, expect } = require("@playwright/test");
const { compressToEncodedURIComponent: compress } = require("lz-string");

/**
 * The embed API's theme actions, driven from a page on another origin the way
 * a parent site would.
 */

// Chrome refuses a framed app on another origin without this
test.use({
  launchOptions: {
    args: ["--disable-features=LocalNetworkAccessChecks"],
  },
});

async function openEmbed(page) {
  // A different origin from the app (127.0.0.1 vs localhost), so the app
  // answers its parent
  await page.route("http://localhost:8081/embed-host", (route) =>
    route.fulfill({
      contentType: "text/html",
      body:
        '<iframe id="embed" style="width:900px;height:700px" ' +
        `src="http://127.0.0.1:8081/${compress(
          '[Size "5"]\n\n1. a1 e5'
        )}"></iframe>`,
    })
  );
  await page.goto("http://localhost:8081/embed-host");
  await page.evaluate(() => {
    window.replies = [];
    window.addEventListener("message", ({ data }) => window.replies.push(data));
  });
  await page
    .frameLocator("#embed")
    .locator("body")
    .waitFor({ state: "attached" });
  await page.waitForTimeout(3000);
}

const ask = async (page, action, value) => {
  await page.evaluate(
    ({ action, value }) => {
      window.replies = [];
      document
        .getElementById("embed")
        .contentWindow.postMessage({ action, value }, "*");
    },
    { action, value }
  );
  await page.waitForFunction(
    (action) => window.replies.some((r) => r.action === action),
    action
  );
  return page.evaluate(
    (action) => window.replies.find((r) => r.action === action).value,
    action
  );
};

test.describe("embed API themes", () => {
  test("GET_THEMES answers with every theme", async ({ page }) => {
    await openEmbed(page);
    const themes = await ask(page, "GET_THEMES");
    expect(Array.isArray(themes)).toBe(true);
    expect(themes.map((t) => t.id)).toContain("classic");
  });

  test("SET_UI theme moves GET_THEME along with the board", async ({
    page,
  }) => {
    await openEmbed(page);
    const themes = await ask(page, "GET_THEMES");
    const other = themes.find((t) => t.id !== "classic");
    await page.evaluate((theme) => {
      document
        .getElementById("embed")
        .contentWindow.postMessage({ action: "SET_UI", value: { theme } }, "*");
    }, other);
    await expect
      .poll(async () => (await ask(page, "GET_THEME")).id)
      .toBe(other.id);
  });
});
