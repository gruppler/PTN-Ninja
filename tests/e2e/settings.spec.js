// @ts-check
const { test, expect, openApp } = require("./helpers");

/**
 * Settings registry. Every test runs in the page against
 * window.app.$settingsRegistry, the registry module exposed by
 * src/boot/globalComponents.js.
 */

test.describe("settings registry", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test("every ui and analysis default is listed exactly once", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { SETTINGS, UNLISTED } = window.app.$settingsRegistry;
      const state = window.app.$store.state;
      const all = [
        ...Object.keys(state.ui.defaults).map((k) => "ui:" + k),
        ...Object.keys(state.analysis.defaults).map((k) => "analysis:" + k),
      ];
      const listed = [
        ...SETTINGS.map((s) => s.id).filter((id) => id !== "account:status"),
        ...Object.keys(UNLISTED),
      ];
      // ui:boardMenuSections gets its default in a later task
      const pending = ["ui:boardMenuSections"];
      return {
        missing: all.filter((id) => !listed.includes(id)),
        unknown: listed.filter(
          (id) => !all.includes(id) && !pending.includes(id)
        ),
        duplicates: listed.filter((id, i) => listed.indexOf(id) !== i),
      };
    });
    expect(result).toEqual({ missing: [], unknown: [], duplicates: [] });
  });

  test("children sit with their parent", async ({ page }) => {
    const problems = await page.evaluate(() => {
      const { SETTINGS, byId } = window.app.$settingsRegistry;
      const problems = [];
      // Is `id` the parent or a descendant of `rootId`?
      const within = (id, rootId) => {
        for (let e = byId(id); e; e = e.dependsOn && byId(e.dependsOn)) {
          if (e.id === rootId) return true;
        }
        return false;
      };
      SETTINGS.forEach((child, childIndex) => {
        if (!child.dependsOn) return;
        const parent = byId(child.dependsOn);
        if (!parent) {
          problems.push(`${child.id}: no parent ${child.dependsOn}`);
          return;
        }
        if (
          parent.category !== child.category ||
          parent.section !== child.section
        ) {
          problems.push(`${child.id}: different section than its parent`);
        }
        const parentIndex = SETTINGS.indexOf(parent);
        if (parentIndex >= childIndex) {
          problems.push(`${child.id}: does not come after its parent`);
          return;
        }
        SETTINGS.slice(parentIndex + 1, childIndex).forEach((between) => {
          if (!within(between.id, parent.id)) {
            problems.push(`${child.id}: ${between.id} sits between`);
          }
        });
      });
      return problems;
    });
    expect(problems).toEqual([]);
  });

  test("sections and hotkeys exist", async ({ page }) => {
    const problems = await page.evaluate(() => {
      const { SETTINGS, CATEGORIES, HOTKEYS } = window.app.$settingsRegistry;
      const problems = [];
      SETTINGS.forEach((entry) => {
        const category = CATEGORIES.find((c) => c.id === entry.category);
        if (!category) {
          problems.push(`${entry.id}: unknown category ${entry.category}`);
        } else if (!category.sections.some((s) => s.id === entry.section)) {
          problems.push(`${entry.id}: unknown section ${entry.section}`);
        }
        if (entry.hotkey && !(entry.hotkey in HOTKEYS.UI)) {
          problems.push(`${entry.id}: unknown hotkey ${entry.hotkey}`);
        }
      });
      return problems;
    });
    expect(problems).toEqual([]);
  });

  test("hideAnalysisNotes is gone", async ({ page }) => {
    const present = await page.evaluate(
      () => "hideAnalysisNotes" in window.app.$store.state.ui.defaults
    );
    expect(present).toBe(false);
  });
});

/**
 * The Settings dialog. Rows carry data-setting="<id>", categories
 * data-category="<id>" and section headers data-section="<category>/<id>".
 */

/** Set ui values through the store */
async function setUI(page, values) {
  await page.evaluate(async (values) => {
    for (const [key, value] of Object.entries(values)) {
      await window.app.$store.dispatch("ui/SET_UI", [key, value]);
    }
  }, values);
}

async function getUI(page, key) {
  return page.evaluate((key) => window.app.$store.state.ui[key], key);
}

/** Open a URL in a fresh load and wait for the app */
async function openURL(page, path) {
  await page.goto(path);
  await page.waitForFunction(
    () => window.app && window.app.$store && window.app.$game,
    null,
    { timeout: 30000 }
  );
}

/** Open the Settings dialog at a path without reloading */
async function openSettings(page, path = "/settings") {
  await page.evaluate(async (path) => {
    await window.app.$router.push(path).catch(() => {});
  }, path);
  await expect(page.locator(".settings-dialog")).toBeVisible();
}

const row = (page, id) => page.locator(`[data-setting="${id}"]`).first();
const toggle = (page, id) => row(page, id).locator('[role="switch"]').first();

