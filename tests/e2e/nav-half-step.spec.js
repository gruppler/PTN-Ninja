// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Navigation Half-Step Tests
 *
 * Right-clicking the Back/Forward buttons should move by a half-step, the same
 * as Shift+Arrow. A half-step forward lands on the next ply *undone* (board
 * unchanged, cursor advanced); a full step lands on it done.
 *
 * NavControls wraps prev/next in countedThrottle, which prepends the repeat
 * count as the first argument, so interactions must be spaced beyond the
 * 250ms throttle window to be counted separately.
 */

const PTN = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3
`;

const THROTTLE_MS = 300;

async function loadGame(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  await page.evaluate(async (ptn) => {
    await window.app.$store.dispatch("game/ADD_GAME", {
      ptn,
      name: "Half Step Test",
    });
  }, PTN);
  await page.waitForFunction(() => window.app.$game && window.app.$game.board);
}

/** Park on a ply that has been executed, so half vs. full is distinguishable. */
async function goToDonePly(page) {
  await page.evaluate(async () => {
    const store = window.app.$store;
    await store.dispatch("game/FIRST");
    await store.dispatch("game/NEXT", { half: false, times: 1 });
    await store.dispatch("game/NEXT", { half: false, times: 1 });
  });
  await page.waitForTimeout(100);
}

const snapshot = (page) =>
  page.evaluate(() => {
    const p = window.app.$store.state.game.position;
    return { plyID: p.ply && p.ply.id, plyIsDone: p.plyIsDone };
  });

/** icon: "chevron-left" for Back, "chevron-right" for Forward. */
async function clickNav(page, icon, type) {
  const ok = await page.evaluate(
    ({ iconName, evtType }) => {
      const root = document.querySelector(".play-controls");
      if (!root) return false;
      const btn = Array.from(root.querySelectorAll("button")).find((b) => {
        const i = b.querySelector(".q-icon");
        return i && i.className.includes("mdi-" + iconName);
      });
      if (!btn || btn.disabled) return false;
      btn.dispatchEvent(
        new MouseEvent(evtType, {
          bubbles: true,
          cancelable: true,
          button: evtType === "contextmenu" ? 2 : 0,
        })
      );
      return true;
    },
    { iconName: icon, evtType: type }
  );
  expect(ok).toBe(true);
  await page.waitForTimeout(THROTTLE_MS);
}

test.describe("Navigation Half-Step", () => {
  test("left-click Forward takes a full step", async ({ page }) => {
    await loadGame(page);
    await goToDonePly(page);

    const before = await snapshot(page);
    expect(before.plyIsDone).toBe(true);

    await clickNav(page, "chevron-right", "click");
    const after = await snapshot(page);

    expect(after.plyID).toBe(before.plyID + 1);
    expect(after.plyIsDone).toBe(true);
  });

  test("right-click Forward takes a half-step", async ({ page }) => {
    await loadGame(page);
    await goToDonePly(page);

    const before = await snapshot(page);
    expect(before.plyIsDone).toBe(true);

    await clickNav(page, "chevron-right", "contextmenu");
    const after = await snapshot(page);

    // Half-step: cursor advances, but the ply is not yet executed.
    expect(after.plyID).toBe(before.plyID + 1);
    expect(after.plyIsDone).toBe(false);
  });

  test("right-click Back takes a half-step", async ({ page }) => {
    await loadGame(page);
    await goToDonePly(page);

    const before = await snapshot(page);
    expect(before.plyIsDone).toBe(true);

    await clickNav(page, "chevron-left", "contextmenu");
    const after = await snapshot(page);

    // Half-step back undoes the current ply without changing which ply we're on.
    expect(after.plyID).toBe(before.plyID);
    expect(after.plyIsDone).toBe(false);
  });
});
