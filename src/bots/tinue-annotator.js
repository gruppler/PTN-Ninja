/**
 * Tinue search wrapper around the Tinuë Solver Web Worker.
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
import { pliesEqual } from "../Game/PTN/Ply";

const workerUrl = new URL(
  "/tinue-solver/tinue-solver.worker.js",
  import.meta.url
);

let worker = null;
let isReady = false;
let nextRequestId = 1;
const inflight = new Map();
const readyWaiters = [];

// Move-set scope. "full" searches every legal move and finds gap tinues (a
// forced win whose first move makes no immediate threat); "tak-chain"
// restricts to strict tak chains — far faster, but *defined* to miss them.
export const SCOPE_FULL = "full";
export const SCOPE_TAK_CHAIN = "tak-chain";

const normScope = (scope) => scope || SCOPE_FULL;

// The cache is namespaced by scope for the same reason the wasm TT is: a
// "tak-chain" no_tinue is the weaker claim "no tak-chain tinue at this
// depth", and serving it to a "full" query would hide exactly the gap
// tinues full mode exists to find. Without this key, threading scope
// through to the worker would still return the pre-toggle verdict,
// because this cache sits in front of the worker and answers first.
//
// A *tinue* result would in fact be safe to share upward (tak-chain ⊂
// full, and the restricted proof is a real proof), but the two verdicts
// share one entry, so the key stays uniform rather than special-casing
// which half of the cache may leak across namespaces.
const cacheKey = (tps, scope) => `${normScope(scope)}|${tps}`;

// cacheKey(tps, scope) -> { tinue, plies?, pv?, depthSearched, aborted, nodes }
const cache = new Map();

function ensureWorker() {
  if (worker) return;

  worker = new Worker(workerUrl);

  worker.onerror = (error) => {
    console.error("Tinuë Solver worker error:", error);
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
    // Progress events keep the request alive — only the terminating
    // message (with `error` or without a `progress` kind) resolves.
    if (data.kind === "progress") {
      if (pending.onProgress) {
        try {
          pending.onProgress(data);
        } catch (e) {
          // Don't let a progress-callback error kill the request.
        }
      }
      return;
    }
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

function postRequest(payload, opts = {}) {
  ensureWorker();
  return new Promise((resolve, reject) => {
    const id = nextRequestId++;
    inflight.set(id, { resolve, reject, onProgress: opts.onProgress });
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
    throw new Error(outcome.message || "tinue-solver error");
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

function rememberResult(tps, result, scope) {
  const key = cacheKey(tps, scope);
  const prev = cache.get(key);
  if (cacheUpgrades(prev, result)) cache.set(key, result);
}

/**
 * Look up a cached result without launching a search. `scope` must match
 * the scope the result was produced under; omitted means "full".
 */
