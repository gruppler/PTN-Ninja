// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Errors show where they come from and say what went wrong: the opening
 * database's in its panel, an engine's in its section and in a notification
 * that names it. Never a bare "Failed to fetch".
 */

const DB = "**/api/v1/";
const DATABASES = [{ id: 0, size: 6, include_bot_games: true, min_rating: 0 }];
const notifications = (page) => page.locator(".q-notification");

async function openApp(page, tab) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$game, null, {
    timeout: 60000,
  });
  await page.evaluate(async (tab) => {
    const store = window.app.$store;
    await store.dispatch("game/ADD_GAME", {
      ptn: '[Size "6"]\n\n1. a1 f6\n',
      name: "Error Messages",
    });
    await store.dispatch("ui/SET_UI", ["showText", true]);
    await store.dispatch("ui/SET_UI", ["textTab", tab]);
  }, tab);
}

test.describe("opening database", () => {
  test("an unreachable database says so in its panel, not a notification", async ({
    page,
  }) => {
    // As a refused or offline request reaches the page: "Failed to fetch"
    await page.route(DB + "**", (route) => route.abort("failed"));
    await openApp(page, "openings");

    const error = page.locator(".opening-db-error").first();
    await expect(error).toBeVisible();
    await expect(error).toContainText("Couldn't reach the opening database");
    await expect(notifications(page)).toHaveCount(0);
    await expect(page.getByText(/failed to fetch/i)).toHaveCount(0);

    // Reachable again: Retry clears it
    await page.unroute(DB + "**");
    await page.route(DB + "databases", (route) =>
      route.fulfill({ json: DATABASES })
    );
    await page.route(DB + "opening/**", (route) =>
      route.fulfill({ json: { moves: [], games: [], settings: {} } })
    );
    await error.getByRole("button", { name: "Retry" }).click();
    await expect(page.locator(".opening-db-error")).toHaveCount(0);
    await expect(notifications(page)).toHaveCount(0);
  });

  test("a server error names its status", async ({ page }) => {
    await page.route(DB + "databases", (route) =>
      route.fulfill({ json: DATABASES })
    );
    await page.route(DB + "opening/**", (route) =>
      route.fulfill({ status: 500, body: "" })
    );
    await page.route(DB + "players", (route) =>
      route.fulfill({ json: { white: [], black: [] } })
    );
    await openApp(page, "openings");

    const error = page.locator(".opening-db-error").first();
    await expect(error).toBeVisible();
    await expect(error).toContainText(
      "Couldn't load from the opening database: it answered with error 500"
    );
    await expect(notifications(page)).toHaveCount(0);
  });
});

test.describe("engines", () => {
  test("an engine that fails to start says so, and which engine", async ({
    page,
  }) => {
    // Tiltak's worker starts as the page loads; a missing script is the
    // error a broken deploy gives, one with no message of its own
    await page.route("**/tiltak-wasm/tiltak.worker.js", (route) =>
      route.fulfill({ status: 404, body: "" })
    );
    // It fails while the page loads, and its notification can be gone by
    // the time the page is ready: keep every one that appears
    await page.addInitScript(() => {
      window.__notifications = [];
      new MutationObserver(() => {
        document.querySelectorAll(".q-notification").forEach((el) => {
          if (!el.__seen) {
            el.__seen = true;
            window.__notifications.push(el.innerText);
          }
        });
      }).observe(document, { childList: true, subtree: true });
    });
    await openApp(page, "engines");
    await page.evaluate(() => {
      const store = window.app.$store;
      store.commit("analysis/SET", ["botID", "tiltak"]);
      store.commit("analysis/ADD_ACTIVE_BOT", "tiltak");
    });

    const message = "Tiltak (wasm) couldn't start.";
    await expect
      .poll(() => page.evaluate(() => window.__notifications))
      .toContainEqual(expect.stringContaining(message));
    // And in its own section, until it's dismissed
    const error = page.locator(".bot-suggestions .bot-error").first();
    await expect(error).toContainText(message);
    // The error as it came can be copied, saying which script didn't start
    await expect(error.locator(".bot-error-copy")).toBeVisible();
    expect(
      await page.evaluate(
        () => window.app.$store.state.analysis.botStates.tiltak.errorDetail
      )
    ).toContain("tiltak-wasm/tiltak.worker.js");
    await error.locator(".bot-error-dismiss").click();
    await expect(page.locator(".bot-suggestions .bot-error")).toHaveCount(0);
  });

  test("a network error is described, with the engine's name", async ({
    page,
  }) => {
    await openApp(page, "engines");
    await page.evaluate(() => {
      const store = window.app.$store;
      store.commit("analysis/SET", ["botID", "tiltak"]);
      store.commit("analysis/ADD_ACTIVE_BOT", "tiltak");
      store.getters["analysis/bot"].onError(new TypeError("Failed to fetch"));
    });
    const message =
      "Couldn't reach Tiltak (wasm). Check your connection, or try again later.";
    await expect(notifications(page).filter({ hasText: message })).toHaveCount(
      1
    );
    await expect(
      page.locator(".bot-suggestions .bot-error").first()
    ).toContainText(message);
    await expect(page.getByText(/^failed to fetch$/i)).toHaveCount(0);
  });
});
