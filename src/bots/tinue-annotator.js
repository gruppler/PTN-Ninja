/**
 * Tinue search wrapper around the syntaks Web Worker.
 *
 * Two modes:
 *   - searchPosition: deep one-shot search on a single position (engine UX).
 *     Cancellable by terminating the worker.
 *   - sweepGame: backward iteration through the game using the worker's
 *     persistent TinueSolver, which warms the TT for earlier positions.
 *     Only marks PROVEN tinues; aborted positions stay in the JS cache
 *     with `aborted: true` for follow-up.
 *
 * A tab-lifetime JS cache (keyed by TPS) shortcuts both modes — once a
 * position has been proven tinue or proven no-tinue at sufficient depth,
 * subsequent calls return instantly without touching the worker.
 */

import store from "../store";

const workerUrl = new URL("/syntaks/syntaks.worker.js", import.meta.url);

let worker = null;
let isReady = false;
let nextRequestId = 1;
const inflight = new Map();
const readyWaiters = [];

// tps -> { tinue, plies?, pv?, depthSearched, aborted, nodes }
const cache = new Map();

function ensureWorker() {
  if (worker) return;

  worker = new Worker(workerUrl);

  worker.onerror = (error) => {
    console.error("Syntaks worker error:", error);
    const pending = [...inflight.values()];
    inflight.clear();
    worker = null;
    isReady = false;
    for (const { reject } of pending) reject(error);
  };

  worker.onmessage = ({ data }) => {
    if (data && data.ready) {
      isReady = true;
      for (const fn of readyWaiters.splice(0)) fn();
      return;
    }
    if (!data || data.id == null) return;
    const pending = inflight.get(data.id);
    if (!pending) return;
    inflight.delete(data.id);
    if (data.error) {
      pending.reject(new Error(data.error));
    } else {
      pending.resolve(data);
    }
  };
}

function whenReady() {
  if (isReady) return Promise.resolve();
  return new Promise((resolve) => readyWaiters.push(resolve));
}

function postRequest(payload) {
  ensureWorker();
  return new Promise((resolve, reject) => {
    const id = nextRequestId++;
    inflight.set(id, { resolve, reject });
    whenReady().then(() => {
      if (worker) worker.postMessage({ ...payload, id });
    });
  });
}

function normalize(rawResult, nodes) {
  const outcome = rawResult && rawResult.outcome;
  if (!outcome) return { tinue: false, nodes };
  if (outcome.kind === "tinue") {
    return {
      tinue: true,
      plies: outcome.plies,
      pv: outcome.pv,
      // Every attacker first-move at the root that wins at the same
      // depth. The engine populates this so callers (e.g. the auto-
      // annotator) can mark any played ply that's on the road to
      // tinue, not just the engine's primary PV.
      winningFirstMoves: Array.isArray(outcome.winning_first_moves)
        ? outcome.winning_first_moves
        : outcome.pv && outcome.pv.length
        ? [outcome.pv[0]]
        : [],
      depthSearched: outcome.plies,
      nodes,
    };
  }
  if (outcome.kind === "no_tinue") {
    return {
      tinue: false,
      depthSearched: outcome.searched_plies,
      nodes,
    };
  }
  if (outcome.kind === "aborted") {
    return {
      tinue: false,
      aborted: true,
      depthSearched: outcome.searched_plies,
      nodes,
    };
  }
  if (outcome.kind === "error") {
    throw new Error(outcome.message || "syntaks error");
  }
  return { tinue: false, nodes };
}

function cacheUpgrades(prev, next) {
  // Anything beats nothing.
  if (!prev) return true;
  // Proven tinue is final.
  if (prev.tinue) return false;
  // A new tinue proof always upgrades a non-tinue cache entry.
  if (next.tinue) return true;
  // Among non-tinue results: prefer more depth searched, prefer proven over
  // aborted at equal depth.
  const prevDepth = prev.depthSearched || 0;
  const nextDepth = next.depthSearched || 0;
  if (nextDepth > prevDepth) return true;
  if (nextDepth < prevDepth) return false;
  return prev.aborted && !next.aborted;
}