export function getCached(tps, scope) {
  return cache.get(cacheKey(tps, scope)) || null;
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

/**
 * Score every legal move at `tps` against the worker's warm TT, from
 * `attackerP1`'s perspective. Pure TT lookup — no fresh search — so this
 * is cheap to call on every UI navigation tick once a `searchPosition` /
 * `sweepPosition` / `streamSearchPosition` has populated the TT.
 *
 * Moves whose resulting position isn't in the TT come back with
 * `kind: "unknown"`. Run a deeper search to extend coverage and re-query.
 *
 * @param {string} tps
 * @param {number} size
 * @param {boolean} attackerP1 true if P1 is the attacker (the side whose
 *   forced road we're tracking), false if P2.
 * @returns {Promise<Array<{
 *   move: string,
 *   kind: "win"|"loss"|"nowin"|"flat"|"unknown",
 *   plies?: number, searched?: number, outcome?: "win"|"loss"|"draw"
 * }>>}
 */
export async function scorePosition(tps, size, attackerP1, scope) {
  const reply = await postRequest({
    kind: "score",
    tps,
    size,
    attacker_p1: !!attackerP1,
    scope: normScope(scope),
  });
  return Array.isArray(reply.moves) ? reply.moves : [];
}

/**
 * Search every legal reply at `tps`, where the side to move is the DEFENDER,
 * and report how each one fails.
 *
 * The defender-side counterpart to `sweepPosition`. It searches rather than
 * reading the TT, so it answers on a cold table and its `lost` is a proof —
 * `scorePosition` can only report what past searches happened to leave
 * behind, which is neither complete (a scoped search never visits the replies
 * that lose to the immediate road) nor durable (entries are evicted).
 *
 * Not cached: the result is per-position and the cost is the search itself.
 *
 * @param {string} tps
 * @param {number} size
 * @param {boolean} attackerP1 true if P1 is the attacker — i.e. NOT the side
 *   to move at `tps`.
 * @param {{ maxPlies?: number, maxNodes?: number, scope?: string }} [options]
 * @returns {Promise<{
 *   lost: boolean, plies: number, nodes: number,
 *   defenses: Array<{ move: string, kind: "loses"|"holds"|"unknown",
 *                     plies?: number, pv: string[] }>
 * }>} `plies` counts from this position and is 0 unless `lost`. Each
 *   defense's own `plies` counts from before it, so a reply that hands over
 *   the road on the spot is 1. `defenses` is complete only when `lost` — the
 *   search stops at the first reply that survives.
 */
export async function analyzeDefenses(tps, size, attackerP1, options = {}) {
  const reply = await postRequest({
    kind: "defenses",
    tps,
    size,
    attacker_p1: !!attackerP1,
    max_plies: options.maxPlies,
    max_nodes: options.maxNodes,
    scope: normScope(options.scope),
  });
  const result = reply.result || {};
  return {
    lost: !!result.lost,
    plies: Number(result.plies) || 0,
    nodes: Number(result.nodes) || 0,
    defenses: Array.isArray(result.defenses) ? result.defenses : [],
  };
}

// Flip the side-to-move digit in a TPS string. Used by checkTak below to
// query "does the player who just moved have a 1-ply road threat?" via a
// solver search (which always evaluates from stm's perspective).
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
 * Implemented as a 1-ply solver search on the stm-flipped TPS — the solver
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
    // Scope deliberately omitted (→ "full"). At one ply the question is
    // just "is there a road-completing move", which both scopes answer
    // identically, so there is nothing for the restriction to save and
    // no gap tinue to miss. Bypasses the JS cache too — this path calls
    // the worker directly rather than going through sweepPosition.
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
  const scope = normScope(options.scope);
  const useCache = options.useCache !== false;
  if (useCache) {
    const cached = getCached(tps, scope);
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
    scope,
  });
  const nodes = Number(reply.result && reply.result.nodes) || 0;
  const result = normalize(reply.result, nodes);
  result.scope = scope;
  rememberResult(tps, result, scope);
  return result;
}

/**
 * Sweep search using the worker's persistent TT. Same return shape as
 * searchPosition; intended for the game-wide annotator.
 */
export async function sweepPosition(tps, size, options = {}) {
  const scope = normScope(options.scope);
  const useCache = options.useCache !== false;
  if (useCache) {
    const cached = getCached(tps, scope);
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
    scope,
  });
  const nodes = Number(reply.result && reply.result.nodes) || 0;
  const result = normalize(reply.result, nodes);
  result.scope = scope;
  rememberResult(tps, result, scope);
  return result;
}

/**
 * Streaming search of a single position. Drives iterative deepening from
 * the worker (which calls the wasm `solve_at_depth` repeatedly with a
 * shared TT), invoking `onProgress(intermediate)` after each completed
 * depth. The promise resolves to the final result once the search
 * terminates (tinue found, depth exhausted, or aborted).
 *
 * `onProgress` receives the same normalized shape as `searchPosition`'s
 * return value, with an additional `depth` field. Useful for surfacing
 * "still searching at depth N" / "found Tinue at depth N" updates to
 * the engine drawer without blocking on the full search.
 */
export async function streamSearchPosition(
  tps,
  size,
  options = {},
  onProgress
) {
  const scope = normScope(options.scope);
  const reply = await postRequest(
    {
      kind: "stream",
      tps,
      size,
      max_plies: options.maxPlies,
      max_nodes: options.maxNodes,
      scope,
    },
    {
      onProgress(event) {
        if (!onProgress) return;
        const nodes = Number(event.result && event.result.nodes) || 0;
        const partial = normalize(event.result, nodes);
        partial.depth = event.depth;
        partial.scope = scope;
        onProgress(partial);
      },
    }
  );
  const nodes = Number(reply.result && reply.result.nodes) || 0;
  const result = normalize(reply.result, nodes);
  result.scope = scope;
  rememberResult(tps, result, scope);
  return result;
}

