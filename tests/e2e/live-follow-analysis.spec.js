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

/**
 * Select the tinue-solver bot with a 1000-node budget. Unlike setUpBot, the
 * base analyzeInteractive is left alone: tinue doesn't override it, so it
 * shows how a non-TEI engine starts each interactive search. searchPosition
 * never resolves and stores nothing, like tinue's open-ended search on a
 * position with no tinue.
 */
async function setUpTinue(page) {
  await page.evaluate(async () => {
    const store = window.app.$store;
    store.commit("analysis/SET", ["botID", "tinue-solver"]);
    const all = store.state.analysis.botSettings;
    await store.dispatch("analysis/SET", [
      "botSettings",
      {
        ...all,
        "tinue-solver": {
          ...all["tinue-solver"],
          limitTypes: ["nodes"],
          nodes: 1000,
        },
      },
    ]);
    const bot = store.getters["analysis/bot"];
    window.__bot = bot;
    bot.searchPosition = () => new Promise(() => {});
  });
}

/** Load a different (non-live) game, replacing the live one. */
async function switchGame(page, ptn) {
  await page.evaluate(async (ptn) => {
    await window.app.$store.dispatch("game/ADD_GAME", {
      ptn,
      name: "Other Game",
    });
  }, ptn);
  await page.waitForFunction(
    () => window.app.$store.state.game.name === "Other Game"
  );
  await nextTick(page);
}