test.describe("settings dialog", () => {
  test.beforeEach(async ({ page }) => {
    // Start from the board with no dialog open
    await page.evaluate(async () => {
      const router = window.app.$router;
      if (router.currentRoute.path !== "/") {
        await router.push("/").catch(() => {});
      }
    });
    await expect(page.locator(".settings-dialog")).toHaveCount(0);
  });

  test("P opens Settings on the Board category", async ({ page }) => {
    await page.keyboard.press("p");
    await expect
      .poll(() => page.evaluate(() => window.app.$route.path))
      .toBe("/settings");
    const board = page.locator('[data-category="board"]');
    await expect(board).toBeVisible();
    await expect(board).toHaveAttribute("aria-current", "true");
    await expect(
      page.locator('[data-section="board/aroundBoard"]')
    ).toContainText(/around the board/i);
  });

  test("deep link opens a section", async ({ page }) => {
    await openURL(page, "/settings/navigation/scrolling");
    const threshold = row(page, "ui:scrollThreshold");
    await expect(threshold).toContainText(/scroll threshold/i);
    await expect(threshold).toBeInViewport();

    // A section further down a long category is scrolled to the top
    await openURL(page, "/settings/analysis/saving");
    const header = page.locator(
      '[data-section="analysis/saving"] .settings-section-header'
    );
    await expect(header).toBeVisible();
    await expect
      .poll(async () => {
        const [section, dialogHeader] = await Promise.all([
          header.boundingBox(),
          page.locator(".settings-dialog .q-header").boundingBox(),
        ]);
        return Math.abs(
          Math.round(section.y - (dialogHeader.y + dialogHeader.height))
        );
      })
      .toBeLessThan(5);
  });

  test("stale deep link falls back", async ({ page }) => {
    await openURL(page, "/settings/nonsense/also-nonsense");
    const board = page.locator('[data-category="board"]');
    await expect(board).toHaveAttribute("aria-current", "true");
    await expect(
      page.locator('[data-section="board/aroundBoard"]')
    ).toBeVisible();
  });

  test("/preferences redirects", async ({ page }) => {
    await openURL(page, "/preferences");
    await expect
      .poll(() => page.evaluate(() => window.app.$route.path))
      .toBe("/settings");
    await expect(page.locator(".settings-dialog")).toBeVisible();
  });

  test("toggling a row writes through the store", async ({ page }) => {
    await openSettings(page, "/settings/board/aroundBoard");
    const before = await getUI(page, "axisLabels");
    await row(page, "ui:axisLabels").click();
    await expect.poll(() => getUI(page, "axisLabels")).toBe(!before);
    await row(page, "ui:axisLabels").click();
    await expect.poll(() => getUI(page, "axisLabels")).toBe(before);
  });

  test("a child is disabled while its parent is off", async ({ page }) => {
    await setUI(page, { scrollNavigation: false });
    await openSettings(page, "/settings/navigation/scrolling");
    const input = row(page, "ui:scrollThreshold").locator("input");
    await expect(input).toBeDisabled();
    await row(page, "ui:scrollNavigation").click();
    await expect.poll(() => getUI(page, "scrollNavigation")).toBe(true);
    await expect(input).toBeEnabled();
  });

  test("clearing the scroll threshold stores 0", async ({ page }) => {
    await setUI(page, { scrollNavigation: true, scrollThreshold: 0 });
    await openSettings(page, "/settings/navigation/scrolling");
    const input = row(page, "ui:scrollThreshold").locator("input");
    await input.fill("25");
    await expect.poll(() => getUI(page, "scrollThreshold")).toBe(25);
    await input.fill("");
    await expect.poll(() => getUI(page, "scrollThreshold")).toBe(0);
    await input.fill("25");
    await expect.poll(() => getUI(page, "scrollThreshold")).toBe(25);
    await row(page, "ui:scrollThreshold")
      .locator(".q-field__focusable-action")
      .click();
    await expect.poll(() => getUI(page, "scrollThreshold")).toBe(0);
  });

  test("center stack counts locks on with small axis labels", async ({
    page,
  }) => {
    await setUI(page, {
      centerStackCounts: false,
      axisLabels: true,
      axisLabelsSmall: true,
    });
    await openSettings(page, "/settings/board/onBoard");
    const center = toggle(page, "ui:centerStackCounts");
    await expect(center).toHaveAttribute("aria-checked", "true");
    await expect(center).toHaveAttribute("aria-disabled", "true");
    await expect(row(page, "ui:centerStackCounts")).toContainText(
      /always on while small axis labels are shown/i
    );
    await setUI(page, { axisLabelsSmall: false });
    await expect(center).toHaveAttribute("aria-checked", "false");
    await expect(center).not.toHaveAttribute("aria-disabled", "true");
    expect(await getUI(page, "centerStackCounts")).toBe(false);
  });

  test("vertical layout requires unplayed pieces", async ({ page }) => {
    await setUI(page, { unplayedPieces: false });
    await openSettings(page, "/settings/board/view");
    await expect(toggle(page, "ui:verticalLayout")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await expect(row(page, "ui:verticalLayout")).toContainText(
      /requires unplayed pieces/i
    );
    await expect(toggle(page, "ui:verticalLayoutAuto")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await setUI(page, { unplayedPieces: true });
  });

  test("add engine opens a new slot in the Engines tab", async ({ page }) => {
    const before = await page.evaluate(
      () => window.app.$store.state.analysis.activeBots.length
    );
    await openSettings(page, "/settings/analysis/engines");
    await page.locator('[data-action="add-engine"]').click();
    await expect(page.locator(".settings-dialog")).toHaveCount(0);
    const state = await page.evaluate(() => {
      const { analysis, ui } = window.app.$store.state;
      return {
        activeBots: analysis.activeBots.slice(),
        showText: ui.showText,
        textTab: ui.textTab,
      };
    });
    expect(state.activeBots.length).toBe(before + 1);
    expect(state.activeBots[before]).toBeNull();
    expect(state.showText).toBe(true);
    expect(state.textTab).toBe("engines");
    // The new slot's engine picker is showing in the Engines tab
    const slots = page.locator(".bot-suggestions");
    await expect(slots).toHaveCount(before + 1);
    await expect(slots.nth(before)).toContainText(/select engine/i);
    await expect(slots.nth(before).locator(".q-select")).toBeVisible();

    await page.evaluate(
      (index) =>
        window.app.$store.dispatch("analysis/REMOVE_ACTIVE_BOT", index),
      before
    );
  });

  test("choosing a category starts at its top", async ({ page }) => {
    await openSettings(page, "/settings/board/view");
    const scrollTop = () =>
      page.evaluate(
        () => document.querySelector(".settings-dialog .scroll").scrollTop
      );
    await expect.poll(scrollTop).toBeGreaterThan(0);
    await page.locator('[data-category="analysis"]').click();
    await expect
      .poll(() => page.evaluate(() => window.app.$route.path))
      .toBe("/settings/analysis");
    await expect.poll(scrollTop).toBe(0);
  });
  test.describe("search", () => {
    const search = (page) => page.getByPlaceholder("Search Settings");
    const settingIds = (page) =>
      page
        .locator(".settings-results [data-setting]")
        .evaluateAll((els) => els.map((e) => e.dataset.setting));

    test("search finds settings by keyword with a breadcrumb", async ({
      page,
    }) => {
      await openSettings(page, "/settings/analysis");
      await search(page).fill("coordinates");
      const result = page.locator(
        '.settings-result[data-result="ui:axisLabels"]'
      );
      await expect(result).toBeVisible();
      await expect(result.locator(".settings-breadcrumb")).toHaveText(
        /board\s*›\s*around the board/i
      );
      await expect(row(page, "ui:axisLabels")).toContainText(/axis labels/i);
      await expect(
        result.locator('[data-setting="ui:axisLabelsSmall"]')
      ).toContainText(/small axis labels/i);
      // Only the matching group, and no child alone at the top
      expect(await settingIds(page)).toEqual([
        "ui:axisLabels",
        "ui:axisLabelsSmall",
      ]);
    });

    test("a child match shows its parent", async ({ page }) => {
      await openSettings(page, "/settings/board");
      await search(page).fill("scrubbing");
      await expect(
        page.locator('.settings-results [data-setting="ui:animateScrub"]')
      ).toBeVisible();
      expect(await settingIds(page)).toEqual([
        "ui:animateBoard",
        "ui:animateScrub",
      ]);
    });

    test("a result can be changed in place", async ({ page }) => {
      await openSettings(page, "/settings/board");
      await search(page).fill("roads");
      const before = await getUI(page, "showRoads");
      await page
        .locator('.settings-results [data-setting="ui:showRoads"]')
        .click();
      await expect.poll(() => getUI(page, "showRoads")).toBe(!before);
    });

    test("no matches says so", async ({ page }) => {
      await openSettings(page, "/settings/board");
      await search(page).fill("zzzz");
      await expect(page.locator(".settings-dialog")).toContainText(
        'No settings match "zzzz"'
      );
      await expect(
        page.locator(".settings-results [data-setting]")
      ).toHaveCount(0);
    });

    test("clearing returns to the category", async ({ page }) => {
      await openSettings(page, "/settings/navigation");
      await search(page).fill("roads");
      await expect(page.locator(".settings-results")).toBeVisible();
      await search(page).fill("");
      await expect(page.locator(".settings-results")).toHaveCount(0);
      await expect(
        page.locator('[data-section="navigation/controls"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-section="navigation/loading"]')
      ).toBeVisible();
    });
  });
});