// Did the attacker take the win that was available to them? Names the origin:
// a move that won is the start of the forced sequence, and anything else
// leaves the defender's previous blunder as the event worth pointing at.
//
// Not a test of whether the position after the move is lost — see
// reachedLostPosition, which answers that and often answers yes where this
// says no.
function reachedByWinningMove(ply, result) {
  if (!ply || !ply.tpsAfter || !result || !result.tinue) {
    return null;
  }
  const winners =
    Array.isArray(result.winningFirstMoves) && result.winningFirstMoves.length
      ? result.winningFirstMoves
      : result.pv && result.pv.length
      ? [result.pv[0]]
      : [];
  return winners.some((winner) => pliesEqual(ply, winner))
    ? ply.tpsAfter
    : null;
}

// The position a played move reaches, when the defender is lost there. That
// is what puts it in the same span as the position the move came from, and it
// is a weaker condition than the move having been a winning one: a win the
// attacker fails to take usually survives their blunder at greater distance,
// leaving the position after it lost all the same. Answering it needs the
// replies searched, which `analyzeDefenses` does.
async function reachedLostPosition(ply, size, searchOptions) {
  if (!ply || !ply.tpsAfter) {
    return null;
  }
  const attackerP1 = Number(String(ply.tpsAfter).split(" ")[1]) !== 1;
  try {
    const report = await analyzeDefenses(
      ply.tpsAfter,
      size,
      attackerP1,
      searchOptions
    );
    return report.lost ? ply.tpsAfter : null;
  } catch (e) {
    return null;
  }
}

// Extend `span` forward along the played line for as long as it stays inside
// the win. Each step covers two plies: the position the attacker's move
// reached, while the defender is lost there, and the one the defender's reply
// reached, which is a tinue again whatever they played — that is what being
// lost means.
//
// Forward follows `nextPly`, the first child, where backward follows the
// unambiguous parent chain — so at a branch point the span covers the main
// continuation only.
async function extendSpanForward(startPly, size, searchOptions, span) {
  let ply = startPly;
  for (;;) {
    const reached = await reachedLostPosition(ply, size, searchOptions);
    if (!reached) {
      return;
    }
    span.push(reached);
    const defense = ply.nextPly;
    const next = defense && defense.nextPly;
    if (!next || !next.tpsBefore) {
      return;
    }
    span.push(next.tpsBefore);
    ply = next;
  }
}

/**
 * Walk backward from a proven tinue to the earliest position from which
 * the win was already forced.
 *
 * Steps back one full turn at a time — `prevPly.prevPly`, since the
 * attacker moves every other ply — solving each position until one is not
 * a tinue. The win began at the position after that one. Following
 * `prevPly` (the parent) rather than ply index keeps the walk on the
 * actual line when the position sits inside a branch.
 *
 * Cheap because of TT reuse: an earlier position's winning subtree largely
 * contains the later one's, so each step back mostly replays cached work
 * rather than solving from scratch. It runs through `sweepPosition` for
 * that reason — the worker's persistent TinueSolver is where that TT lives.
 *
 * **The answer is only as good as the search.** The walk terminates at the
 * first position that is not a tinue, so anything the budget fails to
 * resolve looks exactly like a boundary. An aborted search therefore stops
 * the walk with `status: "unknown"` and must never be read as "not a
 * tinue" — that would report an origin later than the truth, confidently.
 * The same applies to scope: a strict walk finds where the *tak-chain*
 * tinue began, so the scope used is returned for labelling.
 *
 * The boundary is a property of the *chain*, not of the position the walk
 * happened to start from: entering the same line one turn later re-treads
 * the same parents and stops in the same place. So the walk also returns
 * the span it proved — every position from the origin through `startPly` —
 * and one trace legitimately answers for all of them.
 *
 * @param {object} startPly A ply whose `tpsBefore` is a proven tinue — i.e.
 *   the ATTACKER is to move there. The solver always searches from the side
 *   to move, so starting on a defender-to-move position silently traces the
 *   losing player's wins instead; the caller anchors that.
 * @param {number} size
 * @param {{ maxPlies?: number, maxNodes?: number, scope?: string }} [options]
 * @param {function} [onProgress] Called with `{ ply, result, examined }`
 *   after each position, so a long walk can show progress.
 * @returns {Promise<null | {
 *   originPly: object, originPlyIsDone: boolean,
 *   status: "found"|"unknown"|"start-of-game",
 *   examined: number, scope: string, span: string[]
 * }>} `originPly` names the origin position — the attacker's winning move
 *   when they played one, otherwise the defender blunder that handed the win
 *   over, with `originPlyIsDone` saying which side of it the board sits on.
 *   `status` is
 *   `found` when a genuine non-tinue boundary was reached, `unknown` when
 *   the search ran out of budget first, and `start-of-game` when the walk
 *   reached the beginning without ever finding a boundary. `span` holds
 *   every position the origin answers for: each attacker-to-move position
 *   the walk confirmed, plus the defender-to-move position after it
 *   whenever the move played from it was a winning one.
 */