async function nextTick(page) {
  await page.evaluate(async () => {
    await window.app.$nextTick();
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

  test("sweep on a live game skips the frontier and hands off to a lock", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const bot = window.__bot;
      const plies = window.app.$game.plies;
      await bot.analyzeBranch();
      return {
        swept: window.__swept,
        frontierTPS: plies[plies.length - 1].tpsAfter,
        lastID: plies[plies.length - 1].id,
        state: {
          isInteractiveEnabled: bot.state.isInteractiveEnabled,
          isAnalyzingBranch: bot.state.isAnalyzingBranch,
          lockedPlyID: bot.state.lockedPlyID,
          lockedFollowsMainline: bot.state.lockedFollowsMainline,
        },
        interactive: window.__interactive,
      };
    });
    expect(result.swept).not.toContain(result.frontierTPS);
    expect(result.swept.length).toBeGreaterThan(0);
    expect(result.state.isAnalyzingBranch).toBe(false);
    expect(result.state.isInteractiveEnabled).toBe(true);
    expect(result.state.lockedPlyID).toBe(result.lastID);
    expect(result.state.lockedFollowsMainline).toBe(true);
    // The first interactive search starts on the locked frontier.
    expect(result.interactive[0]).toBe(result.lastID);
  });

  test("sweep on a live game skips positions with enough saved analysis", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const bot = window.__bot;
      const plies = window.app.$game.plies;
      const savedTPS = plies[3].tpsAfter;
      // Make the saved-results lookup report a deep note for one position.
      // The sweep must ask for this engine's own label, whatever source is
      // selected.
      bot.getSavedResultFilter =
        (name) =>
        ({ tps }) =>
          !(name === bot.label && tps === savedTPS);
      await bot.analyzeBranch();
      return { swept: window.__swept, savedTPS };
    });
    expect(result.swept).not.toContain(result.savedTPS);
  });

  test("fully analysed live game hands off immediately", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const bot = window.__bot;
      const plies = window.app.$game.plies;
      bot.getSavedResultFilter = () => () => false; // everything saved
      window.__warnings = [];
      bot.onWarning = (w) => window.__warnings.push(w);
      await bot.analyzeBranch();
      return {
        warnings: window.__warnings,
        swept: window.__swept,
        lockedPlyID: bot.state.lockedPlyID,
        lastID: plies[plies.length - 1].id,
      };
    });
    expect(result.warnings).toEqual([]);
    expect(result.swept).toEqual([]);
    expect(result.lockedPlyID).toBe(result.lastID);
  });

  test("sweep on a finished game ends as before", async ({ page }) => {
    const result = await page.evaluate(async () => {
      window.app.$store.commit("game/MARK_PLAYTAK_ENDED");
      const bot = window.__bot;
      const plies = window.app.$game.plies;
      await bot.analyzeBranch();
      return {
        swept: window.__swept,
        frontierTPS: plies[plies.length - 1].tpsAfter,
        isInteractiveEnabled: bot.state.isInteractiveEnabled,
      };
    });
    expect(result.swept).toContain(result.frontierTPS);
    expect(result.isInteractiveEnabled).toBe(false);
  });

  test("lock tooltip shows the queued-move count", async ({ page }) => {
    await lockFrontier(page);
    await reportNodes(page, 100);
    await appendLive(page, "e1");
    await appendLive(page, "e6");
    const text = await page.evaluate(() =>
      window.app.$tc("n_queuedMoves", window.__bot.state.lockedQueue.length)
    );
    expect(text).toBe("2 moves queued");
  });
  test("tinue-style lock advances on live nodes when nothing is stored", async ({
    page,
  }) => {
    await setUpTinue(page);
    await lockFrontier(page);
    await appendLive(page, "e1");
    await appendLive(page, "e6");

    let s = await lockState(page);
    expect(s.queue).toEqual(s.ids.slice(8, 10));

    const advance = () =>
      page.evaluate(() => {
        const bot = window.__bot;
        const stored = bot.positions[bot.state.lockedTPS];
        bot.setState({ nodes: 600 });
        return {
          stored: !!stored,
          staleTPS: bot.state.tps,
          lockedTPS: bot.state.lockedTPS,
        };
      });

    let r = await advance();
    expect(r.stored).toBe(false);
    s = await lockState(page);
    expect(s.lockedPlyID).toBe(s.ids[8]);
    expect(s.queue).toEqual([s.ids[9]]);

    // tinue never rewrites state.tps, so it still names the first position.
    r = await advance();
    expect(r.stored).toBe(false);
    s = await lockState(page);
    expect(s.lockedPlyID).toBe(s.ids[9]);
    expect(s.queue).toEqual([]);
  });

  test("live nodes don't count until a search starts on the lock", async ({
    page,
  }) => {
    await setUpTinue(page);
    await lockFrontier(page);
    await appendLive(page, "e1");
    await page.evaluate(() => {
      const bot = window.__bot;
      // The engine is still on some other position (e.g. TEI winding down
      // its previous search while it hands over).
      bot._interactiveSearchTPS = "x6/x6/x6/x6/x6/x6 1 1";
      bot.setState({ nodes: 600 });
    });
    const s = await lockState(page);
    expect(s.lockedPlyID).toBe(s.ids[7]);
    expect(s.queue).toEqual([s.lastID]);
  });

  test("advancing while scrubbing still starts a search on the new lock", async ({
    page,
  }) => {
    await lockFrontier(page);
    await reportNodes(page, 100);
    await appendLive(page, "e1");
    await page.evaluate(() =>
      window.app.$store.commit("ui/SET_SCRUBBING", "start")
    );
    await reportNodes(page, 600);
    await page.evaluate(() =>
      window.app.$store.commit("ui/SET_SCRUBBING", "end")
    );
    await nextTick(page);
    const s = await lockState(page);
    expect(s.lockedPlyID).toBe(s.lastID);
    const interactive = await page.evaluate(() => window.__interactive);
    expect(interactive).toContain(s.lastID);
  });

  test("switching games drops the lock without advancing onto the new game", async ({
    page,
  }) => {
    await lockFrontier(page);
    await reportNodes(page, 100);
    await appendLive(page, "e1");
    const before = await page.evaluate(() => ({
      queuedID: window.__bot.state.lockedQueue[0],
      count: window.__interactive.length,
    }));
    // Long enough that the queued ID also exists in the new game.
    await switchGame(
      page,
      `[Size "6"]

1. a1 f6
2. b1 f5
3. c1 e5
4. d1 d5
5. e1 c5
6. f1 b5
`
    );
    const result = await page.evaluate((count) => {
      const s = window.__bot.state;
      return {
        lockedTPS: s.lockedTPS,
        lockedPlyID: s.lockedPlyID,
        queue: [...(s.lockedQueue || [])],
        after: window.__interactive.slice(count),
      };
    }, before.count);
    expect(result.lockedTPS).toBeNull();
    expect(result.lockedPlyID).toBeNull();
    expect(result.queue).toEqual([]);
    expect(result.after).not.toContain(before.queuedID);
  });

  test("takeback with a reused ply ID re-locks onto the new last move", async ({
    page,
  }) => {
    await lockFrontier(page);
    await reportNodes(page, 100);
    const result = await page.evaluate(async (playtakID) => {
      const store = window.app.$store;
      const plies = window.app.$game.plies;
      const undone = plies[plies.length - 1];
      // PlayTak undo, then a different move, before the watchers run: the
      // new ply reuses the undone ply's ID.
      store.dispatch("game/DELETE_PLY", {
        plyID: undone.id,
        fromServer: true,
        playtakLive: { playtakID, syncedMainlineCount: 7 },
      });
      await store.dispatch("game/APPEND_PLY", {
        ply: "e4",
        playtakLive: { playtakID, syncedMainlineCount: 7 },
      });
      await window.app.$nextTick();
      const last = window.app.$game.plies[window.app.$game.plies.length - 1];
      const s = window.__bot.state;
      return {
        undoneID: undone.id,
        undoneTPS: undone.tpsAfter,
        lastID: last.id,
        lastTPS: last.tpsAfter,
        lockedPlyID: s.lockedPlyID,
        lockedTPS: s.lockedTPS,
        queue: [...s.lockedQueue],
        interactive: window.__interactive,
      };
    }, PLAYTAK_ID);
    expect(result.lastID).toBe(result.undoneID); // the ID really is reused
    expect(result.lastTPS).not.toBe(result.undoneTPS);
    expect(result.lockedPlyID).toBe(result.lastID);
    expect(result.lockedTPS).toBe(result.lastTPS);
    expect(result.queue).toEqual([]);
  });

  test("branch sweep from a side variation doesn't hand off", async ({
    page,
  }) => {
    await page.evaluate(async (playtakID) => {
      await window.app.$store.dispatch("game/ADD_GAME", {
        ptn: `[Size "6"]
[Opening "swap"]

1. a1 f6
2. b1 f5
3. c1 e5
4. d1 d5

{3w1}
3. c2 e4
4. c3 e3
`,
        name: "Live Branch Test",
        config: {
          playtakID,
          playtakLive: true,
          playtakSyncedMainline: 8,
        },
      });
    }, PLAYTAK_ID);
    await page.waitForFunction(
      () => window.app.$store.state.game.name === "Live Branch Test"
    );
    const result = await page.evaluate(async () => {
      const store = window.app.$store;
      const bot = window.__bot;
      const branchPly = store.state.game.ptn.allPlies.find(
        (p) => p && p.branch
      );
      await store.dispatch("game/GO_TO_PLY", {
        plyID: branchPly.id,
        isDone: true,
      });
      await bot.analyzeBranch();
      return {
        branch: branchPly.branch,
        swept: window.__swept.length,
        isInteractiveEnabled: bot.state.isInteractiveEnabled,
        lockedPlyID: bot.state.lockedPlyID,
      };
    });
    expect(result.branch).toBeTruthy();
    expect(result.swept).toBeGreaterThan(0);
    expect(result.isInteractiveEnabled).toBe(false);
    expect(result.lockedPlyID).toBeNull();
  });

  test("cancelled sweep on a live game doesn't hand off", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const bot = window.__bot;
      bot.searchPosition = async function (size, halfKomi, tps) {
        window.__swept.push(tps);
        if (window.__swept.length === 1) {
          await this.terminate();
        }
        return null;
      };
      await bot.analyzeBranch();
      return {
        swept: window.__swept.length,
        isInteractiveEnabled: bot.state.isInteractiveEnabled,
        lockedPlyID: bot.state.lockedPlyID,
      };
    });
    expect(result.swept).toBe(1);
    expect(result.isInteractiveEnabled).toBe(false);
    expect(result.lockedPlyID).toBeNull();
  });
});
