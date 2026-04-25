/**
 * Lightweight wrapper around the tak-annotator Web Worker.
 * Uses is_tak from the Tiltak wasm binary to annotate positions.
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
 * @param {number} size - Board size (4, 5, 6, or 7)
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
 * Simulate a sequence of plies from the current board state, capturing
 * the resulting TPS after each one. All simulations are undone before
 * this function returns, so the board is left unchanged.
 *
 * Exported so that `game/SIMULATE_TPS_AFTER` can run it inside a Vuex
 * mutation — board._doMoveset can incidentally call dirtyPly /
 * updatePTNOutput (e.g. wallSmash auto-correction), which would trip
 * strict mode if invoked from an async context outside a commit.
 *
 * Returns `null` if the board isn't available, or an array of objects
 * `{ plyText, tpsAfter }` — one entry per successfully-simulated ply.
 * Simulation stops on the first ply that fails to parse/apply, and
 * earlier entries remain in the array.
 */
export function simulateTpsAfterSequence(game, plies) {
  if (!game || !game.board) return null;
  const board = game.board;

  let player = board.turn;
  let number = board.number;
  // Opening swap applies only during move 1 of a standard game. Use
  // isFirstMove (which also considers piece counts for TPS-start games)
  // to decide if we're entering simulation mid-opening.
  let inOpeningSwap = board.isFirstMove && game.openingSwap;

  const appliedSteps = []; // for cleanup in reverse
  const captured = [];

  try {
    for (let i = 0; i < plies.length; i++) {
      const raw = plies[i];
      const plyText =
        typeof raw === "string"
          ? raw
          : raw && typeof raw.text === "string"
          ? raw.text
          : null;
      if (!plyText) break;

      const color = inOpeningSwap ? (player === 1 ? 2 : 1) : player;

      let parsed;
      try {
        parsed = Ply.parse(plyText, {
          id: game.plies.length + i,
          player,
          color,
        });
      } catch (e) {
        break;
      }
      if (!parsed || !parsed.isValid()) break;

      let moveset;
      try {
        moveset = parsed.toMoveset();
      } catch (e) {
        break;
      }
      if (!moveset || !moveset.length || moveset[0].errors) break;

      try {
        board._doMoveset(moveset, parsed.color, parsed);
      } catch (e) {
        break;
      }
      appliedSteps.push({ moveset, color: parsed.color, parsed });

      const nextPlayer = player === 1 ? 2 : 1;
      const nextNumber = player === 2 ? number + 1 : number;
      let tpsAfter;
      try {
        tpsAfter = board.getTPS(nextPlayer, nextNumber);
      } catch (e) {
        break;
      }
      captured.push({ plyText, tpsAfter });

      // Opening ends as soon as we leave move 1.
      if (nextNumber > 1) inOpeningSwap = false;

      player = nextPlayer;
      number = nextNumber;
    }
  } finally {
    for (let i = appliedSteps.length - 1; i >= 0; i--) {
      const step = appliedSteps[i];
      try {
        board._undoMoveset(step.moveset, step.color, step.parsed);
      } catch (e) {
        console.error("Failed to undo simulated moveset", e);
      }
    }
  }

  return captured;
}

// Run the simulation through a Vuex mutation so writes board._doMoveset
// makes (wallSmash auto-correction → dirtyPly / updatePTNOutput) land
// inside a _withCommit context.
function simulateInMutation(plies) {
  const payload = { plies };
  store.commit("game/SIMULATE_TPS_AFTER", payload);
  return payload.captured;
}

/**
 * Pre-check a sequence of plies for tak by simulating them forward from
 * the current board state. Used for bulk insert so marks can be baked
 * into the insertion's single history entry.
 *
 * Returns an array of booleans the same length as `plies`. Entries that
 * failed to simulate, already had eval marks, or came back as non-tak
 * are `false`.
 *
 * @param {object} game
 * @param {Array<string|Ply>} plies
 * @returns {Promise<boolean[]>}
 */
export async function checkPliesForTak(game, plies) {
  const result = new Array(plies.length).fill(false);
  if (!game || !plies.length) return result;
  const size = game.config && game.config.size;
  if (![4, 5, 6, 7].includes(size)) return result;

  const captured = simulateInMutation(plies);
  if (!captured || !captured.length) return result;

  // Fire all checks in parallel; the worker queue serializes dispatch.
  const checks = captured.map(({ plyText, tpsAfter }) => {
    if (/['"]/.test(plyText)) return Promise.resolve(false);
    return checkPosition(tpsAfter, size)
      .then((r) => !!(r && r.tak))
      .catch(() => false);
  });

  const flags = await Promise.all(checks);
  for (let i = 0; i < flags.length; i++) {
    result[i] = flags[i];
  }
  return result;
}

/**
 * Pre-check whether applying `plyInput` at the current board state puts
 * the opponent in tak. Used to annotate a new move before the mutation
 * runs, so the tak mark can be included in the same history entry.
 *
 * Returns false if auto-annotation doesn't apply (ply already has tak or
 * tinue, unsupported board size, simulation fails).
 *
 * When `isAlreadyDone` is true, the ply's moveset has already been
 * applied to the board (interactive stack moves via ix.js do this during
 * the drag). In that case we must NOT re-simulate — doing so would
 * double-apply the moveset and corrupt the board. Instead, read the
 * post-move TPS directly from the live board.
 *
 * @param {object} game - Game instance
 * @param {string|Ply} plyInput - ply text or Ply instance
 * @param {{ isAlreadyDone?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
export async function checkPlyForTak(game, plyInput, options = {}) {
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

  let tpsAfter;
  if (options.isAlreadyDone) {
    // Board is already at the post-move state; derive tpsAfter directly.
    // board.turn/number still reflect the acting player (interactive
    // stack moves don't flip turn/number until _insertPly commits).
    const board = game.board;
    if (!board) return false;
    const nextPlayer = board.turn === 1 ? 2 : 1;
    const nextNumber = board.turn === 2 ? board.number + 1 : board.number;
    try {
      tpsAfter = board.getTPS(nextPlayer, nextNumber);
    } catch (e) {
      return false;
    }
  } else {
    const captured = simulateInMutation([plyText]);
    if (!captured || !captured.length) return false;
    tpsAfter = captured[0].tpsAfter;
  }

  try {
    const result = await checkPosition(tpsAfter, size);
    return !!(result && result.tak);
  } catch (e) {
    return false;
  }
}

export { isReady };
