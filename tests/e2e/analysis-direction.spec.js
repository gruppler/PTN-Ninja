// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * "Analyze backward": Analyze Branch and Analyze Game sweep from the end
 * back to the start (the main line first, then side branches), and the board
 * follows. On by default, global, and ignored on live PlayTak games, which
 * always sweep forward so they can hand off to the newest move. The tinue
 * solver always sweeps backward, whatever the setting.
 *
 * Engines are never run: searchPosition is stubbed on the bot instance to
 * record the order in which positions are searched.
 */

const LINEAR_PTN = `[Size "6"]
[Opening "swap"]

1. a1 f6
2. b1 f5
3. c1 e5
`;

const BRANCHED_PTN = `[Size "6"]
[Opening "swap"]

1. a1 f6
2. b1 f5
3. c1 e5
4. d1 d5

{3w1}
3. c2 e4
4. c3 e3
`;

const PLAYTAK_ID = "999999";

async function loadGame(page, ptn, name, config) {
  await page.evaluate(
    async ({ ptn, name, config }) => {
      await window.app.$store.dispatch("game/ADD_GAME", {
        ptn,
        name,
        ...(config ? { config } : {}),
      });
    },
    { ptn, name, config }
  );
  await page.waitForFunction(
    (name) => window.app.$store.state.game.name === name,
    name
  );
}

/**
 * Select a bot with a 1000-node budget and stub its searchPosition. Records
 * each searched TPS in window.__swept, and where the board was at the time
 * (window.__board, as "plyID:isDone").
 */
async function setUpBot(page, botID) {
  await page.evaluate(async (botID) => {
    const store = window.app.$store;
    store.commit("analysis/SET", ["botID", botID]);
    const all = store.state.analysis.botSettings;
    await store.dispatch("analysis/SET", [
      "botSettings",
      {
        ...all,
        [botID]: { ...all[botID], limitTypes: ["nodes"], nodes: 1000 },
      },
    ]);
    const bot = store.getters["analysis/bot"];
    window.__bot = bot;
    window.__swept = [];
    window.__board = [];
    window.__interactive = [];
    bot.analyzeInteractive = function () {
      window.__interactive.push(this.state.lockedPlyID);
      this.setState({
        isRunning: true,
        tps: this.interactiveTPS,
        nextTPS: this.interactiveTPS,
      });
    };
    bot.searchPosition = async function (size, halfKomi, tps) {
      window.__swept.push(tps);
      const position = store.state.game.position;
      window.__board.push(
        position.ply ? `${position.ply.id}:${position.plyIsDone}` : null
      );
      return null;
    };
  }, botID);
}

async function setBackward(page, value) {
  await page.evaluate(async (value) => {
    await window.app.$store.dispatch("analysis/SET", [
      "analyzeBackward",
      value,
    ]);
  }, value);
}

async function goToLastPly(page) {
  await page.evaluate(async () => {
    const plies = window.app.$game.plies;
    await window.app.$store.dispatch("game/GO_TO_PLY", {
      plyID: plies[plies.length - 1].id,
      isDone: true,
    });
  });
}

/**
 * The positions a sweep over `plies` (in that order) covers: each ply's
 * position before it, then the positions after them that are still new.
 */
const EXPECTED_ORDER = `
  const positionsFor = (plies) => {
    const seen = new Set();
    const out = [];
    const add = (tps) => {
      if (!seen.has(tps)) {
        seen.add(tps);
        out.push(tps);
      }
    };
    plies.forEach((p) => add(p.tpsBefore));
    plies.forEach((p) => {
      if (!p.result || p.result.type === "1") add(p.tpsAfter);
    });
    return out;
  };
  const allPlies = window.app.$store.state.game.ptn.allPlies.filter(Boolean);
  const main = allPlies.filter((p) => p.branch === "");
  const subs = allPlies.filter((p) => p.branch !== "");
`;

async function sweepBranch(page) {
  return page.evaluate(
    new Function(
      `return (async () => {
        ${EXPECTED_ORDER}
        await window.__bot.analyzeBranch();
        return {
          swept: window.__swept,
          board: window.__board,
          forward: positionsFor(main),
          backward: positionsFor(main.slice().reverse()),
          ids: main.map((p) => p.id),
        };
      })()`
    )
  );
}

async function sweepGame(page) {
  return page.evaluate(
    new Function(
      `return (async () => {
        ${EXPECTED_ORDER}
        await window.__bot.analyzeGame();
        return {
          swept: window.__swept,
          forward: positionsFor(allPlies),
          backward: positionsFor([
            ...main.slice().reverse(),
            ...subs.slice().reverse(),
          ]),
          mainLast: main[main.length - 1].tpsBefore,
          mainFirst: main[0].tpsBefore,
          subTPS: subs.map((p) => p.tpsAfter),
        };
      })()`
    )
  );
}

