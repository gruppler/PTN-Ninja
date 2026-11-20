// @ts-check
const { test, expect } = require("@playwright/test");
const { openApp, loadPTN } = require("./helpers");

/**
 * Navigation Speed
 *
 * Holding Backward or Forward (button or hotkey) steps once at once, then
 * once every 60000 / playSpeed ms for as long as it is held. The OS's key
 * repeat is ignored. A tap or click is one step.
 *
 * Each test opens its own page, not the shared one: real presses and keys
 * start the page's audio, which later specs expect to find stopped.
 */

// 20 moves (40 plies) of placements on an 8x8 board
const PTN = (() => {
  const squares = [];
  for (const rank of "12345") {
    for (const file of "abcdefgh") {
      squares.push(file + rank);
    }
  }
  let ptn = '[Size "8"]\n[Opening "swap"]\n\n';
  for (let move = 1; move <= 20; move++) {
    ptn += `${move}. ${squares[2 * move - 2]} ${squares[2 * move - 1]}\n`;
  }
  return ptn;
})();

/** Half-steps from the start: a ply's id twice, plus one once it is done */
const halfIndex = (page) =>
  page.evaluate(() => {
    const p = window.app.$store.state.game.position;
    return 2 * (p.ply ? p.ply.id : 0) + (p.plyIsDone ? 1 : 0);
  });

const plyID = (page) =>
  page.evaluate(() => {
    const p = window.app.$store.state.game.position;
    return p.ply ? p.ply.id : null;
  });

async function setup(page, speed) {
  await loadPTN(page, PTN, { expandAll: false, showAllBranches: null });
  await page.evaluate(async (speed) => {
    const store = window.app.$store;
    await store.dispatch("ui/SET_UI", ["showControls", true]);
    await store.dispatch("ui/SET_UI", ["playSpeed", speed]);
    await store.dispatch("game/FIRST");
    await store.dispatch("game/NEXT", { half: false, times: 1 });
    if (document.activeElement) document.activeElement.blur();
  }, speed);
  await page.waitForTimeout(100);
}

const navButton = (page, icon) =>
  page.locator(`.play-controls button:has(.mdi-${icon})`);

/** Press the mouse on a nav button and keep it down */
async function pressButton(page, icon, button = "left") {
  const box = await navButton(page, icon).boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button });
}

/**
 * The OS's key repeat for a key already down, every 33 ms for `ms` ms of wall
 * time: Playwright sends repeat: true for a key that is already down
 */
async function repeatKey(page, key, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await page.waitForTimeout(33);
    await page.keyboard.down(key);
  }
}

