// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Two invariants for applying live PlayTak moves.
 *
 * 1. A move is never blocked indefinitely by Tak auto-annotation.
 *
 * The annotation pre-check runs inside APPEND_PLY so the mark can be baked
 * into the same history entry as the insert, and flushPlaytakFollowQueue
 * awaits each APPEND_PLY while holding its `flushing` mutex. Nothing else
 * re-drives that queue, so a check that never answers stops every later
 * live move from being applied — permanently. Time/Timems and
 * SET_GAME_TIMER_TURN bypass the queue, so the clocks keep ticking and
 * alternating throughout. That is the failure a spectator sees: moves stop
 * arriving, everything else looks live, only a refresh recovers.
 *
 * The annotator owns its worker now, so nothing should be able to occupy
 * it — this pins the failsafe that covers the rest (a dead worker, or one
 * still initializing).
 *
 * 2. Annotating newly-appended plies costs one check per new ply.
 *
 * The burst drain skips the per-ply pre-check to keep its batching, then
 * annotates afterward. Doing that with a whole-game sweep spends a wasm
 * round-trip per ply already in the game to discover it is already marked.
 */

const PLAYTAK_ID = "999999";

const SIZE_6_PTN = `[Size "6"]
[Opening "swap"]

1. a1 f6
2. b1 f5
3. c1 e5
4. d1 d5
`;

/**
 * Swap the tak-annotator worker for a stub, and record every request the
 * main thread sends it on `window.__takRequests`. `body` is the stub's
 * onmessage source; it reports ready either way.
 */
async function stubAnnotator(page, body) {
  await page.addInitScript((source) => {
    const RealWorker = window.Worker;
    const stub = `self.postMessage({ ready: true });\n${source}`;
    window.__takRequests = [];

    // @ts-ignore - deliberately shadowing the constructor
    window.Worker = function (url, options) {
      if (String(url).includes("tak-annotator")) {
        const blob = new Blob([stub], { type: "text/javascript" });
        const worker = new RealWorker(URL.createObjectURL(blob), options);
        const post = worker.postMessage.bind(worker);
        worker.postMessage = (data) => {
          window.__takRequests.push(data);
          post(data);
        };
        return worker;
      }
      return new RealWorker(url, options);
    };
    window.Worker.prototype = RealWorker.prototype;
  }, body);
}

/** Reports ready, then never answers — a worker that has died or wedged. */
const UNRESPONSIVE_ANNOTATOR = `self.onmessage = () => {};`;

/** Answers every query immediately with "not tak". */
const COUNTING_ANNOTATOR = `
  self.onmessage = () => {
    self.postMessage({ tak: false });
  };
`;

/** Resolve once two consecutive polls see the same request count. */
async function waitForAnnotatorIdle(page) {
  await page.evaluate(() => {
    window.__lastTakCount = -1;
  });
  await page.waitForFunction(
    () => {
      const count = window.__takRequests.length;
      if (window.__lastTakCount === count) return true;
      window.__lastTakCount = count;
      return false;
    },
    null,
    { timeout: 20000, polling: 250 }
  );
}

async function loadPlaytakGame(page) {
  await page.evaluate(
    async ({ ptn, playtakID }) => {
      const store = window.app.$store;
      await store.dispatch("ui/SET_UI", ["autoAnnotateTak", true]);
      await store.dispatch("game/ADD_GAME", {
        ptn,
        name: "PlayTak Live Test",
        config: {
          playtakID,
          playtakLive: true,
          playtakSyncedMainline: 8,
        },
      });
    },
    { ptn: SIZE_6_PTN, playtakID: PLAYTAK_ID }
  );

  await page.waitForFunction(
    () => {
      const game = window.app && window.app.$game;
      return game && game.board && game.plies && game.plies.length >= 8;
    },
    { timeout: 10000 }
  );
}

