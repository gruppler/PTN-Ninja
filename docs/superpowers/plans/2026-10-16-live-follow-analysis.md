# Live-Follow Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a live PlayTak game, a branch/game sweep catches up and hands off
to a locked interactive analysis of the last move. A lock that follows a live
main line treats engine limits as minimums: new moves are queued and worked
through in order.

**Architecture:** Main-line/queue logic goes in a small pure module,
`src/bots/liveFollow.js`. The `Bot` base class (`src/bots/bot.js`) gets:

- a `lockedQueue` state field and an `enforcesLiveMinimum` getter;
- a `tryAdvanceLiveLock()` method, called from three places: result storage
  (`setPosition`), the engine going idle (`setState`), and the main-line
  watcher;
- a sweep handoff at the end of `_analyze`.

TEI's existing stop → `bestmove` → save → restart cycle does the actual
switch, so no engine-specific code is needed.

**Tech Stack:** Vue 2, Vuex 3, Quasar 1, vue-i18n 8, Playwright e2e tests
(`tests/`, run against the dev server on `http://localhost:8081`).

**Spec:** `docs/superpowers/specs/2026-10-16-live-follow-analysis-design.md`

## Global Constraints

- **Vuex only.** Never attach Vue listeners to a Game object directly, and
  never mutate a game directly. Read through Vuex and change things through
  Vuex actions/mutations (CLAUDE.md).
- **i18n:** new strings go in the appropriate category, in alphabetical order.
- **Formatting:** run `npx prettier --write <files>` on every file you modify,
  before committing.
- **Commits:** no `Co-Authored-By` trailer.
- **Bot state is mirrored into Vuex** via `SET_BOT_STATE`, which uses
  `Object.assign`. Always set `lockedQueue` to a **new array**; never mutate
  it in place.
- **Engine scope:** only interactive-capable engines (`meta.isInteractive`)
  hand off. Other engines' sweeps end exactly as they do today.
- **"Meets minimum"** means `meetsAnalysisBudget(result)`: at least 50% of the
  configured `nodes`/`movetime`.
- **Autosave:** respect `autoSaveEachPosition`; there is no new option.

## Review Focus

1. **Several plies arrive in one burst** (`APPEND_PLIES` on reconnect). The
   watcher only sees the final ID, so every main-line ply in between must be
   queued, in order. Test: Task 2, "burst append queues every ply".
2. **The game ends while plies are queued** (`playtakLive` goes false).
   Queued plies must still be worked through rather than dropped or jumped
   over. Test: Task 2, "queue drains after the game stops being live".
3. **The engine stops on its own** (e.g. tinue-solver finishes, or TEI
   reports a mate) below the minimum while plies are queued. The lock must
   advance instead of waiting forever. Test: Task 2, "idle engine advances
   without meeting the minimum".
4. **Pressing Analyze Branch after a refresh when everything is saved.** It
   must go straight to live follow, not show the "fully analysed" warning.
   Test: Task 3, "fully analysed live game hands off immediately".
5. **TEI's bestmove hand-over between positions.** `isRunning` goes false
   while `state.tps` moves to the new target. That must not count as idle, or
   the lock would skip a queued ply. Test: Task 2, "transitional stop is not
   idle".

---

## File Structure

| File                                        | Change | Responsibility                                                           |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `src/bots/liveFollow.js`                    | Create | Pure helpers: synced main-line IDs, plies to queue, the advance decision |
| `src/bots/bot.js`                           | Modify | Lock queue state, minimum enforcement, sweep handoff, enable-with-lock   |
| `src/components/drawers/BotSuggestions.vue` | Modify | Queued-move count in the lock button tooltip                             |
| `src/i18n/en-us/index.js`                   | Modify | `n_queuedMoves` plural string                                            |
| `src/i18n/en-us/usage.md`                   | Modify | Live-game analysis docs                                                  |
| `tests/e2e/live-follow-analysis.spec.js`    | Create | E2E coverage for all of the above                                        |

---

### Task 1: Shared main-line helpers

Extract the duplicated "last synced main-line ply" logic (`getLastMainlinePly`
and the `unwatchMainline` getter) into a pure module. Behaviour stays the
same; Tasks 2–3 build on these helpers.

**Files:**

- Create: `src/bots/liveFollow.js`
- Modify: `src/bots/bot.js` (`getLastMainlinePly`, around lines 633–658; the
  `unwatchMainline` getter function, around lines 1090–1111)
- Test: `tests/e2e/live-follow-analysis.spec.js`

**Interfaces:**

- Produces:

  - `getSyncedMainlinePlyIDs(plies: Array, config: Object|null): number[] | null`
    — the main-line ply IDs in order, capped at `config.playtakSyncedMainline`
    when `config.playtakLive` is set. Returns `null` if there are no plies, or
    if the main line is shorter than the cap.
  - `getPlyIDsToQueue(mainlineIDs: number[], anchorID: number|null, endID: number): number[]`
    — the IDs after `anchorID`, up to and including `endID`. Returns `[endID]`
    if `anchorID` isn't on the main line, and `[]` if `endID` isn't.
  - `shouldAdvanceLiveLock({ queueLength: number, engineIdle: boolean, meetsMinimum: boolean }): boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/live-follow-analysis.spec.js`:

```js
// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Live-follow analysis for ongoing PlayTak games.
 *
 * Spec: docs/superpowers/specs/2026-10-16-live-follow-analysis-design.md
 *
 * Engines are never actually run: the tiltak bot's search entry points are
 * stubbed on the instance, and search progress is simulated with setPosition
 * and setState. What's under test is the bot's scheduling, not an engine.
 */

const PLAYTAK_ID = "999999";

// 8 synced main-line plies.
const LIVE_PTN = `[Size "6"]
[Opening "swap"]

1. a1 f6
2. b1 f5
3. c1 e5
4. d1 d5
`;

async function loadLiveGame(page, { synced = 8 } = {}) {
  await page.evaluate(
    async ({ ptn, playtakID, synced }) => {
      await window.app.$store.dispatch("game/ADD_GAME", {
        ptn,
        name: "Live Follow Test",
        config: {
          playtakID,
          playtakLive: true,
          playtakSyncedMainline: synced,
        },
      });
    },
    { ptn: LIVE_PTN, playtakID: PLAYTAK_ID, synced }
  );
  await page.waitForFunction(
    () => {
      const game = window.app && window.app.$game;
      return game && game.plies && game.plies.length >= 8;
    },
    { timeout: 10000 }
  );
}

/** Append a real (synced) PlayTak move. */
async function appendLive(page, ply) {
  await page.evaluate(
    async ({ ply, playtakID }) => {
      const store = window.app.$store;
      const before = store.state.game.config.playtakSyncedMainline;
      await store.dispatch("game/APPEND_PLY", {
        ply,
        playtakLive: { playtakID, syncedMainlineCount: before },
      });
    },
    { ply, playtakID: PLAYTAK_ID }
  );
}

/**
 * Select the tiltak bot with a 1000-node budget and stub its search entry
 * points. Records interactive starts in window.__interactive (locked ply IDs)
 * and sweep searches in window.__swept (TPS strings).
 *
 * `bot.settings` is a store-bound getter, so the budget has to be set through
 * analysis/SET (see analysis-skip.spec.js).
 */
async function setUpBot(page) {
  await page.evaluate(async () => {
    const store = window.app.$store;
    store.commit("analysis/SET", ["botID", "tiltak"]);
    const all = store.state.analysis.botSettings;
    await store.dispatch("analysis/SET", [
      "botSettings",
      {
        ...all,
        tiltak: { ...all.tiltak, limitTypes: ["nodes"], nodes: 1000 },
      },
    ]);
    const bot = store.getters["analysis/bot"];
    window.__bot = bot;
    window.__interactive = [];
    window.__swept = [];
    bot.analyzeInteractive = function () {
      window.__interactive.push(this.state.lockedPlyID);
      this.setState({
        isRunning: true,
        tps: this.interactiveTPS,
        nextTPS: this.interactiveTPS,
      });
    };
    bot.searchPosition = async function (size, halfKomi, tps) {
      window.__swept.push(tps);
      return null;
    };
  });
}

test.describe("Live-follow analysis", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });
    await loadLiveGame(page);
    await setUpBot(page);
  });

  test("last synced main-line ply respects the PlayTak cap", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const store = window.app.$store;
      const bot = window.__bot;
      const plies = window.app.$game.plies;
      const atCap = bot.getLastMainlinePly();
      // Pretend only 6 moves are synced: the cap moves back.
      store.commit("game/SET_CONFIG", ["playtakSyncedMainline", 6]);
      const capped = bot.getLastMainlinePly();
      // Pretend 9 are synced but only 8 exist: nothing is safe to follow.
      store.commit("game/SET_CONFIG", ["playtakSyncedMainline", 9]);
      const short = bot.getLastMainlinePly();
      return {
        atCap: atCap && atCap.id,
        capped: capped && capped.id,
        short,
        lastID: plies[7].id,
        sixthID: plies[5].id,
      };
    });
    expect(result.atCap).toBe(result.lastID);
    expect(result.capped).toBe(result.sixthID);
    expect(result.short).toBeNull();
  });
});
```

Before running, check that a config-setting mutation with this name exists:
`grep -n "export const SET_CONFIG\|SET_CONFIG\b" src/store/game/mutations.js`.
If it doesn't, find the mutation that sets a single `config` key (`grep -n "config\[" src/store/game/mutations.js`)
and use that in the test. Don't assign to `config` directly.

- [ ] **Step 2: Run the test to make sure it passes on today's code (a characterisation test)**

This test pins current behaviour before the refactor.

Run: `cd tests && npx playwright test e2e/live-follow-analysis.spec.js --reporter=line`
Expected: PASS. If Playwright reports a missing browser, run
`npm run test:install` from the repo root once, then re-run.

- [ ] **Step 3: Create the helper module**

Create `src/bots/liveFollow.js`:

```js
// Pure helpers for following the main line of a live game. Kept free of
// store and bot references so the rules live in one place and the bot,
// its store watcher and the sweep all agree on what "the live frontier" is.

// Main-line ply IDs in order. For live PlayTak games the main line is
// capped to the server-synced count, so speculative spectator moves at the
// tip are never treated as a player's move. Returns null when there is
// nothing to follow: no plies, or fewer main-line plies than the cap.
export function getSyncedMainlinePlyIDs(plies, config) {
  if (!plies || !plies.length) return null;
  const syncedCap =
    config && config.playtakLive
      ? Math.max(0, parseInt(config.playtakSyncedMainline, 10) || 0)
      : Infinity;
  const ids = [];
  for (let i = 0; i < plies.length; i++) {
    const p = plies[i];
    if (p && !p.branch && p.text !== "--") {
      ids.push(p.id);
      if (ids.length >= syncedCap) break;
    }
  }
  if (syncedCap !== Infinity && ids.length < syncedCap) return null;
  return ids;
}

// The main-line plies a following lock still has to visit: everything after
// `anchorID` up to and including `endID`. One watcher callback can cover
// several plies (a reconnect burst), so this fills the gap rather than
// trusting that plies arrive one at a time.
export function getPlyIDsToQueue(mainlineIDs, anchorID, endID) {
  const endIndex = mainlineIDs.indexOf(endID);
  if (endIndex < 0) return [];
  const anchorIndex = anchorID == null ? -1 : mainlineIDs.indexOf(anchorID);
  if (anchorIndex < 0) return [endID];
  return mainlineIDs.slice(anchorIndex + 1, endIndex + 1);
}

// A following lock moves on when something is waiting and the current
// position is done with: it has had its minimum search, or the engine has
// stopped on its own and nothing more is coming for it.
export function shouldAdvanceLiveLock({
  queueLength,
  engineIdle,
  meetsMinimum,
}) {
  return queueLength > 0 && (engineIdle || meetsMinimum);
}
```

- [ ] **Step 4: Use the helper in `getLastMainlinePly`**

In `src/bots/bot.js`, add near the other bot imports at the top of the file:

```js
import { getSyncedMainlinePlyIDs } from "./liveFollow";
```

Replace the body of `getLastMainlinePly()` (from
`const plies = this.game.ptn && this.game.ptn.allPlies;` through
`return lastSynced;`) with:

```js
  getLastMainlinePly() {
    const plies = this.game.ptn && this.game.ptn.allPlies;
    const config = store.state.game && store.state.game.config;
    const ids = getSyncedMainlinePlyIDs(plies, config);
    if (!ids || !ids.length) return null;
    return plies[ids[ids.length - 1]] || null;
  }
```

`allPlies` is indexed by ply ID; the existing `interactivePly` getter already
relies on `this.game.ptn.allPlies[plyID]`.

- [ ] **Step 5: Use the helper in the `unwatchMainline` getter**

In the `isInteractiveEnabled` setter, replace the first argument of
`this.unwatchMainline = store.watch(` (the `(state) => { ... return lastSyncedID; }`
function) with:

```js
        (state) => {
          const ids = getSyncedMainlinePlyIDs(
            state.game.ptn && state.game.ptn.allPlies,
            state.game.config
          );
          return ids && ids.length ? ids[ids.length - 1] : null;
        },
```

Leave the callback (second argument) unchanged in this task.

- [ ] **Step 6: Run the test again**

Run: `cd tests && npx playwright test e2e/live-follow-analysis.spec.js e2e/playtak-live-append.spec.js --reporter=line`
Expected: all PASS.

- [ ] **Step 7: Format and commit**

```bash
npx prettier --write src/bots/liveFollow.js src/bots/bot.js tests/e2e/live-follow-analysis.spec.js
git add src/bots/liveFollow.js src/bots/bot.js tests/e2e/live-follow-analysis.spec.js
git commit -m "Extract synced main-line helpers for live-follow analysis"
```

---

### Task 2: Locks that enforce a minimum on live games

**Files:**

- Modify: `src/bots/bot.js`:
  - the constructor's default state (around line 196);
  - `setState` (around line 266);
  - `setPosition` (around line 315);
  - the lock helpers (`setInteractiveLock` / `clearInteractiveLock`, around
    lines 667–701);
  - the enable `setState` in the `isInteractiveEnabled` setter;
  - the `unwatchMainline` callback.
- Test: `tests/e2e/live-follow-analysis.spec.js`

**Interfaces:**

- Consumes: `getSyncedMainlinePlyIDs`, `getPlyIDsToQueue`,
  `shouldAdvanceLiveLock` from Task 1.
- Produces:

  - bot state `lockedQueue: number[]` (ply IDs, default `[]`);
  - getter `enforcesLiveMinimum: boolean`;
  - `enqueueLiveLockPlies(endID: number): void`;
  - `tryAdvanceLiveLock(): boolean`;
  - `maybeSaveLiveFrontier(tps: string): void`.

- [ ] **Step 1: Write the failing tests**

Add these tests inside the `describe` block in
`tests/e2e/live-follow-analysis.spec.js`. Add the `lockFrontier` helper above
the `describe`:

```js
/** Enable interactive mode and lock on the last synced move, as a user would. */
async function lockFrontier(page) {
  await page.evaluate(async () => {
    const bot = window.__bot;
    const game = window.app.$game;
    await window.app.$store.dispatch("game/GO_TO_PLY", {
      plyID: game.plies[game.plies.length - 1].id,
      isDone: true,
    });
    bot.isInteractiveEnabled = true;
    bot.toggleInteractiveLock(true);
  });
}

/** Simulate a search result on the locked position. */
async function reportNodes(page, nodes) {
  await page.evaluate((nodes) => {
    const bot = window.__bot;
    bot.setPosition(bot.state.lockedTPS, [{ nodes, time: 10, pv: [] }]);
  }, nodes);
}

const lockState = (page) =>
  page.evaluate(() => {
    const s = window.__bot.state;
    const plies = window.app.$game.plies;
    return {
      lockedPlyID: s.lockedPlyID,
      queue: [...s.lockedQueue],
      lastID: plies[plies.length - 1].id,
      ids: plies.map((p) => p.id),
    };
  });
```

Tests:

```js
test("manual lock on a live frontier queues new moves until the minimum is met", async ({
  page,
}) => {
  await lockFrontier(page);
  await reportNodes(page, 100); // below the 500-node minimum
  await appendLive(page, "e1");

  let s = await lockState(page);
  expect(s.lockedPlyID).toBe(s.ids[7]); // still on the old frontier
  expect(s.queue).toEqual([s.lastID]);

  await reportNodes(page, 600); // minimum met
  s = await lockState(page);
  expect(s.lockedPlyID).toBe(s.lastID);
  expect(s.queue).toEqual([]);
});

test("burst append queues every ply in order", async ({ page }) => {
  await lockFrontier(page);
  await reportNodes(page, 100);
  await appendLive(page, "e1");
  await appendLive(page, "e6");
  await appendLive(page, "f1");

  let s = await lockState(page);
  expect(s.queue).toEqual(s.ids.slice(8, 11));

  await reportNodes(page, 600);
  s = await lockState(page);
  expect(s.lockedPlyID).toBe(s.ids[8]);
  expect(s.queue).toEqual(s.ids.slice(9, 11));
});

test("transitional stop is not idle", async ({ page }) => {
  await lockFrontier(page);
  await reportNodes(page, 100);
  await appendLive(page, "e1");
  // TEI's bestmove hand-over: not running, but tps has moved to a queued
  // target, so nextTPS is still set.
  await page.evaluate(() => {
    const bot = window.__bot;
    bot.setState({ isRunning: false, tps: "x", nextTPS: "x" });
  });
  const s = await lockState(page);
  expect(s.lockedPlyID).toBe(s.ids[7]);
});

test("idle engine advances without meeting the minimum", async ({ page }) => {
  await lockFrontier(page);
  await reportNodes(page, 100);
  await appendLive(page, "e1");
  // Engine finished on its own: TEI clears both tps and nextTPS.
  await page.evaluate(() => {
    window.__bot.setState({ isRunning: false, tps: null, nextTPS: null });
  });
  const s = await lockState(page);
  expect(s.lockedPlyID).toBe(s.lastID);
});

test("queue drains after the game stops being live", async ({ page }) => {
  await lockFrontier(page);
  await reportNodes(page, 100);
  await appendLive(page, "e1");
  await page.evaluate(() =>
    window.app.$store.commit("game/MARK_PLAYTAK_ENDED")
  );
  let s = await lockState(page);
  expect(s.queue).toEqual([s.lastID]);
  await reportNodes(page, 600);
  s = await lockState(page);
  expect(s.lockedPlyID).toBe(s.lastID);
});

test("lock on a finished game jumps immediately", async ({ page }) => {
  await page.evaluate(() =>
    window.app.$store.commit("game/MARK_PLAYTAK_ENDED")
  );
  await lockFrontier(page);
  await reportNodes(page, 100);
  await page.evaluate(() =>
    window.app.$store.dispatch("game/APPEND_PLY", "e1")
  );
  const s = await lockState(page);
  expect(s.lockedPlyID).toBe(s.lastID);
  expect(s.queue).toEqual([]);
});

test("unlocking clears the queue", async ({ page }) => {
  await lockFrontier(page);
  await reportNodes(page, 100);
  await appendLive(page, "e1");
  await page.evaluate(() => window.__bot.toggleInteractiveLock(false));
  const s = await lockState(page);
  expect(s.queue).toEqual([]);
  expect(s.lockedPlyID).toBeNull();
});

test("frontier result is saved once it meets the minimum", async ({ page }) => {
  await page.evaluate(() =>
    window.app.$store.dispatch("analysis/SET", ["autoSaveEachPosition", true])
  );
  await page.evaluate(() => {
    const bot = window.__bot;
    window.__saved = [];
    bot.saveEvalComments = (tps) => window.__saved.push(tps);
  });
  await lockFrontier(page);
  await reportNodes(page, 100);
  expect(await page.evaluate(() => window.__saved.length)).toBe(0);
  await reportNodes(page, 600);
  await reportNodes(page, 700);
  expect(await page.evaluate(() => window.__saved.length)).toBe(1);
});
```

If rendering code throws on the minimal `{ nodes, time, pv: [] }` results
that `reportNodes` stores (check the browser console with `--headed`), add
the fields it needs to `reportNodes` (e.g. `depth: 1, evaluation: 0`). Don't
change app code to accommodate the stub.

In "lock on a finished game", `MARK_PLAYTAK_ENDED` clears `playtakLive`.
The plain-string `APPEND_PLY` is the legacy non-live payload (see
`src/store/game/actions.js:1579`).

- [ ] **Step 2: Run the tests to make sure they fail**

Run: `cd tests && npx playwright test e2e/live-follow-analysis.spec.js --reporter=line`
Expected: the new tests FAIL. `lockedQueue` is undefined, so
`[...s.lockedQueue]` throws, and the lock jumps immediately. The Task 1 test
still passes.

- [ ] **Step 3: Add the state field and getter**

In the `Bot` constructor's default state, after `lockedFollowsMainline: false,`, add:

```js
      lockedQueue: [],
```

Extend the import added in Task 1:

```js
import {
  getPlyIDsToQueue,
  getSyncedMainlinePlyIDs,
  shouldAdvanceLiveLock,
} from "./liveFollow";
```

Directly after `isLatestMainlinePosition(...) { ... }`, add:

```js
  // A lock that follows the main line of a live game treats the engine's
  // limits as minimums: new moves queue until the current position has had
  // its search. Plies still queued when the game stops being live are
  // worked through the same way, so the last moves of a game aren't skipped.
  get enforcesLiveMinimum() {
    if (!this.state.lockedTPS || !this.state.lockedFollowsMainline) {
      return false;
    }
    const config = store.state.game && store.state.game.config;
    return !!(config && config.playtakLive) || this.state.lockedQueue.length > 0;
  }
```

- [ ] **Step 4: Reset the queue wherever the lock is reset**

In `clearInteractiveLock()`, add `this.state.lockedQueue.length === 0 &&` to
the early-return condition, and `lockedQueue: [],` to its `setState`:

```js
  clearInteractiveLock() {
    if (
      !this.state.lockedTPS &&
      this.state.lockedPlyID == null &&
      !this.state.lockedPlyIsDone &&
      !this.state.lockedFollowsMainline &&
      this.state.lockedQueue.length === 0
    ) {
      return;
    }
    this._liveMinimumSavedTPS = null;
    this.setState({
      lockedTPS: null,
      lockedPlyID: null,
      lockedPlyIsDone: false,
      lockedFollowsMainline: false,
      lockedQueue: [],
    });
  }
```

Also add `lockedQueue: [],` after `lockedFollowsMainline: false,` in:

- the enable-branch `setState` of the `isInteractiveEnabled` setter;
- the other `setState` that resets the `locked*` fields, around line 780
  (just above `//#region terminate`). Find it with
  `grep -n "lockedFollowsMainline: false," src/bots/bot.js`.

- [ ] **Step 5: Add queueing, advancing and the frontier save**

Directly after `toggleInteractiveLock(locked) { ... }`, add:

```js
  // Queue every synced main-line ply after the last one already queued (or
  // the locked ply) up to `endID`. A reconnect burst can append several
  // plies in a single watcher callback.
  enqueueLiveLockPlies(endID) {
    const queue = this.state.lockedQueue;
    const ids = getSyncedMainlinePlyIDs(
      this.game.ptn && this.game.ptn.allPlies,
      store.state.game && store.state.game.config
    );
    if (!ids) return;
    const anchorID = queue.length
      ? queue[queue.length - 1]
      : this.state.lockedPlyID;
    const next = getPlyIDsToQueue(ids, anchorID, endID).filter(
      (id) => !queue.includes(id)
    );
    if (next.length) {
      this.setState({ lockedQueue: [...queue, ...next] });
    }
  }

  // Move a live-following lock on to the next queued ply once the current
  // position is done with. Called whenever that might have changed: a new
  // result, the engine going idle, or a new ply arriving.
  tryAdvanceLiveLock() {
    if (this._advancingLiveLock || !this.enforcesLiveMinimum) return false;
    const queue = this.state.lockedQueue;
    const result =
      (this.positions[this.state.lockedTPS] &&
        this.positions[this.state.lockedTPS][0]) ||
      null;
    // TEI reports a finished search by clearing both tps and nextTPS. While
    // it hands over to a new target, nextTPS is still set, so that doesn't
    // count as idle.
    const engineIdle = !this.state.isRunning && !this.state.nextTPS;
    if (
      !shouldAdvanceLiveLock({
        queueLength: queue.length,
        engineIdle,
        meetsMinimum: this.meetsAnalysisBudget(result),
      })
    ) {
      return false;
    }
    this._advancingLiveLock = true;
    try {
      const [nextID, ...rest] = queue;
      const nextPly = this.game.ptn.allPlies[nextID];
      if (!nextPly) {
        this.setState({ lockedQueue: rest });
        return false;
      }
      this._liveMinimumSavedTPS = null;
      this.setInteractiveLock({
        tps: nextPly.tpsAfter,
        plyID: nextPly.id,
        plyIsDone: true,
        followsMainline: true,
      });
      this.setState({ lockedQueue: rest });
      if (!store.state.ui.scrubbing) {
        this.analyzeInteractive();
      }
      return true;
    } finally {
      this._advancingLiveLock = false;
    }
  }

  // Save the live frontier once when it first reaches its minimum, so a long
  // think isn't lost to a crash. Calls saveEvalComments directly: going
  // through autoSaveEvalComments would mark this search as saved, and the
  // deeper save when the lock moves on would then be skipped.
  maybeSaveLiveFrontier(tps) {
    if (!this.enforcesLiveMinimum || tps !== this.state.lockedTPS) return;
    if (this.state.lockedQueue.length) return;
    if (this._liveMinimumSavedTPS === tps) return;
    const analysis = store.state.analysis;
    if (!analysis || !analysis.autoSaveEachPosition) return;
    const result = (this.positions[tps] && this.positions[tps][0]) || null;
    if (!this.meetsAnalysisBudget(result)) return;
    this._liveMinimumSavedTPS = tps;
    this.saveEvalComments(tps, { immediateSave: false });
  }
```

- [ ] **Step 6: Hook the result and idle triggers**

In `setPosition(tps, suggestions)`, after the existing `if/else`, add:

```js
if (tps === this.state.lockedTPS) {
  this.maybeSaveLiveFrontier(tps);
  this.tryAdvanceLiveLock();
}
```

In `setState(state)`, after the final `if (store.state.analysis) { ... } else { ... }` block, add:

```js
if (state.isRunning === false && this.state.lockedQueue.length) {
  this.tryAdvanceLiveLock();
}
```

- [ ] **Step 7: Queue in the main-line watcher**