test.describe("Navigation Speed", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test.afterEach(async ({ page }) => {
    await page.mouse.up().catch(() => {});
    await page.keyboard.up("ArrowRight").catch(() => {});
    await page.keyboard.up("Shift").catch(() => {});
    await page.evaluate(() =>
      window.app.$store.dispatch("ui/SET_UI", ["playSpeed", 60])
    );
  });

  test("holding Forward at 600 steps about ten plies a second", async ({
    page,
  }) => {
    await setup(page, 600);
    const before = await plyID(page);
    await pressButton(page, "chevron-right");
    await page.waitForTimeout(1200);
    await page.mouse.up();
    const steps = (await plyID(page)) - before;
    // About 12. A dev build on a busy machine spends 150-230 ms on each
    // step, which caps it near 6, so the floor allows for that while staying
    // well clear of the 2 that 60 gives
    expect(steps).toBeGreaterThanOrEqual(5);
    expect(steps).toBeLessThanOrEqual(16);
  });

  test("holding Forward at 60 steps once at once and once a second", async ({
    page,
  }) => {
    await setup(page, 60);
    const before = await plyID(page);
    await pressButton(page, "chevron-right");
    await page.waitForTimeout(150);
    expect((await plyID(page)) - before).toBe(1);
    await page.waitForTimeout(1050);
    await page.mouse.up();
    const steps = (await plyID(page)) - before;
    expect(steps).toBeGreaterThanOrEqual(2);
    expect(steps).toBeLessThanOrEqual(3);
  });

  test("releasing stops it", async ({ page }) => {
    await setup(page, 600);
    await pressButton(page, "chevron-right");
    await page.waitForTimeout(350);
    await page.mouse.up();
    const atRelease = await plyID(page);
    await page.waitForTimeout(500);
    expect(await plyID(page)).toBe(atRelease);
  });

  test("right-click hold steps half-steps", async ({ page }) => {
    await setup(page, 300);
    const before = await halfIndex(page);
    const beforeID = await plyID(page);
    await pressButton(page, "chevron-right", "right");
    await page.waitForTimeout(1200);
    await page.mouse.up({ button: "right" });
    const halves = (await halfIndex(page)) - before;
    expect(halves).toBeGreaterThanOrEqual(4);
    expect(halves).toBeLessThanOrEqual(9);
    // Half-steps, not whole ones
    expect((await plyID(page)) - beforeID).toBeLessThanOrEqual(
      Math.ceil(halves / 2)
    );
  });

  test("a held hotkey steps at the setting's rate, not the key repeat's", async ({
    page,
  }) => {
    await setup(page, 60);
    const before = await plyID(page);
    await page.keyboard.down("ArrowRight");
    await repeatKey(page, "ArrowRight", 1200);
    await page.keyboard.up("ArrowRight");
    const steps = (await plyID(page)) - before;
    expect(steps).toBeGreaterThanOrEqual(2);
    expect(steps).toBeLessThanOrEqual(3);
    const atRelease = await plyID(page);
    await page.waitForTimeout(1100);
    expect(await plyID(page)).toBe(atRelease);
  });

  test("the half-step hotkey held steps half-steps", async ({ page }) => {
    await setup(page, 300);
    const before = await halfIndex(page);
    const beforeID = await plyID(page);
    await page.keyboard.down("Shift");
    await page.keyboard.down("ArrowRight");
    await repeatKey(page, "ArrowRight", 1200);
    await page.keyboard.up("ArrowRight");
    await page.keyboard.up("Shift");
    const halves = (await halfIndex(page)) - before;
    expect(halves).toBeGreaterThanOrEqual(4);
    expect(halves).toBeLessThanOrEqual(9);
    expect((await plyID(page)) - beforeID).toBeLessThanOrEqual(
      Math.ceil(halves / 2)
    );
  });

  test("five quick clicks step five times", async ({ page }) => {
    await setup(page, 60);
    const before = await plyID(page);
    const box = await navButton(page, "chevron-right").boundingBox();
    expect(box).toBeTruthy();
    for (let i = 0; i < 5; i++) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(300);
    expect((await plyID(page)) - before).toBe(5);
  });

  test("holding at the last ply stops and leaves nothing running", async ({
    page,
  }) => {
    await setup(page, 600);
    await page.evaluate(async () => {
      const store = window.app.$store;
      await store.dispatch("game/LAST");
      await store.dispatch("game/PREV", { half: false, times: 2 });
    });
    await page.waitForTimeout(100);
    await pressButton(page, "chevron-right");
    await page.waitForTimeout(600);
    const last = await page.evaluate(() => {
      const p = window.app.$store.state.game.position;
      return !p.nextPly && p.plyIsDone;
    });
    expect(last).toBe(true);
    // Still held: step back, and nothing steps forward again
    await page.evaluate(() =>
      window.app.$store.dispatch("game/PREV", { half: false, times: 1 })
    );
    const atEnd = await plyID(page);
    await page.waitForTimeout(500);
    expect(await plyID(page)).toBe(atEnd);
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect(await plyID(page)).toBe(atEnd);
  });

  test("the Settings row reads Navigation Speed, enabled without the Play button", async ({
    page,
  }) => {
    await page.evaluate(async () => {
      await window.app.$store.dispatch("ui/SET_UI", ["showPlayButton", false]);
      await window.app.$router
        .push("/settings/navigation/controls")
        .catch(() => {});
    });
    const row = page.locator('[data-setting="ui:playSpeed"]');
    await expect(row).toBeVisible();
    await expect(row).toContainText("Navigation Speed");
    await expect(row).not.toHaveClass(/disabled/);
    await expect(row.locator(".q-slider")).not.toHaveClass(/disabled/);
    await page.evaluate(async () => {
      await window.app.$router.push("/").catch(() => {});
    });
    await expect(page.locator(".settings-dialog")).toHaveCount(0);
  });
});
