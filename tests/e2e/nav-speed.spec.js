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
 *
 * Timing is checked from a record the page keeps of when each step is
 * dispatched, not from how many steps fit in a stretch of wall time, so a
 * busy machine slows the tests down without failing them.
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

const plyID = (page) =>
  page.evaluate(() => {
    const p = window.app.$store.state.game.position;
    return p.ply ? p.ply.id : null;
  });

async function setup(page, speed) {
  await loadPTN(page, PTN, { expandAll: false, showAllBranches: null });
  await page.evaluate(async (speed) => {
    const store = window.app.$store;
    // The first press would start the page's audio, which takes long
    // enough under load to delay the step it makes
    await store.dispatch("ui/SET_UI", ["sound", "off"]);
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
 * From here on, the page records when each step (game/NEXT or game/PREV) is
 * dispatched, what each step costs the main thread, and the input events
 */
const record = (page) =>
  page.evaluate(() => {
    const rec = { steps: [], costs: [], events: [] };
    window.__nav = rec;
    window.app.$store.subscribeAction((action) => {
      if (action.type !== "game/NEXT" && action.type !== "game/PREV") {
        return;
      }
      const t = performance.now();
      rec.steps.push({
        t,
        type: action.type,
        half: Boolean(action.payload && action.payload.half),
      });
      // Until the page can run something else: the step and its render
      setTimeout(() => rec.costs.push(performance.now() - t), 0);
    });
    for (const type of ["pointerdown", "pointerup", "keydown", "keyup"]) {
      window.addEventListener(
        type,
        (event) =>
          rec.events.push({
            t: performance.now(),
            type,
            key: event.key,
            repeat: Boolean(event.repeat),
          }),
        true
      );
    }
    window.addEventListener(
      "focusin",
      () => rec.events.push({ t: performance.now(), type: "focusin" }),
      true
    );
  });

const stepCount = (page) => page.evaluate(() => window.__nav.steps.length);

/** Wait until the page has recorded `n` steps */
const untilSteps = (page, n) =>
  page.waitForFunction((n) => window.__nav.steps.length >= n, n, {
    timeout: 30000,
  });

/**
 * Hold `key` (already down) with the OS's key repeat, a repeat every 33 ms
 * (Playwright sends repeat: true for a key already down), until the page
 * has recorded `n` steps
 */
async function repeatUntilSteps(page, key, n) {
  const end = Date.now() + 30000;
  while ((await stepCount(page)) < n) {
    expect(Date.now(), `${n} steps while ${key} is held`).toBeLessThan(end);
    await page.waitForTimeout(33);
    await page.keyboard.down(key);
  }
}

/** Hold `key` with its repeat for `ms` ms */
async function repeatFor(page, key, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await page.waitForTimeout(33);
    await page.keyboard.down(key);
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const matches = (event, { type, key }) =>
  event.type === type &&
  !event.repeat &&
  (key === undefined || event.key === key);

/**
 * Check the recorded steps of a hold: the first is dispatched at once on the
 * press, each later one at least 0.9 intervals after the one before (at the
 * setting's rate, whatever the key repeat), about an interval apart when the
 * machine keeps up, and none after the hold ended (`end`, an input event).
 * Returns the steps of the hold.
 */
async function expectCadence(page, interval, { press, end, minSteps = 3 }) {
  const rec = await page.evaluate(() => window.__nav);
  const pressed = rec.events.find((e) => matches(e, press));
  expect(pressed, "the press").toBeTruthy();
  const steps = rec.steps.filter((s) => s.t >= pressed.t);
  expect(steps.length).toBeGreaterThanOrEqual(minSteps);

  expect(steps[0].t - pressed.t, "the first step, at once").toBeLessThan(150);

  const gaps = steps.slice(1).map((s, i) => s.t - steps[i].t);
  for (const gap of gaps) {
    expect(gap, `gaps ${gaps.map(Math.round)}`).toBeGreaterThanOrEqual(
      0.9 * interval
    );
  }

  // Whether it keeps to the interval is up to the machine: check only when
  // a step costs it well under one
  const cost = median(rec.costs);
  if (cost < 0.25 * interval) {
    expect(median(gaps), `gaps ${gaps.map(Math.round)}`).toBeLessThanOrEqual(
      2 * interval
    );
  } else {
    test.info().annotations.push({
      type: "skipped check",
      description: `median gap ${Math.round(
        median(gaps)
      )} ms against ${interval} ms not checked: a step costs ${Math.round(
        cost
      )} ms here`,
    });
  }

  if (end) {
    const ended = rec.events.find((e) => e.t > pressed.t && matches(e, end));
    expect(ended, "the end of the hold").toBeTruthy();
    const late = steps.filter((s) => s.t > ended.t);
    expect(late, "steps after the hold ended").toEqual([]);
  }
  return steps;
}

/** Long enough after a hold ends for a step that should not come */
const settle = (page, interval) =>
  page.waitForTimeout(Math.max(500, 3 * interval));

test.describe("Navigation Speed", () => {
  test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => {
      // From the dev environment's game list, as in helpers.js
      if (!/Game not found/.test(error.message)) errors.push(error.message);
    });
    page.__errors = errors;
    await openApp(page);
  });

  test.afterEach(async ({ page }) => {
    await page.mouse.up().catch(() => {});
    for (const key of ["ArrowRight", "Shift", "Meta"]) {
      await page.keyboard.up(key).catch(() => {});
    }
    await page.evaluate(() =>
      window.app.$store.dispatch("ui/SET_UI", ["playSpeed", 120])
    );
    expect(page.__errors, "uncaught page errors").toEqual([]);
  });

  test("holding Forward at 600 steps every 100 ms, never sooner", async ({
    page,
  }) => {
    await setup(page, 600);
    await record(page);
    await pressButton(page, "chevron-right");
    await untilSteps(page, 8);
    await page.mouse.up();
    await settle(page, 100);
    await expectCadence(page, 100, {
      press: { type: "pointerdown" },
      end: { type: "pointerup" },
      minSteps: 8,
    });
  });

  test("holding Forward at 60 steps once at once and once a second", async ({
    page,
  }) => {
    await setup(page, 60);
    await record(page);
    await pressButton(page, "chevron-right");
    await untilSteps(page, 3);
    await page.mouse.up();
    await settle(page, 1000);
    const steps = await expectCadence(page, 1000, {
      press: { type: "pointerdown" },
      end: { type: "pointerup" },
    });
    expect(steps.every((s) => s.type === "game/NEXT" && !s.half)).toBe(true);
  });

  test("releasing stops it", async ({ page }) => {
    await setup(page, 600);
    await record(page);
    await pressButton(page, "chevron-right");
    // It was stepping
    await untilSteps(page, 3);
    await page.mouse.up();
    const atRelease = await plyID(page);
    await settle(page, 100);
    expect(await plyID(page)).toBe(atRelease);
    await expectCadence(page, 100, {
      press: { type: "pointerdown" },
      end: { type: "pointerup" },
    });
  });

  test("right-click hold steps half-steps", async ({ page }) => {
    await setup(page, 300);
    await record(page);
    await pressButton(page, "chevron-right", "right");
    await untilSteps(page, 4);
    await page.mouse.up({ button: "right" });
    await settle(page, 200);
    const steps = await expectCadence(page, 200, {
      press: { type: "pointerdown" },
      end: { type: "pointerup" },
      minSteps: 4,
    });
    expect(steps.every((s) => s.type === "game/NEXT" && s.half)).toBe(true);
  });

  test("a held hotkey steps at the setting's rate, not the key repeat's", async ({
    page,
  }) => {
    await setup(page, 120);
    await record(page);
    await page.keyboard.down("ArrowRight");
    await repeatUntilSteps(page, "ArrowRight", 3);
    await page.keyboard.up("ArrowRight");
    await settle(page, 500);
    await expectCadence(page, 500, {
      press: { type: "keydown", key: "ArrowRight" },
      end: { type: "keyup", key: "ArrowRight" },
    });
  });

  test("the half-step hotkey held steps half-steps", async ({ page }) => {
    await setup(page, 300);
    await record(page);
    await page.keyboard.down("Shift");
    await page.keyboard.down("ArrowRight");
    await repeatUntilSteps(page, "ArrowRight", 4);
    await page.keyboard.up("ArrowRight");
    await page.keyboard.up("Shift");
    await settle(page, 200);
    const steps = await expectCadence(page, 200, {
      press: { type: "keydown", key: "ArrowRight" },
      end: { type: "keyup", key: "ArrowRight" },
      minSteps: 4,
    });
    expect(steps.every((s) => s.type === "game/NEXT" && s.half)).toBe(true);
  });

  // A keyup can go missing: a Mac sends none for a key let go while Cmd is
  // down. Each of these holds the arrow down and never lets it go, so only
  // the other sign stops the hold.
  test.describe("a key hold whose keyup never comes", () => {
    async function holdArrow(page, { half = false } = {}) {
      await setup(page, 300);
      await record(page);
      if (half) await page.keyboard.down("Shift");
      await page.keyboard.down("ArrowRight");
      await repeatUntilSteps(page, "ArrowRight", 2);
    }

    test("stops on Cmd (Meta) pressed", async ({ page }) => {
      await holdArrow(page);
      await page.keyboard.down("Meta");
      await settle(page, 200);
      await expectCadence(page, 200, {
        press: { type: "keydown", key: "ArrowRight" },
        end: { type: "keydown", key: "Meta" },
        minSteps: 2,
      });
    });

    test("stops on another key pressed", async ({ page }) => {
      await holdArrow(page);
      // Bound to nothing
      await page.keyboard.press("j");
      await settle(page, 200);
      await expectCadence(page, 200, {
        press: { type: "keydown", key: "ArrowRight" },
        end: { type: "keydown", key: "j" },
        minSteps: 2,
      });
    });

    test("a half-step hold stops on Shift let go, the arrow still down", async ({
      page,
    }) => {
      await holdArrow(page, { half: true });
      await page.keyboard.up("Shift");
      // The arrow's repeats, now without Shift, start nothing
      await repeatFor(page, "ArrowRight", 600);
      await expectCadence(page, 200, {
        press: { type: "keydown", key: "ArrowRight" },
        end: { type: "keyup", key: "Shift" },
        minSteps: 2,
      });
    });

    test("stops on focus moving into a text field", async ({ page }) => {
      await holdArrow(page);
      await page.evaluate(() => {
        const input = document.createElement("input");
        input.id = "nav-speed-test-input";
        document.body.appendChild(input);
        input.focus();
      });
      await settle(page, 200);
      await page.evaluate(() =>
        document.getElementById("nav-speed-test-input").remove()
      );
      await expectCadence(page, 200, {
        press: { type: "keydown", key: "ArrowRight" },
        end: { type: "focusin" },
        minSteps: 2,
      });
    });
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
    await page.waitForFunction(
      () => {
        const p = window.app.$store.state.game.position;
        return !p.nextPly && p.plyIsDone;
      },
      null,
      { timeout: 30000 }
    );
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
    // Found by its old name
    await page.getByPlaceholder("Search Settings").fill("play speed");
    await expect(
      page.locator('.settings-result[data-result="ui:playSpeed"]')
    ).toBeVisible();
    await page.evaluate(async () => {
      await window.app.$router.push("/").catch(() => {});
    });
    await expect(page.locator(".settings-dialog")).toHaveCount(0);
  });
});