function rememberResult(tps, result) {
  const prev = cache.get(tps);
  if (cacheUpgrades(prev, result)) cache.set(tps, result);
}

/** Look up cached result for a TPS without launching a search. */
export function getCached(tps) {
  return cache.get(tps) || null;
}

/** Discard the JS-side cache. Does NOT clear the worker's TT. */
export function clearCache() {
  cache.clear();
}

/** Discard both the JS cache and the worker's TT. */
export async function clearAllCaches() {
  cache.clear();
  if (worker && isReady) {
    try {
      await postRequest({ kind: "clearCache" });
    } catch (e) {
      // Worker terminated mid-flight; nothing to clear.
    }
  }
}

/** Pre-initialize the worker so the wasm module loads before first use. */
export function preload() {
  ensureWorker();
}

// Flip the side-to-move digit in a TPS string. Used by checkTak below to
// query "does the player who just moved have a 1-ply road threat?" via a
// syntaks search (which always evaluates from stm's perspective).
function flipStm(tps) {
  const parts = String(tps).split(/\s+/);
  if (parts.length < 2) return tps;
  if (parts[1] === "1") parts[1] = "2";
  else if (parts[1] === "2") parts[1] = "1";
  else return tps;
  return parts.join(" ");
}

/**
 * Single-position tak check. Returns true iff the player who just moved
 * (i.e., the opponent of the current stm at `tps`) has an immediate road
 * win available next turn. Equivalent to tiltak-wasm's `is_tak`.
 *
 * Implemented as a 1-ply syntaks search on the stm-flipped TPS — syntaks
 * answers "does stm have a forced road in N plies?" so flipping the stm
 * before the query reframes it as "does the just-moved player have one?".
 *
 * Uses the worker's persistent TinueSolver (sweep mode) so the 16 MB TT
 * is allocated once and reused. The fresh-TT one-shot `solve` path costs
 * ~2.5 ms per call from the allocation alone; sweep mode lands around
 * 70 µs/call, ~1.75× faster than tiltak's `is_tak`.
 *
 * Sizes 5/6/7 only. Smaller boards should route through tiltak.
 *
 * @param {string} tps
 * @param {number} size
 * @returns {Promise<{ tak: boolean }>}
 */
export async function checkTak(tps, size) {
  const flipped = flipStm(tps);
  const reply = await postRequest({
    kind: "sweep",
    tps: flipped,
    size,
    max_plies: 1,
    // 0 = no cap; depth-1 search is bounded by the move count anyway.
    max_nodes: 0,
  });
  const outcome = reply.result && reply.result.outcome;
  return { tak: !!(outcome && outcome.kind === "tinue") };
}

/**
 * Deep search a single position. Bypasses the worker's persistent TT
 * (one-shot mode) so the result depends only on the requested budget.
 *
 * @param {string} tps
 * @param {number} size
 * @param {{ maxPlies?: number, maxNodes?: number, useCache?: boolean }} [options]
 * @returns {Promise<{ tinue, plies?, pv?, depthSearched, aborted?, nodes }>}
 */
export async function searchPosition(tps, size, options = {}) {
  const useCache = options.useCache !== false;
  if (useCache) {
    const cached = getCached(tps);
    // Reuse cache only if it satisfies (or exceeds) the requested depth and
    // wasn't an aborted result at lower depth.
    if (cached) {
      const wantPlies = Number(options.maxPlies) || 0;
      if (cached.tinue) return cached;
      if (
        !cached.aborted &&
        wantPlies > 0 &&
        cached.depthSearched >= wantPlies
      ) {
        return cached;
      }
    }
  }
  const reply = await postRequest({
    kind: "solve",
    tps,
    size,
    max_plies: options.maxPlies,
    max_nodes: options.maxNodes,
  });
  const nodes = Number(reply.result && reply.result.nodes) || 0;
  const result = normalize(reply.result, nodes);
  rememberResult(tps, result);
  return result;
}

/**
 * Sweep search using the worker's persistent TT. Same return shape as
 * searchPosition; intended for the game-wide annotator.
 */
