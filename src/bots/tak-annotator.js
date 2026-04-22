/**
 * Lightweight wrapper around the tak-annotator Web Worker.
 * Uses is_tak / is_tinue from the Tiltak wasm binary to annotate positions.
 */

import store from "../store";

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

export { isReady };
