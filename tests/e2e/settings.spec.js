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
