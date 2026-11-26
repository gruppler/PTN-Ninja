# Embed Echo Opt-out and Analysis Toggle Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two embed options: `echoHostCommands` (off stops an embed sending a host's own commands back) and `showToolbarAnalysisBtn` (off hides the analysis panel's Show/Hide button).

**Architecture:** The first is a gate at the single `postMessage()` helper in `src/utilities.js`, raised by `withoutEcho(fn)` around host commands and URL setup. The second is a UI option read by `ToolbarAnalysis.vue` in embeds.

**Tech Stack:** Vue 2, Vuex, Quasar 1, Playwright e2e (`tests/e2e`, app served on port 8081).

**Changed after writing:** `echoHostCommands` defaults to `false` (echoes off), and both options have a row in the Embed dialog. The spec has the final design.

**Spec:** `docs/superpowers/specs/2026-11-26-embed-echo-and-analysis-toggle-design.md`

## Global Constraints

- Both options default to `true`; with defaults, no message and no pixel changes.
- Both are listed in `embedUIOptions` (alphabetical) in `src/store/ui/state.js`.
- Never mutate the game directly; go through Vuex.
- Run `npx prettier --write` on every modified file.
- Each task is its own branch off `dev` and its own PR into `dev`, with a `minor` changelog entry in `changelog/unreleased/`.
- No Co-Authored-By trailer; commit through the commit-and-push skill with the changelog entry approved first.

## Review Focus

- A host command whose action awaits before committing (`SET_CURRENT_PTN`, `SET_GAME`): no echo arrives late. Test in Task 1.
- A player's move right after a host command: `INSERT_PLY` still arrives. Test in Task 1.
- `GAME_STATE` after a host `APPEND_PLY` with echoes off: still arrives. Test in Task 1.
- `echoHostCommands` turned off by `SET_UI` rather than URL: later commands are quiet. Test in Task 1.
- Button hidden while the panel is open: panel still shows, and `SET_UI {showToolbarAnalysis:false}` closes it leaving arrows. Test in Task 2.

---

### Task 1: `echoHostCommands`

**Files:**

- Modify: `src/utilities.js` (`postMessage`, new `withoutEcho`)
- Modify: `src/App.vue` (message handler, first `offline` setting)
- Modify: `src/layouts/Embed.vue` (`created`)
- Modify: `src/store/ui/state.js` (default + `embedUIOptions`)
- Modify: `readme.md` (URL parameter; Outgoing Messages)
- Create: `tests/e2e/embed-echo.spec.js`
- Create: `changelog/unreleased/embed-echo-host-commands.json`

**Interfaces:**

- Produces: `withoutEcho(fn: () => any): any` exported from `src/utilities.js`; returns what `fn` returned.

- [ ] **Step 1: Write the failing spec** `tests/e2e/embed-echo.spec.js`, reusing the `openEmbed` pattern of `tests/e2e/embed-api-theme.spec.js` (host on `localhost:8081`, embed on `127.0.0.1:8081`, every message collected in `window.replies`, PTN `[Size "5"]\n\n1. a1 e5`). Tests:
  - `echoes by default`: send `APPEND_PLY "a2"`; replies include `APPEND_PLY` and `GAME_STATE`.
  - `quiet with &echoHostCommands=false`: no `SET_UI` in the boot replies; after `APPEND_PLY "a2"`, `LAST`, `SET_UI {axisLabels:false}`, `HIGHLIGHT_SQUARES ["a1"]`, `SET_CURRENT_PTN "[Size \"5\"]\n\n1. a1 e5"`, wait 1 s: replies' actions are a subset of `["GAME_STATE","GAME_END"]` and include `GAME_STATE`.
  - `replies still answer`: `GET_THEMES` with echoes off answers.
  - `a player's move is still reported`: with echoes off, send `LAST`, then click an empty square in the frame; replies include `INSERT_PLY`.
  - `SET_UI turns it off`: default embed, send `SET_UI {echoHostCommands:false}`, then `LAST`; no `LAST` reply after 500 ms.
- [ ] **Step 2: Run it**: `cd tests && npx playwright test e2e/embed-echo.spec.js --trace off`. Expected: the quiet tests fail.
- [ ] **Step 3: Implement.**
  - `utilities.js`: module counter; `withoutEcho(fn)` raises it, runs `fn` in try/finally, and lowers it when `Promise.resolve(result)` settles (lower immediately if `fn` throws). `postMessage` returns without sending when the counter is raised and the action is not in `ALWAYS_SENT = GAME_STATE, GAME_END, READY, SELECTION, UNHANDLED_KEY, GET_THEME, GET_THEMES, GET_URL`.
  - `App.vue`: split the handler so the `switch` is `runAction(data)` returning the dispatch's promise where there is one; `handleMessage` calls it inside `withoutEcho` when `store.state.ui.echoHostCommands === false`. Same for the first `offline` setting.
  - `Embed.vue` `created()`: when `this.state.echoHostCommands === false`, run the URL settings loop, `SET_THEME` and `getGame()` inside `withoutEcho`.
  - `state.js`: `echoHostCommands: true`.
- [ ] **Step 4: Run the spec and `e2e/embed-api-theme.spec.js`, `e2e/embed-notify.spec.js`.** Expected: all pass.
- [ ] **Step 5: Docs and changelog.** `readme.md`: `echoHostCommands` under URL Parameters (alphabetical), and a paragraph in Outgoing Messages naming what is always sent. Changelog `minor`/`added`.
- [ ] **Step 6: Commit, push, open the PR.**

### Task 2: `showToolbarAnalysisBtn`

**Files:**

- Modify: `src/components/board/ToolbarAnalysis.vue`
- Modify: `src/store/ui/state.js`
- Modify: `readme.md`
- Create: `tests/e2e/embed-analysis-toggle.spec.js`
- Create: `changelog/unreleased/embed-analysis-toggle-btn.json`

- [ ] **Step 1: Write the failing spec.** Same host page. Send `SET_ANALYSIS` with suggestions `[{pv:["a2"],evaluation:80}]` for the current position. Tests:
  - `default shows the button`: `.toolbar-analysis-toggle` visible.
  - `&showToolbarAnalysisBtn=false hides it`: button count 0; panel body still visible.
  - `with showToolbarAnalysis=false too, only the arrows remain`: button count 0, `.toolbar-analysis-container` bounding-box height 0, and the board's analysis overlay still has a suggestion drawn.
  - `SET_UI closes an open panel with the button hidden`.
- [ ] **Step 2: Run it; expect the hidden tests to fail.**
- [ ] **Step 3: Implement.** `state.js`: `showToolbarAnalysisBtn: true`. `ToolbarAnalysis.vue`: computed `showToggle = !isEmbedded || ui.showToolbarAnalysisBtn`; `v-if` on the button; when `!showToggle && collapsed` the container has no padding or height.
- [ ] **Step 4: Run the spec; expect pass.**
- [ ] **Step 5: Docs and changelog** (`readme.md` URL parameter next to `showToolbarAnalysis`; `minor`/`added`).
- [ ] **Step 6: Commit, push, open the PR.**
