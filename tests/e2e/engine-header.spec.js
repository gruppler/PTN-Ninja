// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * What the engine panel shows about an engine.
 *
 * The generic TEI engine stays "TEI" until what it's connected to is saved as
 * an engine of its own; what it reports about itself goes underneath. The
 * engines that ship with the app show their names, and their authors. And an
 * option the engine declares starts at its default.
 */

async function open(page, botID) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$game, null, {
    timeout: 60000,
  });
  await page.evaluate(async (botID) => {
    const store = window.app.$store;
    await store.dispatch("game/ADD_GAME", {
      ptn: '[Size "6"]\n\n1. a1 f6\n',
      name: "Engine Header",
    });
    await store.dispatch("ui/SET_UI", ["showText", true]);
    await store.dispatch("ui/SET_UI", ["textTab", "engines"]);
    store.commit("analysis/SET", ["botID", botID]);
    store.commit("analysis/ADD_ACTIVE_BOT", botID);
  }, botID);
}

test("a connected TEI engine's name, version and author go under the TEI header", async ({
  page,
}) => {
  await open(page, "tei");
  await page.evaluate(() => {
    window.app.$store.commit("analysis/SET_BOT_META", {
      botID: "tei",
      changes: { name: "syntaks", version: "0.1.0", author: "Ciekce and chef" },
    });
  });

  const panel = page.locator(".bot-suggestions", { hasText: "TEI" });
  await expect(panel).toContainText("TEI");
  const caption = panel.locator(".q-item__label--caption", {
    hasText: "syntaks",
  });
  await expect(caption).toContainText("0.1.0");
  await expect(caption).toContainText("Ciekce and chef");
  // The version isn't beside the TEI title
  await expect(
    panel.locator(".q-item__label:not(.q-item__label--caption) .bot-version")
  ).toHaveCount(0);
});

test("the built-in engines show their names and authors", async ({ page }) => {
  await open(page, "tiltak");
  const panel = page.locator(".bot-suggestions").first();
  await expect(panel).toContainText("Tiltak (wasm)");
  await expect(panel).toContainText("Morten Lohne");

  expect(
    await page.evaluate(() => window.app.$store.getters["analysis/bot"].label)
  ).toBe("Tiltak (wasm)");
  expect(
    await page.evaluate(() => window.app.$i18n.t("analysis.engines.syntaks"))
  ).toBe("syntaks (wasm)");
});

test("an option declared by the engine starts at its default", async ({
  page,
}) => {
  await open(page, "tei");
  await page.evaluate(() => {
    window.app.$store.commit("analysis/SET_BOT_STATE", {
      botID: "tei",
      changes: { isConnected: true },
    });
    window.app.$store.commit("analysis/SET_BOT_META", {
      botID: "tei",
      changes: {
        options: { Hash: { type: "spin", default: 64, min: 1, max: 1024 } },
      },
    });
    // Open the engine's settings
    const walk = (vm) => {
      if ("showBotSettings" in (vm.$data || {}) && vm.botID === "tei") {
        vm.showBotSettings = true;
      }
      vm.$children.forEach(walk);
    };
    walk(window.app);
  });
  await expect(page.locator('input[aria-label="Hash"]').first()).toHaveValue(
    "64"
  );
});
