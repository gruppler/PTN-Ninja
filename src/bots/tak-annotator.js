/**
 * Lightweight wrapper around the tak-annotator Web Worker.
 *
 * Every size goes through this worker's tiltak `is_tak`, never the Tinuë
 * Solver. The solver answers the same question at a comparable speed, but
 * it is one worker thread serving the engine drawer as well, and a deep
 * search there holds it for the whole search — its wasm loop is fully
 * synchronous, so a queued 1-ply query cannot be serviced until the search
 * ends. Annotation is on the critical path of every insert, including live
 * PlayTak moves, so it gets a thread that nothing else can occupy.
 *
 * `is_tak` is also the cheaper resident: a single wasm call with no
 * transposition table, against the solver's 64 MB.
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

/**
 * Spawn the worker so its wasm is loaded before the first check needs it.
 *
 * Worth doing whenever auto-annotation is on: the first check otherwise
 * pays the whole init, and with a deadline on the pre-check that means the
 * first ply of a session can go unmarked. Idempotent.
 */
export function preload() {
  ensureWorker();
}

// A pre-check sits on the critical path of an insert: the ply cannot be
// committed until it answers, and for a live PlayTak move that means the
// whole follow queue waits behind it (flushPlaytakFollowQueue awaits each
// APPEND_PLY while holding its `flushing` mutex, and nothing else re-drives
// the queue). Waiting is fine — it is what keeps the mark in the same
// history entry as the insert — but only for a check that is going to
// answer.
//
// Owning the worker outright is what makes that true in the normal case;
// this is the failsafe for the rest: a worker that died, or one whose wasm
// is still initializing. It sits far above a real check (~344 µs) and well
// below the point where a spectator would read the board as stuck. The ply
// is inserted unmarked when it lapses.
const PRE_CHECK_TIMEOUT_MS = 500;

function withPreCheckDeadline(promise) {
  return Promise.race([
    promise,
    new Promise((resolve) =>
      setTimeout(() => resolve(null), PRE_CHECK_TIMEOUT_MS)
    ),
  ]);
}

let annotationCancelToken = null;

// Query `plies` one at a time and commit the verdict for exactly those.
//
// `cancelToken` is optional: a whole-game sweep passes one so a newer sweep
// can supersede it, while a targeted run has nothing worth superseding and
// nothing to supersede. The two can safely overlap because the commit only
// touches the plies it names — see SET_TAK_ANNOTATIONS.
async function annotateTakMarks(game, plies, cancelToken, onProgress) {
  const size = game.config && game.config.size;
  const total = plies.length;
  let done = 0;
  const plyIDs = new Set();
  const takPlyIDs = new Set();

  for (const ply of plies) {
    if (cancelToken && cancelToken.cancelled) break;

    let result;
    try {
      result = await checkPosition(ply.tpsAfter, size);
    } catch (e) {
      done++;
      onProgress?.({ done, total });
      continue;
    }

    if (cancelToken && cancelToken.cancelled) break;

    plyIDs.add(ply.id);
    if (result.tak) {
      takPlyIDs.add(ply.id);
    }

    done++;
    onProgress?.({ done, total });
  }

  if (cancelToken && cancelToken.cancelled) {
    return;
  }

  store.commit("game/SET_TAK_ANNOTATIONS", { plyIDs, takPlyIDs });
}

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

  const plies = game.plies.filter((ply) => ply && ply.tpsAfter);
  await annotateTakMarks(game, plies, cancelToken, onProgress);

  if (cancelToken === annotationCancelToken) {
    annotationCancelToken = null;
  }
}

/**
 * Mark just `plies` — the ones a caller has newly added — and leave every
 * other ply's mark alone.
 *
 * Appending a few live moves does not warrant re-querying the solver once
 * per ply already in the game, which is what annotateGame costs. It sweeps
 * everything because it has to establish the full picture the mark set
 * describes; a caller that knows exactly which plies are new does not.
 *
 * Deliberately outside the cancel token. A whole-game sweep and a targeted
 * run examine disjoint plies here (the sweep predates the appended ones),
 * so neither should cancel the other — cancelling the sweep would leave
 * the game's existing plies unmarked.
 *
 * @param {object} game
 * @param {Array<object>} plies - Ply instances to check
 * @returns {Promise<void>}
 */
export async function annotatePlies(game, plies) {
  if (!game || !plies || !plies.length) return;
  const size = game.config && game.config.size;
  if (![4, 5, 6, 7].includes(size)) return;

  ensureWorker();

  const checkable = plies.filter((ply) => ply && ply.tpsAfter);
  if (!checkable.length) return;

  await annotateTakMarks(game, checkable, null);
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

  const flags = await withPreCheckDeadline(Promise.all(checks));
  if (!flags) return result;
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
    const result = await withPreCheckDeadline(checkPosition(tpsAfter, size));
    return !!(result && result.tak);
  } catch (e) {
    return false;
  }
}

/**
 * Pre-check whether `plyInput` puts the opponent in tak when appended at
 * the APPEND_PLY anchor — the playtak synced frontier when `liveSync` is
 * present, otherwise the end of the main branch. Independent of the
 * user's current board position, so the tak mark can be baked into the
 * same APPEND_PLY mutation that inserts the ply regardless of whether
 * the caller is local/embed or playtak live sync.
 *
 * @param {object} game
 * @param {string|Ply} plyInput
 * @param {{ playtakID?: string, syncedMainlineCount?: number } | null} [liveSync]
 * @returns {Promise<boolean>}
 */
export async function checkAppendPlyForTak(game, plyInput, liveSync = null) {
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

  const payload = { plyText, liveSync };
  store.commit("game/SIMULATE_APPEND_TPS_AFTER", payload);
  const captured = payload.captured;
  if (!captured || !captured.length) return false;

  try {
    const result = await withPreCheckDeadline(
      checkPosition(captured[0].tpsAfter, size)
    );
    return !!(result && result.tak);
  } catch (e) {
    return false;
  }
}

export { isReady };