export async function findTinueOrigin(
  startPly,
  size,
  options = {},
  onProgress
) {
  if (!startPly || !startPly.tpsBefore) {
    return null;
  }
  const scope = normScope(options.scope);
  const searchOptions = {
    maxPlies: options.maxPlies,
    maxNodes: options.maxNodes,
    scope,
  };

  let forcedFrom = startPly;
  let ply = startPly;
  let examined = 0;
  // The caller's own position counts as proven — it is the premise of the
  // walk. Each confirmed step appends, so `span` ends at the origin.
  const span = [startPly.tpsBefore];

  // Names the origin when the walk stops right here; the search that
  // established the premise left it in the cache.
  let forcedFromResult = getCached(startPly.tpsBefore, scope);

  // The span runs both ways from where the walk was started. Backward is the
  // loop below; forward is every position the line stays inside the win for,
  // so entering the run in the middle covers the rest of it too.
  await extendSpanForward(startPly, size, searchOptions, span);

  // Which ply names the origin. Two plies touch that position, and they are
  // different events:
  //
  //   the ply out of it — the attacker's turn. The start of the forced
  //     sequence when they played a winning move, and merely the move that
  //     threw the win away when they did not.
  //   the ply into it — the defender's turn, and always a blunder. The walk
  //     stops because the position a full turn earlier is NOT a tinue, which
  //     means some reply to the attacker's move from there held; the
  //     defender had a save and played something else.
  //
  // So the taken win names itself, and everything else is named by the
  // blunder that handed it over. `isDone` follows from which side of the
  // origin the named ply sits on, and either way it puts the board on the
  // origin itself: after the blunder played into it, or before the winning
  // move played out of it.
  const originOf = (status) => {
    const tookIt = !!reachedByWinningMove(forcedFrom, forcedFromResult);
    const blunder = tookIt ? null : forcedFrom.prevPly;
    return {
      originPly: blunder || forcedFrom,
      originPlyIsDone: !!blunder,
      status,
      examined,
      scope,
      span,
    };
  };

  for (;;) {
    const prev = ply.prevPly && ply.prevPly.prevPly;
    if (!prev || !prev.tpsBefore) {
      return originOf("start-of-game");
    }

    let result;
    try {
      result = await sweepPosition(prev.tpsBefore, size, searchOptions);
    } catch (e) {
      // Worker died or the walk was cancelled: report what is confirmed so
      // far rather than inventing a boundary here.
      return originOf("unknown");
    }

    examined++;
    onProgress?.({ ply: prev, result, examined });

    if (result.aborted) {
      return originOf("unknown");
    }
    if (!result.tinue) {
      return originOf("found");
    }

    forcedFrom = prev;
    forcedFromResult = result;
    ply = prev;
    span.push(prev.tpsBefore);
    const reached = await reachedLostPosition(prev, size, searchOptions);
    if (reached) {
      span.push(reached);
    }
  }
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
 * directly from the solver. We approximate (2) with ply.isEqual(pv[0]) —
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
      reject(new Error("tinue-solver: cancelled"));
    }
    inflight.clear();
  }
}

export { isReady };
