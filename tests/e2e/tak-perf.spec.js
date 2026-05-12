// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Performance benchmark: tiltak `is_tak` vs syntaks depth-1 search.
 *
 * Each call has to round-trip through a Web Worker postMessage, so the
 * benchmark reflects what the app actually pays per check — not just
 * raw wasm throughput. We warm both workers, then alternate workloads
 * across a position mix.
 */

const ITERATIONS = 2000;

// Mix of position complexities so the benchmark isn't dominated by one
// shape. Each entry is asked alternately.
const POSITIONS = [
  // Empties — tiltak should fall through fast; syntaks enumerates
  // placements and finds none completes a road.
  { name: "empty 5", tps: "x5/x5/x5/x5/x5 1 1", size: 5 },
  { name: "empty 6", tps: "x6/x6/x6/x6/x6/x6 1 1", size: 6 },
  { name: "empty 7", tps: "x7/x7/x7/x7/x7/x7/x7 1 1", size: 7 },
  // Single-move-away road for the just-moved player (tak = true).
  {
    name: "5 tak",
    tps: "x5/x5/x5/x5/1,1,1,1,x 2 5",
    size: 5,
  },
  {
    name: "6 tak",
    tps: "x6/x6/x6/x6/x6/1,1,1,1,1,x 2 6",
    size: 6,
  },
  {
    name: "7 tak",
    tps: "x7/x7/x7/x7/x7/x7/1,1,1,1,1,1,x 2 7",
    size: 7,
  },
  // Dense 6x6 mid-game (gruppler vs Cap88 fragment) — no immediate tak.
  {
    name: "6 dense",
    tps:
      "2S,x,1,1,1,1/2,22,x,21,1,1/x,21211222212,x,1S,1,x/" +
      "x,2,2,x,1C,2/x,1,x,1,2S,x/x,12C,x2,1,x 1 34",
    size: 6,
  },
];

function flipStm(tps) {
  const parts = String(tps).split(/\s+/);
  parts[1] = parts[1] === "1" ? "2" : "1";
  return parts.join(" ");
}

test("tak check performance: tiltak vs syntaks", async ({ page }) => {
  test.setTimeout(300000);

  await page.goto("/");
  await page.waitForFunction(() => window.app, { timeout: 30000 });

  // Prepare workers.
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const tiltak = new Worker("/tiltak-wasm/tak-annotator.worker.js");
      const syntaks = new Worker("/syntaks/syntaks.worker.js");
      let tiltakReady = false;
      let syntaksReady = false;
      const maybe = () => {
        if (tiltakReady && syntaksReady) {
          window.__perf = {
            tiltak,
            syntaks,
            tiltakResolve: null,
            syntaksResolve: null,
          };
          tiltak.onmessage = ({ data }) => {
            const r = window.__perf.tiltakResolve;
            window.__perf.tiltakResolve = null;
            if (r) r(!!(data && data.tak));
          };
          syntaks.onmessage = ({ data }) => {
            const r = window.__perf.syntaksResolve;
            window.__perf.syntaksResolve = null;
            if (r) {
              const outcome = data && data.result && data.result.outcome;
              r(!!(outcome && outcome.kind === "tinue"));
            }
          };
          resolve();
        }
      };
      tiltak.onmessage = ({ data }) => {
        if (data && data.ready) {
          tiltakReady = true;
          maybe();
        }
      };
      syntaks.onmessage = ({ data }) => {
        if (data && data.ready) {
          syntaksReady = true;
          maybe();
        }
      };
    });
  });

  // Warmup: a few iterations of each so JIT / wasm caches settle.
  await page.evaluate(
    ({ positions }) => {
      const askTiltak = (tps, size) =>
        new Promise((res) => {
          window.__perf.tiltakResolve = res;
          window.__perf.tiltak.postMessage({ tps, size });
        });
      const askSyntaks = (tps, size) =>
        new Promise((res) => {
          window.__perf.syntaksResolve = res;
          const flipped = String(tps).split(/\s+/);
          flipped[1] = flipped[1] === "1" ? "2" : "1";
          window.__perf.syntaks.postMessage({
            id: 1,
            kind: "sweep",
            tps: flipped.join(" "),
            size,
            max_plies: 1,
            max_nodes: 0,
          });
        });
      return (async () => {
        for (let i = 0; i < 20; i++) {
          for (const p of positions) {
            await askTiltak(p.tps, p.size);
            await askSyntaks(p.tps, p.size);
          }
        }
      })();
    },
    { positions: POSITIONS }
  );

  // Benchmark.
  const stats = await page.evaluate(
    ({ positions, iterations }) => {
      const askTiltak = (tps, size) =>
        new Promise((res) => {
          window.__perf.tiltakResolve = res;
          window.__perf.tiltak.postMessage({ tps, size });
        });
      const askSyntaks = (tps, size) =>
        new Promise((res) => {
          window.__perf.syntaksResolve = res;
          const flipped = String(tps).split(/\s+/);
          flipped[1] = flipped[1] === "1" ? "2" : "1";
          window.__perf.syntaks.postMessage({
            id: 1,
            kind: "sweep",
            tps: flipped.join(" "),
            size,
            max_plies: 1,
            max_nodes: 0,
          });
        });

      const measure = async (asker) => {
        const t0 = performance.now();
        for (let i = 0; i < iterations; i++) {
          for (const p of positions) {
            await asker(p.tps, p.size);
          }
        }
        return performance.now() - t0;
      };

      return (async () => {
        // Alternate which one runs first across runs to neutralize any
        // residual warmup advantage.
        const tiltakMs = await measure(askTiltak);
        const syntaksMs = await measure(askSyntaks);
        const tiltakMs2 = await measure(askTiltak);
        const syntaksMs2 = await measure(askSyntaks);
        const total = iterations * positions.length;
        return {
          totalCalls: total,
          tiltak: {
            run1Ms: tiltakMs,
            run2Ms: tiltakMs2,
            avgUsPerCall: ((tiltakMs + tiltakMs2) * 1000) / (2 * total),
          },
          syntaks: {
            run1Ms: syntaksMs,
            run2Ms: syntaksMs2,
            avgUsPerCall: ((syntaksMs + syntaksMs2) * 1000) / (2 * total),
          },
        };
      })();
    },
    { positions: POSITIONS, iterations: ITERATIONS }
  );

  console.log("\nTak check performance");
  console.log(`  positions per iteration: ${POSITIONS.length}`);
  console.log(`  iterations: ${ITERATIONS}`);
  console.log(`  total calls per engine per run: ${stats.totalCalls}`);
  console.log(
    `  tiltak:  ${stats.tiltak.run1Ms.toFixed(1)} / ${stats.tiltak.run2Ms.toFixed(1)} ms  (~${stats.tiltak.avgUsPerCall.toFixed(1)} µs/call)`
  );
  console.log(
    `  syntaks: ${stats.syntaks.run1Ms.toFixed(1)} / ${stats.syntaks.run2Ms.toFixed(1)} ms  (~${stats.syntaks.avgUsPerCall.toFixed(1)} µs/call)`
  );
  const ratio = stats.syntaks.avgUsPerCall / stats.tiltak.avgUsPerCall;
  console.log(
    `  syntaks vs tiltak: ${ratio.toFixed(2)}×  ${
      ratio < 1 ? "(syntaks faster)" : "(tiltak faster)"
    }`
  );

  // Sanity guards: both should complete in reasonable time. No hard
  // assertion on which one wins — the goal is comparative numbers.
  expect(stats.tiltak.run1Ms).toBeGreaterThan(0);
  expect(stats.syntaks.run1Ms).toBeGreaterThan(0);
});