In the `unwatchMainline` callback, after the
`if (!this.state.lockedTPS || !this.state.lockedFollowsMainline) { return; }`
guard, add:

```js
if (this.enforcesLiveMinimum) {
  this.enqueueLiveLockPlies(newLastID);
  this.tryAdvanceLiveLock();
  return;
}
```

The existing immediate re-lock stays below it for finished games.

- [ ] **Step 8: Check how the non-TEI interactive engine ends a search**

tiltak-wasm extends `TeiBot`, so it's covered. `TinueSolverBot` extends `Bot`
directly. Run:

```bash
grep -n "onSearchEnd\|isRunning: false\|nextTPS" src/bots/tinue-solver.js
```

When a tinue-solver interactive search finishes, `isRunning` must become
false **and** `nextTPS` must be falsy; otherwise the idle path never fires and
the queue stalls. If `nextTPS` stays set after a finished search, add
`nextTPS: null` to the state passed to the `onSearchEnd`/`setState` call that
ends an interactive search in `tinue-solver.js`. Then add a test like "idle
engine advances without meeting the minimum" that selects `"tinue-solver"`
instead of `"tiltak"`. If the grep shows the end state is already right, note
that in the commit message and add no test.

- [ ] **Step 9: Run the tests**

Run: `cd tests && npx playwright test e2e/live-follow-analysis.spec.js e2e/playtak-live-append.spec.js --reporter=line`
Expected: all PASS.

- [ ] **Step 10: Format and commit**

```bash
npx prettier --write src/bots/bot.js src/bots/tinue-solver.js tests/e2e/live-follow-analysis.spec.js
git add src/bots/bot.js src/bots/tinue-solver.js tests/e2e/live-follow-analysis.spec.js
git commit -m "Enforce minimum search on locks that follow a live game"
```

---

### Task 3: Sweep handoff to live follow

**Files:**

- Modify: `src/bots/bot.js` (the `isInteractiveEnabled` setter; `_analyze`)
- Test: `tests/e2e/live-follow-analysis.spec.js`

**Interfaces:**

- Consumes: `getLastMainlinePly()`, `enforcesLiveMinimum` and the lock queue
  from Tasks 1–2.
- Produces:

  - `setInteractiveEnabled(isInteractiveEnabled: boolean, { lock?: { tps, plyID, plyIsDone, followsMainline } } = {}): void`
    (the setter delegates to it);
  - `getLiveFollowTarget(): Ply|null`;
  - `isLiveFrontierTPS(tps: string): boolean`.

- [ ] **Step 1: Write the failing tests**

Add inside the `describe` block:

```js
test("sweep on a live game skips the frontier and hands off to a lock", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const bot = window.__bot;
    const plies = window.app.$game.plies;
    await bot.analyzeBranch();
    return {
      swept: window.__swept,
      frontierTPS: plies[plies.length - 1].tpsAfter,
      lastID: plies[plies.length - 1].id,
      state: {
        isInteractiveEnabled: bot.state.isInteractiveEnabled,
        isAnalyzingBranch: bot.state.isAnalyzingBranch,
        lockedPlyID: bot.state.lockedPlyID,
        lockedFollowsMainline: bot.state.lockedFollowsMainline,
      },
      interactive: window.__interactive,
    };
  });
  expect(result.swept).not.toContain(result.frontierTPS);
  expect(result.swept.length).toBeGreaterThan(0);
  expect(result.state.isAnalyzingBranch).toBe(false);
  expect(result.state.isInteractiveEnabled).toBe(true);
  expect(result.state.lockedPlyID).toBe(result.lastID);
  expect(result.state.lockedFollowsMainline).toBe(true);
  // The first interactive search starts on the locked frontier.
  expect(result.interactive[0]).toBe(result.lastID);
});

test("sweep on a live game skips positions with enough saved analysis", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const bot = window.__bot;
    const plies = window.app.$game.plies;
    const savedTPS = plies[3].tpsAfter;
    // Make the saved-results lookup report a deep note for one position.
    // The sweep must ask for this engine's own label, whatever source is
    // selected.
    bot.getSavedResultFilter =
      (name) =>
      ({ tps }) =>
        !(name === bot.label && tps === savedTPS);
    await bot.analyzeBranch();
    return { swept: window.__swept, savedTPS };
  });
  expect(result.swept).not.toContain(result.savedTPS);
});

test("fully analysed live game hands off immediately", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const bot = window.__bot;
    const plies = window.app.$game.plies;
    bot.getSavedResultFilter = () => () => false; // everything saved
    window.__warnings = [];
    bot.onWarning = (w) => window.__warnings.push(w);
    await bot.analyzeBranch();
    return {
      warnings: window.__warnings,
      swept: window.__swept,
      lockedPlyID: bot.state.lockedPlyID,
      lastID: plies[plies.length - 1].id,
    };
  });
  expect(result.warnings).toEqual([]);
  expect(result.swept).toEqual([]);
  expect(result.lockedPlyID).toBe(result.lastID);
});

test("sweep on a finished game ends as before", async ({ page }) => {
  const result = await page.evaluate(async () => {
    window.app.$store.commit("game/MARK_PLAYTAK_ENDED");
    const bot = window.__bot;
    const plies = window.app.$game.plies;
    await bot.analyzeBranch();
    return {
      swept: window.__swept,
      frontierTPS: plies[plies.length - 1].tpsAfter,
      isInteractiveEnabled: bot.state.isInteractiveEnabled,
    };
  });
  expect(result.swept).toContain(result.frontierTPS);
  expect(result.isInteractiveEnabled).toBe(false);
});
```

