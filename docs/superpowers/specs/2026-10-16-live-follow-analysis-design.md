# Live-follow analysis for ongoing PlayTak games

## Problem

Analysing a live PlayTak game today takes manual mode juggling:

1. After a disconnect or a browser/engine crash, catching up means switching
   the analysis source to **saved** so Analyze Branch skips positions that
   already have saved results.
2. Once caught up, the user switches to interactive analysis, goes to the last
   move and locks. The engine then starts over on a position the sweep may
   already have searched.
3. A lock that follows the main line moves to each new move immediately. Moves
   played quickly get too little search, so the user runs another branch sweep
   after the game.

## Goals

- One action catches up on an ongoing game and then follows it live.
- Positions reached through that action each get at least the engine's
  configured budget, with no gaps and no post-game sweep.
- After a page refresh with no new moves, the user can lock the last move by
  hand and get the same minimum enforcement as the handoff.
- No new UI controls and no new options. Existing button behaviour is
  unchanged for finished games.

## Non-goals

- Engines that aren't interactive-capable (e.g. topaz-wasm, tiltak-cloud).
  Their sweeps stop at the end of the branch, as they do now.
- Changing manual interactive navigation, or locks on positions other than
  the live frontier.
- Changing behaviour on finished games.

## Behaviour

### Sweep → live-follow handoff

On a game with `config.playtakLive` set, **Analyze Branch** and **Analyze Game**
(from the drawer or the toolbar):

1. **Skip already-analysed positions.** Positions whose saved notes from this
   engine meet the analysis budget are skipped, whatever source is selected
   (today this only happens in saved mode).
2. **Leave out the frontier.** The position after the last synced main-line
   ply is not queued for a fixed-budget search.
