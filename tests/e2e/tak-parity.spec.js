// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Parity test: the syntaks-backed `is_tak` replacement must agree with
 * tiltak-wasm's `is_tak` across a representative set of positions.
 *
 * Both workers are spawned in the page context (so the wasm fetches go
 * through the running dev server). For each TPS, we ask tiltak's
 * is_tak directly and ask syntaks via a depth-1 solve on the stm-flipped
 * TPS — the same translation tinue-annotator's checkTak performs.
 */

const TEST_CASES = [
  // Empty board — nobody is in tak.
  {
    name: "empty 5x5",
    tps: "x5/x5/x5/x5/x5 1 1",
    size: 5,
  },
  {
    name: "empty 6x6",
    tps: "x6/x6/x6/x6/x6/x6 1 1",
    size: 6,
  },
  {
    name: "empty 7x7",
    tps: "x7/x7/x7/x7/x7/x7/x7 1 1",
    size: 7,
  },
  // P1 has 4 flats in a row on rank 1; P2 just moved, so stm=P1.
  // P1 has tak: P1 can complete the road on their next turn. So is_tak
  // at this TPS (with stm=P1, asking "did the JUST-MOVED player have a
  // 1-ply road?") asks about P2 — who has no pieces, so tak=false.
  {
    name: "5x5 mate-in-1 for stm, opponent has no threats",
    tps: "x5/x5/x5/x5/1,1,1,1,x 1 5",
    size: 5,
  },
  // Same position with stm=P2. Now the just-moved player is P1, who
  // has a 1-ply road. tak should be true.
  {
    name: "5x5 mate-in-1 for opponent of stm",
    tps: "x5/x5/x5/x5/1,1,1,1,x 2 5",
    size: 5,
  },
  // 6x6 variant.
  {
    name: "6x6 mate-in-1 for opponent of stm",
    tps: "x6/x6/x6/x6/x6/1,1,1,1,1,x 2 6",
    size: 6,
  },
  // 7x7 variant.
  {
    name: "7x7 mate-in-1 for opponent of stm",
    tps: "x7/x7/x7/x7/x7/x7/1,1,1,1,1,1,x 2 7",
    size: 7,
  },
  // Dense mid-game-ish 6x6 (from the gruppler vs Cap88 test position
  // we used earlier). Neither side has a 1-ply road completion here.
  {
    name: "6x6 dense mid-game, no immediate tak",
    tps:
      "2S,x,1,1,1,1/2,22,x,21,1,1/x,21211222212,x,1S,1,x/" +
      "x,2,2,x,1C,2/x,1,x,1,2S,x/x,12C,x2,1,x 1 34",
    size: 6,
  },
  // Capstone threat: P1's capstone at e1 can spread to complete a road
  // on rank 1 when it's P1's turn. Stm=P2 here, so it asks "did P1
  // (just moved) have a 1-ply road?" — yes.
  {
    name: "5x5 capstone spread tak threat",
    tps: "x5/x5/x5/x5/1,1,1,1C,x 2 5",
    size: 5,
  },
  // Walls block the would-be road. P1 to move; not in tak from either
  // side's perspective.
  {
    name: "5x5 walls blocking would-be road",
    tps: "x5/x5/x5/x5/1,2S,1,1,x 1 5",
    size: 5,
  },
];

async function init(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.app, { timeout: 30000 });
  // Spawn both workers once and reuse across the test.
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const tiltak = new Worker("/tiltak-wasm/tak-annotator.worker.js");
      const syntaks = new Worker("/syntaks/syntaks.worker.js");
      let tiltakReady = false;
      let syntaksReady = false;
      const ready = () => {
        if (tiltakReady && syntaksReady) {
          window.__takParity = { tiltak, syntaks };
          resolve();
        }
      };
      tiltak.onmessage = ({ data }) => {
        if (data && data.ready) {
          tiltakReady = true;
          ready();
        } else if (window.__takParity && window.__takParity.onTiltak) {
          window.__takParity.onTiltak(data);
        }
      };
      syntaks.onmessage = ({ data }) => {
        if (data && data.ready) {
          syntaksReady = true;
          ready();
        } else if (window.__takParity && window.__takParity.onSyntaks) {
          window.__takParity.onSyntaks(data);
        }
      };
    });
  });
}

async function takOnce(page, tps, size) {
  return await page.evaluate(
    ({ tps, size }) => {
      const { tiltak, syntaks } = window.__takParity;
      const tiltakResult = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject("tiltak timeout"), 15000);
        window.__takParity.onTiltak = (data) => {
          clearTimeout(timer);
          window.__takParity.onTiltak = null;
          if (data && data.error) reject(String(data.error));
          else resolve(!!(data && data.tak));
        };
        tiltak.postMessage({ tps, size });
      });
      // Syntaks: flip the stm digit, then ask for a 1-ply tinue.
      const parts = String(tps).split(/\s+/);
      const flipped = parts.slice();
      flipped[1] = flipped[1] === "1" ? "2" : "1";
      const syntaksResult = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject("syntaks timeout"), 15000);
        window.__takParity.onSyntaks = (data) => {
          clearTimeout(timer);
          window.__takParity.onSyntaks = null;
          if (data && data.error) reject(String(data.error));
          else {
            const outcome = data && data.result && data.result.outcome;
            resolve(!!(outcome && outcome.kind === "tinue"));
          }
        };
        syntaks.postMessage({
          id: 1,
          kind: "sweep",
          tps: flipped.join(" "),
          size,
          max_plies: 1,
          max_nodes: 0,
        });
      });
      return Promise.all([tiltakResult, syntaksResult]).then(
        ([tiltak, syntaks]) => ({ tiltak, syntaks })
      );
    },
    { tps, size }
  );
}

test.describe("tak parity: syntaks depth-1 vs tiltak is_tak", () => {
  test.beforeEach(async ({ page }) => {
    await init(page);
  });

  for (const { name, tps, size } of TEST_CASES) {
    test(name, async ({ page }) => {
      const { tiltak, syntaks } = await takOnce(page, tps, size);
      expect(
        syntaks,
        `tiltak=${tiltak} syntaks=${syntaks} for tps=${tps} size=${size}`
      ).toBe(tiltak);
    });
  }
});