- [ ] **Step 2: Run the tests to make sure they fail**

Run: `cd tests && npx playwright test e2e/live-follow-analysis.spec.js --reporter=line`
Expected: the first three new tests FAIL. The frontier is swept, there's no
handoff, and "fully analysed" shows the warning. "Finished game" PASSES.

- [ ] **Step 3: Allow enabling interactive mode with an initial lock**

Replace the setter's signature line and first guard:

```js
  set isInteractiveEnabled(isInteractiveEnabled) {
    this.setInteractiveEnabled(isInteractiveEnabled);
  }

  // `lock` starts interactive mode already locked, so the first search runs
  // on the locked position rather than wherever the board happens to be.
  setInteractiveEnabled(isInteractiveEnabled, { lock = null } = {}) {
    if (
      !this.meta.isInteractive ||
      this.state.isInteractiveEnabled === isInteractiveEnabled
    ) {
      return;
    }
```

Keep the rest of the old setter body unchanged as the body of
`setInteractiveEnabled`. In the enable branch, directly after the `setState({...})`
that resets the lock fields (and before `this.unwatchPosition = store.watch(`),
add:

```js
if (lock) {
  this.setInteractiveLock(lock);
}
```

This is all synchronous: no search starts until the final
`this.analyzeInteractive()` in the enable branch, which reads the lock.

- [ ] **Step 4: Add the live-follow target helpers**

Directly after the `enforcesLiveMinimum` getter, add:

```js
  // The ply a sweep on a live game hands off to: the last synced main-line
  // move, when this engine can follow it interactively and the game hasn't
  // ended on it.
  getLiveFollowTarget() {
    const config = store.state.game && store.state.game.config;
    if (!config || !config.playtakLive || !this.meta.isInteractive) {
      return null;
    }
    const ply = this.getLastMainlinePly();
    if (!ply || (ply.result && ply.result.type !== "1")) {
      return null;
    }
    return ply;
  }

  // The live frontier is left for the interactive lock, so a sweep doesn't
  // spend a fixed-budget search on it first. Checked on every queue refresh
  // so a new move turns the old frontier into an ordinary position.
  isLiveFrontierTPS(tps) {
    const ply = this.getLiveFollowTarget();
    return !!(ply && ply.tpsAfter === tps);
  }
```

- [ ] **Step 5: Change `_analyze`**

1. Replace the `shouldAnalyzePosition` declaration (the
   `const shouldAnalyzePosition = savedForThisEngine ? ... : null;` statement
   and the comment above it) with:

```js
// When saved results for this engine are selected — or always, on a
// live game — skip the positions they already cover deeply enough,
// so a sweep fills gaps and deepens what is shallow. On a live game
// that can be followed, the frontier is left for the interactive
// lock the sweep hands off to.
const config = store.state.game && store.state.game.config;
const isLive = !!(config && config.playtakLive);
const savedFilter = savedForThisEngine
  ? this.getSavedResultFilter(analysisState.savedBotName)
  : isLive
  ? this.getSavedResultFilter(this.label)
  : null;
const canFollowLive = isLive && this.meta.isInteractive;
const shouldAnalyzePosition = canFollowLive
  ? (p) => !this.isLiveFrontierTPS(p.tps) && (!savedFilter || savedFilter(p))
  : savedFilter;
```

2. Declare `handoffPly` just above the executor's `try {`, so that `finally`
   can see it:

```js
    return new Promise(async (resolve, reject) => {
      let handoffPly = null;
      try {
```

3. In the `if (!positions.length) {` branch, before `this.onWarning("fullyAnalyzed", ...)`, add:

```js
handoffPly = this.getLiveFollowTarget();
if (handoffPly) {
  resolve();
  return;
}
```

4. Replace the post-loop block:

```js
        // Insert comments if successful and auto-save is enabled
        if (this.state.isAnalyzingGame || this.state.isAnalyzingBranch) {
          this.autoSaveEvalComments(null, "completion");
          resolve();
```

with:

```js
        // Insert comments if successful and auto-save is enabled
        if (this.state.isAnalyzingGame || this.state.isAnalyzingBranch) {
          this.autoSaveEvalComments(null, "completion");
          // Caught up with a live game: keep following it interactively.
          handoffPly = this.getLiveFollowTarget();
          resolve();
```

5. Extend `finally`:

```js
      } finally {
        this._forceReplaceTPS = null;
        this.onSearchEnd({ isAnalyzingGame: false, isAnalyzingBranch: false });
        if (handoffPly) {
          this.setInteractiveEnabled(true, {
            lock: {
              tps: handoffPly.tpsAfter,
              plyID: handoffPly.id,
              plyIsDone: true,
              followsMainline: true,
            },
          });
        }
      }
```

`onSearchEnd` has already cleared `isRunning` and the sweep flags, so the
interactive enable starts cleanly. `getLiveFollowTarget` is called at that
moment, not at sweep start, so a game that ended mid-sweep exits normally.

- [ ] **Step 6: Run the tests**

Run: `cd tests && npx playwright test e2e/live-follow-analysis.spec.js e2e/analysis-skip.spec.js e2e/playtak-live-append.spec.js --reporter=line`
Expected: all PASS.

- [ ] **Step 7: Format and commit**

