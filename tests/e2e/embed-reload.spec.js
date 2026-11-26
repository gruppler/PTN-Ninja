// @ts-check
const { test, expect } = require("@playwright/test");
const { compressToEncodedURIComponent: compress } = require("lz-string");

/**
 * An embed reloads itself when a release has replaced the files it was
 * loaded from. It has to come back as it was given in its URL, and tell its
 * host that it has started again.
 */

// Chrome refuses a framed app on another origin without this
test.use({
  launchOptions: {
    args: ["--disable-features=LocalNetworkAccessChecks"],
  },
});

async function openEmbed(page, ptn, params = "") {
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

const readies = (page) =>
  page.evaluate(() =>
    window.replies.filter((r) => r.action === "READY").map((r) => r.value)
  );

const lastState = (page) =>
  page.evaluate(() => {
    const states = window.replies.filter((r) => r.action === "GAME_STATE");
    return states.length ? states[states.length - 1].value : null;
  });

test("an embed that reloads itself comes back with its game and settings", async ({
  page,
}) => {
  await openEmbed(
    page,
    '[Size "5"]\n[TPS "x5/x5/x2,1,x2/x5/x5 2 1"]\n\n1. -- a1',
    "&showRoads=true"
  );
  await expect.poll(() => readies(page)).toHaveLength(1);
  const before = await lastState(page);
  expect(before.tps).toContain("x2,1,x2");

  const frame = page.frames().find((f) => f.url().includes("127.0.0.1"));
  await frame.evaluate(() => window.location.reload());

  // It says it has started again, with the same settings and game
  await expect.poll(() => readies(page), { timeout: 20000 }).toHaveLength(2);
  const [, second] = await readies(page);
  expect(second.ui.showRoads).toBe(true);
  await expect.poll(async () => (await lastState(page)).tps).toBe(before.tps);
});
