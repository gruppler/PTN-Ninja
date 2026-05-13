importScripts("./syntaks.js");

const { solve_tinue, TinueSolver } = wasm_bindgen;

// 2^22 entries × 16 B = 64 MB. Sized for game-wide sweeps.
const SOLVER_BITS = 22;

// One-shot defaults — used when a request omits them.
const DEFAULT_DEEP_PLIES = 9;
const DEFAULT_DEEP_NODES = 0; // 0 = no cap; deep search is cancellable instead.
const DEFAULT_SWEEP_PLIES = 5;
const DEFAULT_SWEEP_NODES = 500_000;

let solver = null;
let ready = false;

async function init() {
  await wasm_bindgen("./syntaks_bg.wasm");
  solver = new TinueSolver(SOLVER_BITS);
  ready = true;
  self.postMessage({ ready: true });
}

self.onmessage = ({ data }) => {
  if (!data) return;
  if (!ready) {
    self.postMessage({ id: data.id, error: "syntaks worker not ready" });
    return;
  }
  try {
    switch (data.kind) {
      case "solve": {
        const max_plies = Number(data.max_plies ?? DEFAULT_DEEP_PLIES) | 0;
        const max_nodes = Number(data.max_nodes ?? DEFAULT_DEEP_NODES);
        const result = solve_tinue(
          data.tps,
          Number(data.size),
          max_plies,
          max_nodes
        );
        self.postMessage({ id: data.id, tps: data.tps, result });
        break;
      }
      case "sweep": {
        const max_plies = Number(data.max_plies ?? DEFAULT_SWEEP_PLIES) | 0;
        const max_nodes = Number(data.max_nodes ?? DEFAULT_SWEEP_NODES);
        const result = solver.solve(
          data.tps,
          Number(data.size),
          max_plies,
          max_nodes
        );
        self.postMessage({ id: data.id, tps: data.tps, result });
        break;
      }
      case "clearCache": {
        solver.clear();
        self.postMessage({ id: data.id, cleared: true });
        break;
      }
      case "stream": {
        // Iterative deepening driven from here so the caller can see
        // each completed depth before the next starts. The persistent
        // TT on `solver` carries cache between iterations.
        //
        // Multipv enumeration is OFF in the streaming path: at the
        // proven depth, verifying each alternate winner costs roughly
        // the same as the primary search (the TT doesn't cut across
        // candidates as cleanly as one might hope), so a 6-winner
        // hard 6x6 at depth 7 stalls for ~20× the primary's wall time
        // before yielding a final answer. Streaming users want the
        // primary tinue surfaced as fast as possible; alternates can
        // be enumerated separately if/when we add a follow-up call.
        const max_plies = Number(data.max_plies ?? DEFAULT_DEEP_PLIES) | 0;
        const max_nodes = Number(data.max_nodes ?? DEFAULT_DEEP_NODES);
        const size = Number(data.size);
        let depth = 1;
        let last = null;
        while (depth <= max_plies) {
          const r = solver.solve_at_depth(
            data.tps,
            size,
            depth,
            max_nodes,
            false /* find_all_winners */
          );
          last = r;
          const kind = r && r.outcome && r.outcome.kind;
          // Emit a progress event per completed depth.
          self.postMessage({
            id: data.id,
            kind: "progress",
            tps: data.tps,
            depth,
            result: r,
          });
          if (kind === "tinue" || kind === "aborted" || kind === "error") {
            break;
          }
          depth += 2;
        }
        // Final result: same shape callers of `solve` / `sweep` expect.
        self.postMessage({ id: data.id, tps: data.tps, result: last });
        break;
      }
      default:
        self.postMessage({
          id: data.id,
          error: `unknown kind: ${data.kind}`,
        });
    }
  } catch (error) {
    self.postMessage({ id: data?.id, error: String(error) });
  }
};

init();