export async function sweepPosition(tps, size, options = {}) {
  const useCache = options.useCache !== false;
  if (useCache) {
    const cached = getCached(tps);
    if (cached) {
      const wantPlies = Number(options.maxPlies) || 0;
      if (cached.tinue) return cached;
      if (
        !cached.aborted &&
        wantPlies > 0 &&
        cached.depthSearched >= wantPlies
      ) {
        return cached;
      }
    }
  }
  const reply = await postRequest({
    kind: "sweep",
    tps,
    size,
    max_plies: options.maxPlies,
    max_nodes: options.maxNodes,
  });
  const nodes = Number(reply.result && reply.result.nodes) || 0;
  const result = normalize(reply.result, nodes);
  rememberResult(tps, result);
  return result;
}

let sweepCancelToken = null;

/**
 * Walk every ply in `game` (in reverse — late positions are easier and
 * warm the TT for earlier ones). Marks proven tinues with `"`. Aborted
 * results stay in the cache; the UI can surface them as "needs deeper
 * search" without lying in the PTN.
 *
 * Per Definition 3 of the formal Tinuë spec, a move is marked `"` iff:
 *   1. The position BEFORE the move is in odd-ply Tinuë (the player about
 *      to move has a forced road win), and
 *   2. The move matches the first ply of a Tinuë sequence (a winning move).
 *
 * Solving at tps_before with the side-to-move = ply's player gives (1)
 * directly from syntaks. We approximate (2) with ply.isEqual(pv[0]) —
 * matches the engine's first-choice winning move; alternative equally-
 * winning moves currently produce false negatives, which is acceptable
 * (we never falsely mark a non-Tinuë move).
 *
 * @param {object} game
 * @param {function} [onProgress] - called with { done, total, lastResult }
 * @param {{ maxPlies?: number, maxNodes?: number }} [options]
 * @returns {Promise<{ proven: number, aborted: number, total: number }>}
 */
export async function sweepGame(game, onProgress, options = {}) {
  if (sweepCancelToken) sweepCancelToken.cancelled = true;
  const cancelToken = { cancelled: false };
  sweepCancelToken = cancelToken;

  ensureWorker();

  const size = game.config.size;
  const plies = game.plies.filter((ply) => ply && ply.tpsBefore);
  const total = plies.length;
  let done = 0;
  let provenCount = 0;
  let abortedCount = 0;
  const tinuePlyIDs = new Set();

  // Iterate backwards: late positions usually solve faster and seed the TT
  // for earlier positions whose searches will revisit them.
  for (let i = plies.length - 1; i >= 0; i--) {
    if (cancelToken.cancelled) break;
    const ply = plies[i];
    let result;
    try {
      result = await sweepPosition(ply.tpsBefore, size, options);
    } catch (e) {
      done++;
      onProgress?.({ done, total, lastResult: null });
      continue;
    }
    if (cancelToken.cancelled) break;
    const isTinueMove =
      result.tinue &&
      Array.isArray(result.pv) &&
      result.pv.length > 0 &&
      ply.isEqual(result.pv[0]);
    if (isTinueMove) {
      tinuePlyIDs.add(ply.id);
      provenCount++;
    } else if (result.aborted) {
      abortedCount++;
    }
    done++;
    onProgress?.({ done, total, lastResult: result });
  }

  if (cancelToken === sweepCancelToken) sweepCancelToken = null;

  if (!cancelToken.cancelled) {
    store.commit("game/SET_TINUE_ANNOTATIONS", tinuePlyIDs);
  }

  return { proven: provenCount, aborted: abortedCount, total };
}

/** Cancel any in-progress sweep. Does not interrupt a deep single search. */
export function cancelSweep() {
  if (sweepCancelToken) {
    sweepCancelToken.cancelled = true;
    sweepCancelToken = null;
  }
}

/**
 * Hard-cancel all in-flight work by terminating the worker. The worker
 * will be re-initialized on next use. Used to interrupt a deep single
 * search that has no nodes-budget exit.
 */
export async function cancelAll() {
  cancelSweep();
  if (worker) {
    try {
      worker.terminate();
    } catch (e) {
      // ignore
    }
    worker = null;
    isReady = false;
    for (const { reject } of inflight.values()) {
      reject(new Error("syntaks: cancelled"));
    }
    inflight.clear();
  }
}

export { isReady };
