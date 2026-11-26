// @ts-check
const { test, expect } = require("@playwright/test");
const { compressToEncodedURIComponent: compress } = require("lz-string");

/**
 * An embed doesn't send its host's own commands back, so what does arrive is
 * what the person at the board did. echoHostCommands turns the echoes on.
 */

// Chrome refuses a framed app on another origin without this
test.use({
  launchOptions: {
    args: ["--disable-features=LocalNetworkAccessChecks"],
  },
});

const PTN = '[Size "5"]\n\n1. a1 e5';

async function openEmbed(page, params = "") {
  // A different origin from the app (127.0.0.1 vs localhost), so the app
  // answers its parent. The listener is in place before the frame loads, to
  // hear what the embed says as it starts.
  await page.route("http://localhost:8081/embed-host", (route) =>
    route.fulfill({
      contentType: "text/html",
      body:
        "<script>window.replies = [];" +
        'window.addEventListener("message", ({ data }) => ' +
        "window.replies.push(data));</script>" +
        '<iframe id="embed" style="width:900px;height:700px" ' +
        `src="http://127.0.0.1:8081/${compress(PTN)}${params}"></iframe>`,
    })
  );
  await page.goto("http://localhost:8081/embed-host");
  await page.waitForFunction(() =>
    window.replies.some((r) => r.action === "GAME_STATE")
  );
  await page.waitForTimeout(2000);
}

const send = (page, action, value) =>
  page.evaluate(
    ({ action, value }) =>
      document
        .getElementById("embed")
        .contentWindow.postMessage({ action, value }, "*"),
    { action, value }
  );

const clear = (page) => page.evaluate(() => (window.replies = []));

const actions = (page) =>
  page.evaluate(() => window.replies.map((r) => r.action));

test.describe("embed echoHostCommands", () => {
  test("with echoHostCommands on, the host's commands come back", async ({
    page,
  }) => {
    await openEmbed(page, "&echoHostCommands=true&axisLabels=false");
    expect(
      await page.evaluate(() =>
        window.replies.some(
          (r) => r.action === "SET_UI" && "axisLabels" in r.value
        )
      )
    ).toBe(true);
    await clear(page);
    await send(page, "APPEND_PLY", "a2");
    await page.waitForFunction(() =>
      window.replies.some((r) => r.action === "GAME_STATE")
    );
    expect(await actions(page)).toContain("APPEND_PLY");
  });

  test("by default neither the URL settings nor the host's commands come back", async ({
    page,
  }) => {
    await openEmbed(page, "&axisLabels=false");
    // What the app works out for itself (its board size, being offline) is
    // still news; the settings the URL gave are not
    const boot = await page.evaluate(() =>
      window.replies.filter(
        (r) => r.action === "SET_UI" && "axisLabels" in r.value
      )
    );
    expect(boot).toEqual([]);
    expect(await actions(page)).not.toContain("SET_CURRENT_PTN");

    await clear(page);
    await send(page, "APPEND_PLY", "a2");
    await send(page, "FIRST");
    await send(page, "LAST");
    await send(page, "SET_UI", { axisLabels: true });
    await send(page, "HIGHLIGHT_SQUARES", ["a1"]);
    await send(page, "SET_CURRENT_PTN", PTN);
    await page.waitForFunction(() =>
      window.replies.some((r) => r.action === "GAME_STATE")
    );
    await page.waitForTimeout(1000);
    const heard = [...new Set(await actions(page))];
    expect(heard).toContain("GAME_STATE");
    expect(heard.filter((a) => a !== "GAME_STATE" && a !== "GAME_END")).toEqual(
      []
    );
  });

  test("questions are still answered", async ({ page }) => {
    await openEmbed(page);
    await clear(page);
    await send(page, "GET_THEMES");
    await page.waitForFunction(() =>
      window.replies.some((r) => r.action === "GET_THEMES")
    );
  });

  test("a move made on the board is still reported", async ({ page }) => {
    await openEmbed(page);
    await send(page, "LAST");
    await page.waitForTimeout(500);
    await clear(page);
    await page
      .frameLocator("#embed")
      .locator('.square[data-coord="c3"]')
      .click();
    await page.waitForFunction(() =>
      window.replies.some((r) => r.action === "INSERT_PLY")
    );
    const ply = await page.evaluate(
      () => window.replies.find((r) => r.action === "INSERT_PLY").value
    );
    expect(String(ply)).toContain("c3");
  });

  test("SET_UI turns it on for the commands that follow", async ({ page }) => {
    await openEmbed(page);
    await send(page, "SET_UI", { echoHostCommands: true });
    await page.waitForTimeout(300);
    await clear(page);
    await send(page, "FIRST");
    await send(page, "LAST");
    await page.waitForFunction(() =>
      window.replies.some((r) => r.action === "LAST")
    );
    expect(await actions(page)).toContain("FIRST");
  });
});