test.describe("Analysis direction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });
  });

  test("defaults to backward", async ({ page }) => {
    const state = await page.evaluate(() => {
      const analysis = window.app.$store.state.analysis;
      return {
        value: analysis.analyzeBackward,
        default: analysis.defaults.analyzeBackward,
      };
    });
    expect(state.value).toBe(true);
    expect(state.default).toBe(true);
  });

  test("setting persists to LocalStorage", async ({ page }) => {
    await setBackward(page, false);
    await page.reload();
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });
    const value = await page.evaluate(
      () => window.app.$store.state.analysis.analyzeBackward
    );
    expect(value).toBe(false);
    await setBackward(page, true);
  });

  test("on: branch sweep runs from the end to the start", async ({ page }) => {
    await loadGame(page, LINEAR_PTN, "Direction Branch");
    await setUpBot(page, "tiltak");
    await setBackward(page, true);
    await goToLastPly(page);
    const r = await sweepBranch(page);
    expect(r.swept).toEqual(r.backward);
    expect(r.swept).not.toEqual(r.forward);
  });

  test("on: game sweep runs the main line backward, then branches", async ({
    page,
  }) => {
    await loadGame(page, BRANCHED_PTN, "Direction Game");
    await setUpBot(page, "tiltak");
    await setBackward(page, true);
    const r = await sweepGame(page);
    expect(r.swept).toEqual(r.backward);
    expect(r.swept[0]).toBe(r.mainLast);
    // Every side-branch position comes after the main line's first one
    const firstIndex = r.swept.indexOf(r.mainFirst);
    r.subTPS.forEach((tps) => {
      expect(r.swept.indexOf(tps)).toBeGreaterThan(firstIndex);
    });
  });

  test("off: branch and game sweeps run forward", async ({ page }) => {
    await loadGame(page, BRANCHED_PTN, "Direction Off");
    await setUpBot(page, "tiltak");
    await setBackward(page, false);
    const game = await sweepGame(page);
    expect(game.swept).toEqual(game.forward);

    await loadGame(page, LINEAR_PTN, "Direction Off Branch");
    await setUpBot(page, "tiltak");
    await goToLastPly(page);
    const branch = await sweepBranch(page);
    expect(branch.swept).toEqual(branch.forward);
  });

  test("on: the board follows a backward sweep", async ({ page }) => {
    await loadGame(page, LINEAR_PTN, "Direction Follow");
    await setUpBot(page, "tiltak");
    await setBackward(page, true);
    await goToLastPly(page);
    const r = await sweepBranch(page);
    // Each position before a ply is shown on that ply, undone; the final
    // position is searched last, on the last ply.
    const ids = r.ids;
    const expected = [
      ...ids
        .slice()
        .reverse()
        .map((id) => `${id}:false`),
      `${ids[ids.length - 1]}:false`,
    ];
    expect(r.board).toEqual(expected);
  });

  test("on: a live game still sweeps forward and hands off", async ({
    page,
  }) => {
    await loadGame(
      page,
      BRANCHED_PTN.replace(/\n\{3w1\}[\s\S]*$/, "\n"),
      "Direction Live",
      {
        playtakID: PLAYTAK_ID,
        playtakLive: true,
        playtakSyncedMainline: 8,
      }
    );
    await setUpBot(page, "tiltak");
    await setBackward(page, true);
    await goToLastPly(page);
    const r = await page.evaluate(async () => {
      const bot = window.__bot;
      const plies = window.app.$game.plies;
      await bot.analyzeBranch();
      return {
        swept: window.__swept,
        before: plies.map((p) => p.tpsBefore),
        frontierTPS: plies[plies.length - 1].tpsAfter,
        lastID: plies[plies.length - 1].id,
        lockedPlyID: bot.state.lockedPlyID,
        isInteractiveEnabled: bot.state.isInteractiveEnabled,
        interactive: window.__interactive,
      };
    });
    expect(r.swept).toEqual(r.before);
    expect(r.swept).not.toContain(r.frontierTPS);
    expect(r.isInteractiveEnabled).toBe(true);
    expect(r.lockedPlyID).toBe(r.lastID);
    expect(r.interactive[0]).toBe(r.lastID);
  });

  test("tinue solver's order doesn't depend on the setting", async ({
    page,
  }) => {
    const orders = {};
    for (const value of [true, false]) {
      await loadGame(page, BRANCHED_PTN, `Direction Tinue ${value}`);
      await setUpBot(page, "tinue-solver");
      await setBackward(page, value);
      orders[value] = await sweepGame(page);
    }
    expect(orders.true.swept).toEqual(orders.true.backward);
    expect(orders.false.swept).toEqual(orders.false.backward);
  });

  test("toggle in the engine settings menu changes the setting", async ({
    page,
  }) => {
    await setBackward(page, true);
    await page.evaluate(async () => {
      const store = window.app.$store;
      await store.dispatch("ui/SET_UI", ["showText", true]);
      await store.dispatch("ui/SET_UI", ["textTab", "engines"]);
    });
    const item = page.getByText("Analyze Backward", { exact: true });
    if (!(await item.isVisible())) {
      // The gear in the Engines tab's header, beside the position count
      await page
        .locator("div.row.justify-between")
        .filter({ hasText: /\d+ positions?/ })
        .locator("button")
        .last()
        .click();
    }
    await expect(item).toBeVisible();
    await item.click();
    await expect
      .poll(() =>
        page.evaluate(() => window.app.$store.state.analysis.analyzeBackward)
      )
      .toBe(false);
    await item.click();
    await expect
      .poll(() =>
        page.evaluate(() => window.app.$store.state.analysis.analyzeBackward)
      )
      .toBe(true);
  });
});
