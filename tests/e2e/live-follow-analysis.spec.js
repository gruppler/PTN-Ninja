// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Live-follow analysis for ongoing PlayTak games.
 *
 * Spec: docs/superpowers/specs/2026-10-16-live-follow-analysis-design.md
 *
 * Engines are never actually run: the tiltak bot's search entry points are
 * stubbed on the instance, and search progress is simulated with setPosition
 * and setState. What's under test is the bot's scheduling, not an engine.
 */

const PLAYTAK_ID = "999999";

// 8 synced main-line plies.
const LIVE_PTN = `[Size "6"]
[Opening "swap"]

1. a1 f6
2. b1 f5
3. c1 e5
4. d1 d5
`;

async function loadLiveGame(page, { synced = 8 } = {}) {
  await page.evaluate(
    async ({ ptn, playtakID, synced }) => {
      await window.app.$store.dispatch("game/ADD_GAME", {
        ptn,
        name: "Live Follow Test",
        config: {
          playtakID,
          playtakLive: true,
          playtakSyncedMainline: synced,
        },
      });
    },
    { ptn: LIVE_PTN, playtakID: PLAYTAK_ID, synced }
  );
  await page.waitForFunction(
    () => {
      const game = window.app && window.app.$game;
      return game && game.plies && game.plies.length >= 8;
    },
    { timeout: 10000 }
  );
}

/** Append a real (synced) PlayTak move. */
async function appendLive(page, ply) {
  await page.evaluate(
    async ({ ply, playtakID }) => {
      const store = window.app.$store;
      const before = store.state.game.config.playtakSyncedMainline;
      await store.dispatch("game/APPEND_PLY", {
        ply,
        playtakLive: { playtakID, syncedMainlineCount: before },
      });
    },
    { ply, playtakID: PLAYTAK_ID }
  );
}

/**
 * Select the tiltak bot with a 1000-node budget and stub its search entry
 * points. Records interactive starts in window.__interactive (locked ply IDs)
 * and sweep searches in window.__swept (TPS strings).
 *
 * `bot.settings` is a store-bound getter, so the budget has to be set through
 * analysis/SET (see analysis-skip.spec.js).
 */
async function setUpBot(page) {
  await page.evaluate(async () => {
    const store = window.app.$store;
    store.commit("analysis/SET", ["botID", "tiltak"]);
    const all = store.state.analysis.botSettings;
    await store.dispatch("analysis/SET", [
      "botSettings",
      {
        ...all,
        tiltak: { ...all.tiltak, limitTypes: ["nodes"], nodes: 1000 },
      },
    ]);
    const bot = store.getters["analysis/bot"];
    window.__bot = bot;
    window.__interactive = [];
    window.__swept = [];
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
      return null;
    };
  });
}

/** Enable interactive mode and lock on the last synced move, as a user would. */
async function lockFrontier(page) {
  await page.evaluate(async () => {
    const bot = window.__bot;
    const game = window.app.$game;
    await window.app.$store.dispatch("game/GO_TO_PLY", {
      plyID: game.plies[game.plies.length - 1].id,
      isDone: true,
    });
    bot.isInteractiveEnabled = true;
    bot.toggleInteractiveLock(true);
  });
}

/** Simulate a search result on the locked position. */
async function reportNodes(page, nodes) {
  await page.evaluate((nodes) => {
    const bot = window.__bot;
    bot.setPosition(bot.state.lockedTPS, [{ nodes, time: 10, pv: [] }]);
  }, nodes);
}

const lockState = (page) =>
  page.evaluate(() => {
    const s = window.__bot.state;
    const plies = window.app.$game.plies;
    return {
      lockedPlyID: s.lockedPlyID,
      queue: [...s.lockedQueue],
      lastID: plies[plies.length - 1].id,
      ids: plies.map((p) => p.id),
    };
  });

