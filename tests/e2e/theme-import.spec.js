// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Importing theme code from Settings and the embed config, without opening
 * the theme editor.
 */

const themeCode = (name) =>
  JSON.stringify({
    name,
    isDark: true,
    colors: { primary: "#336699", secondary: "#996633" },
  });

async function openApp(page) {
  await page.goto("/settings/board");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  await page.waitForSelector(".settings-dialog");
}

const themeID = (page) =>
  page.evaluate(() => window.app.$store.state.ui.themeID);
const savedNames = (page) =>
  page.evaluate(() => window.app.$store.state.ui.themes.map((t) => t.name));

test.describe("theme import", () => {
  test("a readable clipboard imports straight away", async ({ page }) => {
    await page.addInitScript((code) => {
      Object.defineProperty(navigator, "clipboard", {
        value: { readText: () => Promise.resolve(code) },
      });
    }, themeCode("Clip Theme"));
    await openApp(page);

    await page.getByText("Import Theme").click();
    await expect.poll(() => themeID(page)).toBe("clip-theme");
    await expect(page.locator(".import-button textarea")).toBeHidden();
    expect(await savedNames(page)).toContain("Clip Theme");
    expect(page.url()).not.toContain("/theme");
  });

  test("an unreadable clipboard opens a textarea to paste into", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { readText: () => Promise.reject(new Error("denied")) },
      });
    });
    await openApp(page);

    await page.getByText("Import Theme").click();
    const textarea = page.locator(".import-button textarea");
    await expect(textarea).toBeVisible();

    await textarea.fill("not a theme");
    await expect(page.locator(".import-button")).toContainText(
      /valid theme code/i
    );
    expect(await themeID(page)).not.toBe("pasted");

    await textarea.fill(themeCode("Pasted"));
    await expect.poll(() => themeID(page)).toBe("pasted");
    await expect(textarea).toBeHidden();
  });

  test("a name that is taken gets a number", async ({ page }) => {
    await page.addInitScript((code) => {
      Object.defineProperty(navigator, "clipboard", {
        value: { readText: () => Promise.resolve(code) },
      });
    }, themeCode("Classic"));
    await openApp(page);

    await page.getByText("Import Theme").click();
    await expect.poll(() => themeID(page)).toBe("classic-2");
  });

  test("the embed config uses an imported theme", async ({ page }) => {
    await page.addInitScript((code) => {
      Object.defineProperty(navigator, "clipboard", {
        value: { readText: () => Promise.resolve(code) },
      });
    }, themeCode("Embed Theme"));
    await page.goto("/embed");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });

    await page.getByText("Import Theme").click();
    await expect
      .poll(() =>
        page.evaluate(
          () => window.app.$store.state.ui.embedConfig.ui.theme.name
        )
      )
      .toBe("Embed Theme");
    expect(page.url()).not.toContain("/theme");
  });

  test("the theme editor still imports pasted code", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { readText: () => Promise.reject(new Error("denied")) },
      });
    });
    await page.goto("/theme");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });

    await page.getByText("Import", { exact: true }).click();
    await page.locator(".import-button textarea").fill(themeCode("Edited"));
    await expect(
      page.locator('input[aria-label="Name"], input').first()
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.app.$store.state.ui.theme.name))
      .toBe("Edited");
  });
});