test.describe("PlayTak live move append", () => {
  test.describe("with an annotator that never answers", () => {
    test.beforeEach(async ({ page }) => {
      await stubAnnotator(page, UNRESPONSIVE_ANNOTATOR);
      await page.goto("/");
      await page.waitForFunction(() => window.app && window.app.$store, {
        timeout: 30000,
      });
    });

    test("still appends a live ply", async ({ page }) => {
      await loadPlaytakGame(page);

      const result = await page.evaluate(
        async ({ playtakID }) => {
          const store = window.app.$store;
          const mainline = () =>
            window.app.$game.plies.filter(
              (ply) => ply && !ply.branch && ply.text !== "--"
            ).length;

          const before = mainline();
          const started = performance.now();
          const outcome = await Promise.race([
            store
              .dispatch("game/APPEND_PLY", {
                ply: "e1",
                playtakLive: { playtakID, syncedMainlineCount: before },
              })
              .then(() => "resolved")
              .catch((error) => `rejected: ${error && error.message}`),
            new Promise((resolve) => setTimeout(() => resolve("hung"), 15000)),
          ]);

          return {
            outcome,
            elapsed: Math.round(performance.now() - started),
            before,
            after: mainline(),
          };
        },
        { playtakID: PLAYTAK_ID }
      );

      expect(result.outcome).toBe("resolved");
      expect(result.after).toBe(result.before + 1);
      // The failsafe, not a real check — it must not become a stall the
      // spectator can perceive.
      expect(result.elapsed).toBeLessThan(3000);
    });

    test("keeps applying later live plies", async ({ page }) => {
      await loadPlaytakGame(page);

      const result = await page.evaluate(
        async ({ playtakID }) => {
          const store = window.app.$store;
          const mainline = () =>
            window.app.$game.plies.filter(
              (ply) => ply && !ply.branch && ply.text !== "--"
            ).length;

          const before = mainline();
          const appended = [];

          // The follow queue drains serially, awaiting each APPEND_PLY in
          // turn — so a single unbounded await stalls every move behind it,
          // not just its own.
          for (const ply of ["e1", "e2", "e3"]) {
            const outcome = await Promise.race([
              store
                .dispatch("game/APPEND_PLY", {
                  ply,
                  playtakLive: {
                    playtakID,
                    syncedMainlineCount: mainline(),
                  },
                })
                .then(() => "resolved")
                .catch((error) => `rejected: ${error && error.message}`),
              new Promise((resolve) =>
                setTimeout(() => resolve("hung"), 15000)
              ),
            ]);
            appended.push(outcome);
            if (outcome !== "resolved") break;
          }

          return { appended, before, after: mainline() };
        },
        { playtakID: PLAYTAK_ID }
      );

      expect(result.appended).toEqual(["resolved", "resolved", "resolved"]);
      expect(result.after).toBe(result.before + 3);
    });
  });

  test.describe("annotating appended plies", () => {
    test.beforeEach(async ({ page }) => {
      await stubAnnotator(page, COUNTING_ANNOTATOR);
      await page.goto("/");
      await page.waitForFunction(() => window.app && window.app.$store, {
        timeout: 30000,
      });
    });

    test("checks only the new plies, not the whole game", async ({ page }) => {
      await loadPlaytakGame(page);

      // Let the game-change sweep (SET_GAME annotates a newly-mounted game)
      // finish before counting, so only the targeted run is measured.
      await waitForAnnotatorIdle(page);

      const result = await page.evaluate(async () => {
        const store = window.app.$store;
        const mainlinePlies = () =>
          window.app.$game.plies.filter(
            (ply) => ply && !ply.branch && ply.text !== "--"
          );

        const gamePlies = mainlinePlies().length;
        await store.dispatch("game/APPEND_PLIES", {
          plies: ["e1", "e2"],
          playtakLive: {
            playtakID: window.app.$game.config.playtakID,
            syncedMainlineCount: gamePlies,
          },
        });

        window.__takRequests.length = 0;
        const appended = mainlinePlies().slice(gamePlies);
        store.dispatch("game/ANNOTATE_PLIES_TAK", appended);

        return { gamePlies, appended: appended.length };
      });

      await waitForAnnotatorIdle(page);
      const targetedChecks = await page.evaluate(
        () => window.__takRequests.length
      );

      // What the same annotation costs unscoped, so the assertion above is
      // measuring a real difference rather than restating the input.
      await page.evaluate(() => {
        window.__takRequests.length = 0;
        window.app.$store.dispatch("game/ANNOTATE_CURRENT_GAME_TAK");
      });
      await waitForAnnotatorIdle(page);
      const sweepChecks = await page.evaluate(
        () => window.__takRequests.length
      );

      expect(result.appended).toBe(2);
      expect(result.gamePlies).toBe(8);
      // One per appended ply...
      expect(targetedChecks).toBe(result.appended);
      // ...against one per ply in the game.
      expect(sweepChecks).toBe(result.gamePlies + result.appended);
    });
  });
});
