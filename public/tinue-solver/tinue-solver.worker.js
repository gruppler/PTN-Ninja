importScripts("./tinue-solver.js");

const { solve_tinue, TinueSolver } = wasm_bindgen;

// 2^22 entries × 16 B = 64 MB. Sized for game-wide sweeps.
const SOLVER_BITS = 22;

// One-shot defaults — used when a request omits them.
const DEFAULT_DEEP_PLIES = 9;
const DEFAULT_DEEP_NODES = 0; // 0 = no cap; deep search is cancellable instead.
const DEFAULT_SWEEP_PLIES = 5;
const DEFAULT_SWEEP_NODES = 500_000;

// Move-set scope. "full" searches every legal move and so finds quiet tinues
// (a forced win whose first move makes no immediate threat); "tak-chain"
// restricts to strict tak chains, which is far faster but is *defined* to
// miss them. A "tak-chain" no_tinue therefore means "no tak-chain tinue",
// not "no tinue" — callers must label it accordingly.
//
// Omitted → the wasm defaults to "full", the behaviour that predates this
// parameter, so an older caller keeps its old semantics.
const scopeOf = (data) => data.scope ?? null;

// The road-distance skip. Heuristic and sweep-only: it can in principle
// skip a real tinue, so anything but an explicit game-wide sweep must
// leave it off. Negative disables it, which is the default here — the
// sweep opts in by sending an explicit margin.
const marginOf = (data) => Number(data.prefilter_margin ?? -1);

let solver = null;
let ready = false;

async function init() {
  // Object form, not a bare path: wasm-bindgen deprecated positional args
  // to the init function and warns on every load otherwise.
  await wasm_bindgen({ module_or_path: "./tinue-solver_bg.wasm" });
  solver = new TinueSolver(SOLVER_BITS);
  ready = true;
  self.postMessage({ ready: true });
}

self.onmessage = ({ data }) => {
  if (!data) return;
  if (!ready) {
    self.postMessage({ id: data.id, error: "tinue-solver worker not ready" });
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
          max_nodes,
          scopeOf(data)
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
          max_nodes,
          scopeOf(data),
          marginOf(data)
        );
        self.postMessage({ id: data.id, tps: data.tps, result });
        break;
      }
      case "defenses": {
        // Defender-side analysis: searches every reply rather than reading
        // the TT, so `lost` is a proof and the list survives a cold table.
        // See TinueSolver::analyze_defenses.
        const result = solver.analyze_defenses(
          data.tps,
          Number(data.size),
          !!data.attacker_p1,
          Number(data.max_plies ?? DEFAULT_DEEP_PLIES) | 0,
          Number(data.max_nodes ?? DEFAULT_SWEEP_NODES),
          scopeOf(data)
        );
        self.postMessage({ id: data.id, tps: data.tps, result });
        break;
      }
      case "clearCache": {
        solver.clear();
        self.postMessage({ id: data.id, cleared: true });
        break;
      }
      case "score": {
        // Pure TT lookup — no fresh search. Returns the per-legal-move
        // verdicts from `attacker_p1`'s perspective at `tps`. Cheap enough
        // to call on every UI navigation tick; the proof needs to have
        // already been warmed by a prior `solve`/`stream`/`sweep` on the
        // same TinueSolver instance.
        // Verdicts are stored per scope, so this must be given the same
        // scope the populating solve used — a mismatch returns `unknown`
        // for every move rather than another scope's answers.
        const moves = solver.score_moves(
          data.tps,
          Number(data.size),
          !!data.attacker_p1,
          scopeOf(data)
        );
        self.postMessage({ id: data.id, tps: data.tps, moves });
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
        const scope = scopeOf(data);
        let depth = 1;
        let last = null;
        while (depth <= max_plies) {
          const r = solver.solve_at_depth(
            data.tps,
            size,
            depth,
            max_nodes,
            false /* find_all_winners */,
            scope
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