3. **Hand off instead of exiting.** When the queue is empty after the usual
   refresh and the engine is interactive-capable, the sweep:

   - ends its game/branch flags;
   - enables interactive mode;
   - locks to the last synced main-line ply with `followsMainline: true`.

   If `playtakLive` is false at that point (the game ended or isn't live), or
   the engine isn't interactive-capable, the sweep exits as it does today.

### Locks that enforce a minimum

Any lock that follows the main line of a live game (`lockedFollowsMainline`
and `config.playtakLive`) treats the engine's `nodes`/`movetime` limits as
**minimums**, judged by the same ≥50% rule as `meetsAnalysisBudget`. This is
the case whether the lock came from the sweep handoff or was set by hand on
the last move. No separate flag is stored.

- **Frontier, nothing queued:** an open-ended search (TEI `go infinite`).
- **A new synced main-line ply arrives:** it is appended to `lockedQueue`.
  - If the current search already meets the minimum, advance now.
  - Otherwise keep searching and advance once it does.
- **Advance:**

  - stop the search;
  - save through the existing per-position autosave path, which respects
    `autoSaveEachPosition`;
  - re-lock to the next queued ply.

  Queued plies are processed in order; none are skipped.

- **Frontier save:** when `autoSaveEachPosition` is on, a frontier search that
  reaches its minimum is also saved once at that point. This protects long
  thinks against crashes. The normal save still happens when it advances.

### Other locks

- **A lock on a non-frontier position** doesn't follow the main line, so it is
  unchanged.
- **On a finished game** (`playtakLive` false), a main-line-following lock
  keeps today's behaviour.
- **Unlocking** clears the queue. It is the way to stop minimum enforcement.

When it reaches the frontier, the lock behaves as described in "Locks that
enforce a minimum".

## Code changes

### `src/bots/bot.js`

- **Lock state.** Add `lockedQueue: []` to the constructor's default state,
  next to the other `locked*` fields. `clearInteractiveLock` resets it. Add a
  getter `enforcesLiveMinimum`: `lockedFollowsMainline && config.playtakLive`.
- **`_analyze`:**
  - On live games, use `getSavedResultFilter(this.label)` as the
    `shouldAnalyzePosition` filter, not only when
    `isSavedSelectedForThisEngine` is true.
  - Leave the frontier `tpsAfter` out of the positions passed to
    `getPositionsToAnalyze`.
  - At the empty-queue exit, perform the handoff described above. Re-check
    `playtakLive` and interactive availability at that moment, not at sweep
    start.
  - The `isInteractiveEnabled` setter resets the lock fields and calls
    `analyzeInteractive()` on the board position straight away. The handoff
    has to set the lock without starting a search on the wrong position first.
    For example, set the lock inside the enable path, or add an enable option
    that takes an initial lock.
- **`unwatchMainline`.** When `enforcesLiveMinimum` is true, append the new ply
  to `lockedQueue` instead of re-locking immediately, then try to advance.
- **Advance decision.** Extract it as a pure helper (e.g.
  `shouldAdvanceLiveLock({ nodes, time, budget, queueLength })`) so it can be
  tested.
- **Progress hook.** Call the helper after each progress update (`nodes`/`time`
  via `setState`). When it returns true, trigger the advance.

### Engine-specific progress and stop

- **TEI (`src/bots/tei.js`):** the advance sends `stop`. The existing
  `bestmove` handler already saves the position and restarts
  `analyzeInteractive()`; it must restart on the new lock target.
- **tiltak-wasm and tinue-solver:** find where each reports intermediate
  progress and how it is stopped. Hook in the same helper. If one of them
  doesn't report intermediate node counts, fall back to elapsed time for that
  engine. Confirm this during planning.

### UI

- **Lock button tooltip** (`src/components/drawers/BotSuggestions.vue`):
  when `lockedQueue` isn't empty, add "N moves queued" to the tooltip. No new
  controls.
- **i18n:** add the new string(s) to `src/i18n/en-us/index.js` in the
  appropriate category, in alphabetical order.

### Docs

Update `src/i18n/en-us/usage.md` with a short "Analysing live games"
subsection. It should cover:

- sweeps on live games skip positions with enough saved analysis;
- the handoff to a locked follow of the last move;
- limits act as minimums, and quick moves are queued;
- locking the last move by hand on a live game (e.g. after a refresh) behaves
  the same way;
- unlocking stops it.

## Edge cases

- **The game ends while moves are queued.** The result ply is queued like any
  other move. When the lock reaches it, `interactiveIsGameEnd` makes analysis
  idle, as it does now. Queued positions before it are still searched.
- **PlayTak disconnects.** `playtakLive` stays set, so the lock remains on the
  frontier with an open-ended search. Queueing resumes when moves arrive.
- **Manual navigation while locked.** It is ignored by the engine, as now. The
  board follows PlayTak's own auto-follow. The existing go-to-locked-ply action
  shows where the engine is.
- **Unlock while queued.** Clears the queue.
- **Engine crash or TEI disconnect.** `terminate()` clears the lock and the
  queue. To recover, run Analyze Branch/Game again; with `autoSaveEachPosition`
  on, it redoes only the missing positions.
- **Speculative spectator moves.** The lock follows synced main-line plies only.
  Speculative moves demoted to branches by `appendPlaytakLivePly` are ignored.
- **Switching games.** The existing `unwatchGame` teardown clears the lock and
  the queue.

## Testing

- **Advance helper:** test `shouldAdvanceLiveLock` across budget types (nodes,
  movetime, both), below and above the 50% threshold, and with an empty or
  non-empty queue. The repo has no unit-test runner, only Playwright under
  `tests/`. Import the helper in a node-side Playwright test if it can be
  imported; otherwise test it in the page.
- **E2E (Playwright, `tests/e2e/`), in the style of `playtak-smash.spec.js`.**
  Load a live game, start a sweep, and simulate bot progress through
  `setState`. Then check that:
  - saved positions are skipped;
  - the handoff locks the last move with `followsMainline` set;
  - plies appended with `APPEND_PLY` + `playtakLive` are queued while under
    budget and advance in order once the budget is met;
  - a manual lock on the last move queues and enforces the minimum the same
    way;
  - unlocking clears the queue.
- **Manual:** run a TEI engine (e.g. Topaz) against a live PlayTak game to
  check the real `stop`/`bestmove` cycle, the crash-recovery flow, and the
  tooltip.
