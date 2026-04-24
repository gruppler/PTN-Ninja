/**
 * Lightweight wrapper around the tak-annotator Web Worker.
 * Uses is_tak / is_tinue from the Tiltak wasm binary to annotate positions.
 */

import store from "../store";
import Ply from "../Game/PTN/Ply";

const workerUrl = new URL(
  "/tiltak-wasm/tak-annotator.worker.js",
  import.meta.url
);

let worker = null;
let isReady = false;
const queue = [];

function ensureWorker() {
  if (worker) return;

  worker = new Worker(workerUrl);

  worker.onerror = (error) => {
    console.error("Tak annotator worker error:", error);
    worker = null;
    isReady = false;
    // Reject all pending work
    for (const { reject } of queue.splice(0)) {
      reject(error);
    }
  };

  worker.onmessage = ({ data }) => {
    if (data.ready) {
      isReady = true;
      return;
    }
    const next = queue.shift();
    if (!next) return;
    if (data.error) {
      next.reject(new Error(data.error));
    } else {
      next.resolve(data);
    }
    dispatchNext();
  };
}

function dispatchNext() {
  if (queue.length && queue[0].dispatched) return;
  if (!queue.length) return;
  const item = queue[0];
  item.dispatched = true;
  worker.postMessage(item.request);
}

/**
 * Query whether a single position is in tak (immediate road-win threat).
 *
 * @param {string} tps - TPS string of the position *after* the move being annotated
 * @param {number} size - Board size (4, 5, or 6)
 * @returns {Promise<{ tak: boolean }>}
 */
export function checkPosition(tps, size) {
  ensureWorker();
  return new Promise((resolve, reject) => {
    queue.push({ request: { tps, size }, resolve, reject });
    if (queue.length === 1) dispatchNext();
  });
}

/** Pre-initialize the worker so the wasm module loads before first use. */
export function preload() {
  ensureWorker();
}

let annotationCancelToken = null;

/**
 * Mark all plies in `game` with tak (') where applicable.
 * Replaces any existing tak mark; preserves !, ?, and tinue (") marks.
 *
 * @param {object} game - the Game instance (Vue.prototype.$game / this.$game in components)
 * @param {function} [onProgress] - Called with { done, total } after each position
 * @returns {Promise<void>} Resolves when done or cancelled
 */
export async function annotateGame(game, onProgress) {
  if (annotationCancelToken) {
    annotationCancelToken.cancelled = true;
  }
  const cancelToken = { cancelled: false };
  annotationCancelToken = cancelToken;

  ensureWorker();

  const size = game.config.size;
  const plies = game.plies.filter((ply) => ply && ply.tpsAfter);
  const total = plies.length;
  let done = 0;
  const takPlyIDs = new Set();

  for (const ply of plies) {
    if (cancelToken.cancelled) break;

    let result;
    try {
      result = await checkPosition(ply.tpsAfter, size);
    } catch (e) {
      done++;
      onProgress?.({ done, total });
      continue;
    }

    if (cancelToken.cancelled) break;

    if (result.tak) {
      takPlyIDs.add(ply.id);
    }

    done++;
    onProgress?.({ done, total });
  }

  if (cancelToken === annotationCancelToken) {
    annotationCancelToken = null;
  }

  if (!cancelToken.cancelled) {
    store.commit("game/SET_TAK_ANNOTATIONS", takPlyIDs);
  }
}

/** Cancel any in-progress annotation. */
export function cancelAnnotation() {
  if (annotationCancelToken) {
    annotationCancelToken.cancelled = true;
    annotationCancelToken = null;
  }
}

/**
 * Simulate applying `plyText` at the current board state and return the
 * resulting TPS without leaving the board in a different state.
 * Returns null if the ply is invalid or can't be simulated.
 */
function simulateTpsAfter(game, plyText) {
  if (!game || !game.board) return null;
  const board = game.board;
  let parsed;
  try {
    parsed = Ply.parse(plyText, {
      id: game.plies.length,
      player: board.turn,
      color: board.color,
      beforeTPS: board.tps,
    });
  } catch (e) {
    return null;
  }
  if (!parsed || !parsed.isValid()) return null;

  let moveset;
  try {
    moveset = parsed.toMoveset();
  } catch (e) {
    return null;
  }
  if (!moveset || !moveset.length || moveset[0].errors) return null;

  try {
    board._doMoveset(moveset, parsed.color, parsed);
  } catch (e) {
    return null;
  }
  const nextPlayer = parsed.player === 1 ? 2 : 1;
  const nextNumber = parsed.player === 2 ? board.number + 1 : board.number;
  let tps = null;
  try {
    tps = board.getTPS(nextPlayer, nextNumber);
  } catch (e) {
    tps = null;
  }
  try {
    board._undoMoveset(moveset, parsed.color, parsed);
  } catch (e) {
    // If we can't undo cleanly, abort to avoid leaving the board corrupt.
    return null;
  }
  return tps;
}

/**
 * Pre-check whether applying `plyInput` at the current board state puts
 * the opponent in tak. Used to annotate a new move before the mutation
 * runs, so the tak mark can be included in the same history entry.
 *
 * Returns false if auto-annotation doesn't apply (ply already has tak or
 * tinue, unsupported board size, simulation fails).
 *
 * @param {object} game - Game instance
 * @param {string|Ply} plyInput - ply text or Ply instance
 * @returns {Promise<boolean>}
 */
export async function checkPlyForTak(game, plyInput) {
  if (!game || !plyInput) return false;
  const size = game.config && game.config.size;
  if (![4, 5, 6, 7].includes(size)) return false;

  let plyText;
  if (typeof plyInput === "string") {
    plyText = plyInput;
  } else if (plyInput && typeof plyInput.text === "string") {
    if (
      plyInput.evaluation &&
      (plyInput.evaluation.tak || plyInput.evaluation.tinue)
    ) {
      return false;
    }
    plyText = plyInput.text;
  } else {
    return false;
  }

  if (/['"]/.test(plyText)) return false;

  const tps = simulateTpsAfter(game, plyText);
  if (!tps) return false;

  try {
    const result = await checkPosition(tps, size);
    return !!(result && result.tak);
  } catch (e) {
    return false;
  }
}

export { isReady };