```bash
npx prettier --write src/bots/bot.js tests/e2e/live-follow-analysis.spec.js
git add src/bots/bot.js tests/e2e/live-follow-analysis.spec.js
git commit -m "Hand off live-game sweeps to a locked follow of the last move"
```

---

### Task 4: Queued-move tooltip and usage docs

**Files:**

- Modify: `src/components/drawers/BotSuggestions.vue` (lock button, around
  lines 557–575; computeds, around line 1011)
- Modify: `src/i18n/en-us/index.js` (top-level plurals, around line 172)
- Modify: `src/i18n/en-us/usage.md` ("Interactive Analysis Lock" section,
  around line 592)
- Test: `tests/e2e/live-follow-analysis.spec.js`

**Interfaces:**

- Consumes: bot state `lockedQueue` from Task 2.
- Produces: i18n key `n_queuedMoves`.

- [ ] **Step 1: Write the failing test**

Add inside the `describe` block:

```js
test("lock tooltip shows the queued-move count", async ({ page }) => {
  await lockFrontier(page);
  await reportNodes(page, 100);
  await appendLive(page, "e1");
  await appendLive(page, "e6");
  const text = await page.evaluate(() =>
    window.app.$tc("n_queuedMoves", window.__bot.state.lockedQueue.length)
  );
  expect(text).toBe("2 moves queued");
});
```

- [ ] **Step 2: Run the test to make sure it fails**

Run: `cd tests && npx playwright test e2e/live-follow-analysis.spec.js -g "tooltip" --reporter=line`
Expected: FAIL. The text is `"n_queuedMoves"` because the key is missing.

- [ ] **Step 3: Add the string**

In `src/i18n/en-us/index.js`, after `n_notes: "0 notes | 1 note | {count} notes",`, add:

```js
  n_queuedMoves: "No moves queued | 1 move queued | {count} moves queued",
```

- [ ] **Step 4: Show it in the tooltip**

In `BotSuggestions.vue`, replace the lock button's `<hint>` contents:

```vue
<hint>
                  {{
                    isInteractiveLocked
                      ? $t("Unlock Position")
                      : $t("Lock Position")
                  }}
                  <template v-if="lockedQueueLength">
                    <br />{{ $tc("n_queuedMoves", lockedQueueLength) }}
                  </template>
                </hint>
```

Add a computed after `isInteractiveLocked()`:

```js
    lockedQueueLength() {
      return (this.botState.lockedQueue || []).length;
    },
```

- [ ] **Step 5: Update the usage docs**

In `src/i18n/en-us/usage.md`, in the "Interactive Analysis Lock" bullet list,
replace:

```md
- If the locked position is the last played position, and a new move is played, analysis will move to the new position.
```

with:

```md
- If the locked position is the last played position, and a new move is played, analysis will move to the new position.
- In a live PlayTak game, a lock on the last played position treats the engine's limits as minimums. Each position is searched until it reaches at least half its node or time limit before analysis moves on, and moves played sooner are queued and analyzed in order. The lock's tooltip shows how many moves are waiting. Unlock to stop this.
```

After that section's closing `:::` note block (the one ending "Interactive
analysis is also stopped before switching games.\n\n:::"), add:

```md
### Analyzing Live Games

To catch up on an ongoing PlayTak game, for example after a disconnect or a crash, use **Analyze Branch** or **Analyze Game** with an interactive engine:

- Positions that already have saved results from the same engine, searched to at least half its limits, are skipped. There's no need to switch to saved results first.
- When the sweep reaches the latest move, it switches to interactive analysis locked on that move, and keeps following the game as described above.

If no new moves have been played since you last analyzed, you can also go to the latest move and lock interactive analysis directly.
```

- [ ] **Step 6: Run the tests and check the tooltip by eye**

Run: `cd tests && npx playwright test e2e/live-follow-analysis.spec.js --reporter=line`
Expected: all PASS.

Then open `http://localhost:8081/` with any game, enable interactive analysis
in the Bot Suggestions panel, lock, and hover the lock icon. The tooltip
should read "Unlock Position" with no second line.

- [ ] **Step 7: Format and commit**

```bash
npx prettier --write src/components/drawers/BotSuggestions.vue src/i18n/en-us/index.js src/i18n/en-us/usage.md tests/e2e/live-follow-analysis.spec.js
git add src/components/drawers/BotSuggestions.vue src/i18n/en-us/index.js src/i18n/en-us/usage.md tests/e2e/live-follow-analysis.spec.js
git commit -m "Show queued live moves on the lock tooltip and document live analysis"
```

---

### Task 5: Manual check against a real engine (human-assisted)

Not automatable: the real TEI `stop`/`bestmove` cycle needs a running
engine and a live game.

- [ ] **Step 1:** Connect a TEI engine (e.g. Topaz) and set a node limit.
      Turn on "Auto-save each position".
- [ ] **Step 2:** Follow a live PlayTak game partway in. Press **Analyze
      Branch**. Confirm that:
  - earlier saved positions are skipped;
  - the board follows the sweep;
  - at the latest move, the lock icon turns on and the engine keeps
    searching.
- [ ] **Step 3:** When a move is played quickly, confirm that:
  - the tooltip shows "1 move queued";
  - analysis moves on once the node count passes half the limit;
  - a note is saved for the position it left.
- [ ] **Step 4:** Refresh the page. Go to the latest move, enable interactive
      analysis and lock. Confirm the same queueing behaviour.
- [ ] **Step 5:** Unlock while moves are queued. Confirm that the queue
      clears and analysis follows navigation again.
