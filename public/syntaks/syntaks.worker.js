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