test.describe("Live-follow analysis", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });
    await loadLiveGame(page);
    await setUpBot(page);
  });

  test("last synced main-line ply respects the PlayTak cap", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const store = window.app.$store;
      const bot = window.__bot;
      const plies = window.app.$game.plies;
      const atCap = bot.getLastMainlinePly();
      // Pretend only 6 moves are synced: the cap moves back.
      store.commit("game/SET_PLAYTAK_LIVE_CONFIG", {
        syncedMainlineCount: 6,
      });
      const capped = bot.getLastMainlinePly();
      // Pretend 9 are synced but only 8 exist: nothing is safe to follow.
      store.commit("game/SET_PLAYTAK_LIVE_CONFIG", {
        syncedMainlineCount: 9,
      });
      const short = bot.getLastMainlinePly();
      return {
        atCap: atCap && atCap.id,
        capped: capped && capped.id,
        short,
        lastID: plies[7].id,
        sixthID: plies[5].id,
      };
    });
    expect(result.atCap).toBe(result.lastID);
    expect(result.capped).toBe(result.sixthID);
    expect(result.short).toBeNull();
  });

  test("manual lock on a live frontier queues new moves until the minimum is met", async ({
    page,
  }) => {
    await lockFrontier(page);
    await reportNodes(page, 100); // below the 500-node minimum
    await appendLive(page, "e1");

    let s = await lockState(page);
    expect(s.lockedPlyID).toBe(s.ids[7]); // still on the old frontier
    expect(s.queue).toEqual([s.lastID]);

    await reportNodes(page, 600); // minimum met
    s = await lockState(page);
    expect(s.lockedPlyID).toBe(s.lastID);
    expect(s.queue).toEqual([]);
  });

  test("burst append queues every ply in order", async ({ page }) => {
    await lockFrontier(page);
    await reportNodes(page, 100);
    await appendLive(page, "e1");
    await appendLive(page, "e6");
    await appendLive(page, "f1");

    let s = await lockState(page);
    expect(s.queue).toEqual(s.ids.slice(8, 11));

    await reportNodes(page, 600);
    s = await lockState(page);
    expect(s.lockedPlyID).toBe(s.ids[8]);
    expect(s.queue).toEqual(s.ids.slice(9, 11));
  });

  test("transitional stop is not idle", async ({ page }) => {
    await lockFrontier(page);
    await reportNodes(page, 100);
    await appendLive(page, "e1");
    // TEI's bestmove hand-over: not running, but tps has moved to a queued
    // target, so nextTPS is still set.
    await page.evaluate(() => {
      const bot = window.__bot;
      bot.setState({ isRunning: false, tps: "x", nextTPS: "x" });
    });
    const s = await lockState(page);
    expect(s.lockedPlyID).toBe(s.ids[7]);
  });

  test("idle engine advances without meeting the minimum", async ({ page }) => {
    await lockFrontier(page);
    await reportNodes(page, 100);
    await appendLive(page, "e1");
    // Engine finished on its own: TEI clears both tps and nextTPS.
    await page.evaluate(() => {
      window.__bot.setState({ isRunning: false, tps: null, nextTPS: null });
    });
    const s = await lockState(page);
    expect(s.lockedPlyID).toBe(s.lastID);
  });

  test("queue drains after the game stops being live", async ({ page }) => {
    await lockFrontier(page);
    await reportNodes(page, 100);
    await appendLive(page, "e1");
    await page.evaluate(() =>
      window.app.$store.commit("game/MARK_PLAYTAK_ENDED")
    );
    let s = await lockState(page);
    expect(s.queue).toEqual([s.lastID]);
    await reportNodes(page, 600);
    s = await lockState(page);
    expect(s.lockedPlyID).toBe(s.lastID);
  });

  test("lock on a finished game jumps immediately", async ({ page }) => {
    await page.evaluate(() =>
      window.app.$store.commit("game/MARK_PLAYTAK_ENDED")
    );
    await lockFrontier(page);
    await reportNodes(page, 100);
    await page.evaluate(() =>
      window.app.$store.dispatch("game/APPEND_PLY", "e1")
    );
    const s = await lockState(page);
    expect(s.lockedPlyID).toBe(s.lastID);
    expect(s.queue).toEqual([]);
  });

  test("unlocking clears the queue", async ({ page }) => {
    await lockFrontier(page);
    await reportNodes(page, 100);
    await appendLive(page, "e1");
    await page.evaluate(() => window.__bot.toggleInteractiveLock(false));
    const s = await lockState(page);
    expect(s.queue).toEqual([]);
    expect(s.lockedPlyID).toBeNull();
  });

  test("frontier result is saved once it meets the minimum", async ({
    page,
  }) => {
    await page.evaluate(() =>
      window.app.$store.dispatch("analysis/SET", ["autoSaveEachPosition", true])
    );
    await page.evaluate(() => {
      const bot = window.__bot;
      window.__saved = [];
      bot.saveEvalComments = (tps) => window.__saved.push(tps);
    });
    await lockFrontier(page);
    await reportNodes(page, 100);
    expect(await page.evaluate(() => window.__saved.length)).toBe(0);
    await reportNodes(page, 600);
    await reportNodes(page, 700);
    expect(await page.evaluate(() => window.__saved.length)).toBe(1);
  });
});
