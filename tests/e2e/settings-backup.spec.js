// @ts-check
const fs = require("fs");
const { devices } = require("@playwright/test");
const { test, expect } = require("./helpers");

/**
 * Settings > General > Backup: exporting the settings to a file and
 * importing them back. Each test has a page of its own, since an import
 * rewrites the stored settings and reloads.
 */

const ready = (page) =>
  page.waitForFunction(() => window.app && window.app.$store, null, {
    timeout: 30000,
  });

async function freshPage(browser, baseURL, storage = {}) {
  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    baseURL,
  });
  const page = await context.newPage();
  await page.goto("/");
  await ready(page);
  // Through the store, which stores each value as the app does
  await page.evaluate(async (storage) => {
    for (const [key, value] of Object.entries(storage)) {
      await window.app.$store.dispatch("ui/SET_UI", [key, value]);
    }
  }, storage);
  return { context, page };
}

const ui = (page, key) =>
  page.evaluate((key) => window.app.$store.state.ui[key], key);
const analysis = (page, key) =>
  page.evaluate((key) => window.app.$store.state.analysis[key], key);

async function openBackup(page) {
  await page.evaluate(async () => {
    await window.app.$router.push("/settings/general/backup").catch(() => {});
  });
  await expect(
    page.locator('[data-setting="settings:backup"]').first()
  ).toBeVisible();
}

async function exportFile(page) {
  await openBackup(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByText("Export Settings", { exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^ptn-ninja-settings-\d{4}-\d{2}-\d{2}\.json$/
  );
  return JSON.parse(fs.readFileSync(await download.path(), "utf8"));
}

async function importFile(page, data, { confirm = true } = {}) {
  await openBackup(page);
  await page
    .locator('[data-setting="settings:backup"] input[type="file"]')
    .setInputFiles({
      name: "settings.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        typeof data === "string" ? data : JSON.stringify(data)
      ),
    });
  if (confirm) {
    const reloaded = page.waitForEvent("load");
    await page
      .locator(".q-dialog")
      .getByRole("button", { name: "Import" })
      .click();
    await reloaded;
    await ready(page);
  }
}

test.describe("settings backup", () => {
  // Each test loads the app two or three times: once, after an import's
  // reload, and again for a second device
  test.describe.configure({ timeout: 90000 });

  test("exports the stored settings under their registry IDs", async ({
    browser,
  }, testInfo) => {
    const { context, page } = await freshPage(
      browser,
      testInfo.project.use.baseURL,
      {
        showRoads: true,
        sound: "live",
        scrollThreshold: 42,
        boardMenuSections: { onBoard: false },
      }
    );
    const data = await exportFile(page);
    expect(data).toMatchObject({
      format: "ptn-ninja-settings",
      version: 1,
      settings: {
        "ui:showRoads": true,
        "ui:sound": "live",
        "ui:scrollThreshold": 42,
      },
    });
    expect(typeof data.appVersion).toBe("string");
    // What sync never shares stays out
    expect(data.settings).not.toHaveProperty("ui:boardMenuSections");
    // Only what's stored: a setting left at its default isn't listed
    expect(data.settings).not.toHaveProperty("ui:flatCounts");
    await context.close();
  });

  test("imports a file, keeping this device's own settings", async ({
    browser,
  }, testInfo) => {
    const { context, page } = await freshPage(
      browser,
      testInfo.project.use.baseURL,
      {
        // Set on this device: kept
        scrollThreshold: 7,
        // Set here but not in the file: back to its default
        stackCounts: false,
      }
    );
    const defaults = await page.evaluate(
      () => window.app.$store.state.ui.defaults
    );
    await importFile(page, {
      format: "ptn-ninja-settings",
      version: 1,
      settings: {
        "ui:showRoads": true,
        "ui:sound": "off",
        "ui:scrollThreshold": 99,
        // Device-specific, unset here: taken from the file
        "ui:hapticNavControls": !defaults.hapticNavControls,
        "analysis:pvLimit": 3,
        // From a later version: ignored
        "ui:somethingNew": 1,
      },
    });
    expect(await ui(page, "showRoads")).toBe(true);
    expect(await ui(page, "sound")).toBe("off");
    expect(await ui(page, "scrollThreshold")).toBe(7);
    expect(await ui(page, "hapticNavControls")).toBe(
      !defaults.hapticNavControls
    );
    expect(await ui(page, "stackCounts")).toBe(defaults.stackCounts);
    expect(await analysis(page, "pvLimit")).toBe(3);
    expect(await ui(page, "somethingNew")).toBeUndefined();
    await context.close();
  });

  test("an export imports back as it was", async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    const source = await freshPage(browser, baseURL, {
      showRoads: true,
      sound: "live",
      themeID: "aer",
    });
    const data = await exportFile(source.page);
    await source.context.close();

    const target = await freshPage(browser, baseURL);
    await importFile(target.page, data);
    expect(await ui(target.page, "showRoads")).toBe(true);
    expect(await ui(target.page, "sound")).toBe("live");
    expect(await ui(target.page, "themeID")).toBe("aer");
    expect(await ui(target.page, "theme").then((t) => t.id)).toBe("aer");
    await target.context.close();
  });

  test("a file that isn't settings changes nothing", async ({
    browser,
  }, testInfo) => {
    const { context, page } = await freshPage(
      browser,
      testInfo.project.use.baseURL,
      { sound: "live" }
    );
    for (const data of [
      "not json",
      { format: "something-else", settings: {} },
    ]) {
      await importFile(page, data, { confirm: false });
      await expect(page.locator(".q-notification").last()).toContainText(
        "isn't a PTN Ninja settings file"
      );
      await expect(
        page.getByRole("button", { name: "Import", exact: true })
      ).toHaveCount(0);
    }
    expect(await ui(page, "sound")).toBe("live");
    await context.close();
  });
});
