// @ts-check
const { test, expect } = require("@playwright/test");
const { compressToEncodedURIComponent: compress } = require("lz-string");

/**
 * showToolbarAnalysisBtn: an embed's host can hide the button that shows and
 * hides the suggestion bar, and with the bar hidden too, show analysis on the
 * board alone.
 */

// Chrome refuses a framed app on another origin without this
test.use({
  launchOptions: {
    args: ["--disable-features=LocalNetworkAccessChecks"],
  },
});

async function openEmbed(page, params = "") {
  // A different origin from the app (127.0.0.1 vs localhost), as a parent
  // site would be
  await page.route("http://localhost:8081/embed-host", (route) =>
    route.fulfill({
      contentType: "text/html",
      body:
        "<script>window.replies = [];" +
        'window.addEventListener("message", ({ data }) => ' +
        "window.replies.push(data));</script>" +
        '<iframe id="embed" style="width:900px;height:700px" ' +
        `src="http://127.0.0.1:8081/${compress(
          '[Size "5"]\n\n1. a1 e5'
        )}${params}"></iframe>`,
    })
  );
  await page.goto("http://localhost:8081/embed-host");
  await page.waitForFunction(() =>
    window.replies.some((r) => r.action === "GAME_STATE")
  );
  await page.waitForTimeout(2000);
  const frame = page.frameLocator("#embed");
  await send(page, "LAST");
  await send(page, "SET_ANALYSIS", {
    suggestions: [{ pv: ["c3"], evaluation: 80 }],
  });
  // The suggestion, drawn on the board
  await expect(frame.locator("svg.analysis-overlay rect").first()).toBeAttached(
    { timeout: 10000 }
  );
  return frame;
}

const send = (page, action, value) =>
  page.evaluate(
    ({ action, value }) =>
      document
        .getElementById("embed")
        .contentWindow.postMessage({ action, value }, "*"),
    { action, value }
  );

test.describe("embed showToolbarAnalysisBtn", () => {
  test("by default the button is there", async ({ page }) => {
    const frame = await openEmbed(page);
    await expect(frame.locator(".toolbar-analysis-toggle")).toBeVisible();
  });

  test("turned off, the button is gone and the bar stays", async ({ page }) => {
    const frame = await openEmbed(page, "&showToolbarAnalysisBtn=false");
    await expect(frame.locator(".toolbar-analysis-toggle")).toHaveCount(0);
    await expect(frame.locator(".toolbar-analysis").first()).toBeVisible();

    // The host closes the bar itself, and the suggestion stays on the board
    await send(page, "SET_UI", { showToolbarAnalysis: false });
    await expect(frame.locator(".toolbar-analysis")).toHaveCount(0);
    await expect(
      frame.locator("svg.analysis-overlay rect").first()
    ).toBeAttached();
  });

  test("with the bar off as well, only the board shows the analysis", async ({
    page,
  }) => {
    const frame = await openEmbed(
      page,
      "&showToolbarAnalysisBtn=false&showToolbarAnalysis=false"
    );
    await expect(frame.locator(".toolbar-analysis-toggle")).toHaveCount(0);
    await expect(frame.locator(".toolbar-analysis")).toHaveCount(0);
    const box = await frame
      .locator(".toolbar-analysis-container")
      .boundingBox();
    expect(box ? box.height : 0).toBe(0);
  });
});
