# Settings Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in user's preferences follow their account across devices. For settings where that is debatable, each device chooses whether to sync them.

**Architecture:** A new `settings` Vuex module owns sync. It knows which `ui` and `analysis` keys are always synced, synced only when the device opts into their group, or never synced. The existing actions that write preferences to LocalStorage also dispatch `settings/QUEUE`. Queued values are written to `users/{uid}` in one debounced merge. When a user is signed in, the module reads that document and applies it through the existing Vuex actions, with the server winning. It then listens to the document so changes from other devices apply live. Remote values are applied with echo suppression so they aren't written back.

**Tech Stack:** Vue 2 / Quasar 1 / Vuex, Firebase v8 namespaced SDK (`db` from `src/boot/firebase.js`), Firestore rules, Playwright E2E against the Firebase emulators.

**Spec:** `docs/superpowers/specs/2026-10-23-online-v1-design.md`, "Settings sync" (requirement 6). This plan extends it with the owner's request of 2026-11-08: _ambiguous settings are opt-in per device._

## Global Constraints

- `CLAUDE.md`: never mutate a game directly, and read and write store state only through Vuex actions and mutations. Remote settings are applied with `ui/SET_UI` and `analysis/SET`, never by assigning to state.
- `CLAUDE.md`: new i18n strings go in the right category, in alphabetical order. Run `npx prettier --write` on every modified file.
- Storage: the document is `users/{uid}`, with fields `settings` (a map) and `settingsUpdatedAt` (`firebase.firestore.FieldValue.serverTimestamp()`).
- `settings` map keys are `"<store>:<key>"`, e.g. `"ui:themeID"` and `"analysis:pvLimit"`. Values are `JSON.stringify(value)`. Firestore can't store `undefined` or nested arrays, so values are stored as JSON strings.
- Sync runs for every signed-in user, anonymous guests included. It never runs when `state.ui.embed` is true.
- Conflict rule (spec): when the user is first known on this page load, server values replace the device's. After that, every change is written through, and the last write wins. Turning a group on applies the same rule to that group's keys.
- Writes are debounced: 1000 ms trailing, all queued keys in one `set(..., { merge: true })`.
- Group choices are per device and are never synced. They live in LocalStorage key `settingsSyncGroups` as `{ layout, board3D, input, engines }`.
- Group defaults, flagged for owner review: `layout: false`, `board3D: true`, `input: false`, `engines: false`.

### Key classification (for owner review)

Every key of `ui` `defaults` and `analysis` `defaults` appears in exactly one row.

| Class               | `ui` keys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `analysis` keys                                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Always**          | `animateBoard`, `animateScrub`, `autoAnnotateTak`, `axisLabels`, `axisLabelsSmall`, `boardEvalBar`, `centerStackCounts`, `embedConfig`, `evalText`, `flatCounts`, `flatWinHighlights`, `gameTimer`, `gifConfig`, `hideAnalysisNotes`, `highlighterColor`, `highlighterCustomColor`, `highlightSquares`, `inlineBranches`, `komi`, `moveNumber`, `notifyAnalysisNotes`, `notifyGame`, `notifyNotes`, `onlineAutoSendTipShown`, `onlineConfig`, `onlineSendMode`, `openDuplicate`, `player`, `player1`, `player2`, `playerName`, `playSpeed`, `playtakGameTypeFilter`, `playtakPlayerFilter`, `pngConfig`, `showAllBranches`, `showAnalysisBoard`, `showChangelogAfterUpdate`, `showEval`, `showHints`, `showMove`, `showRoads`, `size`, `skipToEndOnLoad`, `stackCounts`, `themeID`, `themeManualMode`, `themes`, `turnIndicator`, `unplayedPieces` | `analyzeBackward`, `autoSaveEachPosition`, `autoSaveOnSearchComplete`, `dbSettings`, `evalType`, `pvLimit`, `pvsToSave`, `saveSearchStats`, `showContinuation`, `showEvalMarks`, `showFullPVs`                                                             |
| **Group `layout`**  | `analysisSections`, `isSmallToggles`, `showBoardPrefsBtn`, `showBoardTransformBtn`, `showControls`, `showPlayButton`, `showPTN`, `showScrubber`, `showText`, `showToolbarAnalysis`, `toggleLayout`, `verticalLayout`, `verticalLayoutAuto`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —                                                                                                                                                                                                                                                          |
| **Group `board3D`** | `board3D`, `boardRotation`, `orthographic`, `perspective`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | —                                                                                                                                                                                                                                                          |
| **Group `input`**   | `hapticNavControls`, `scrollNavigation`, `scrollThreshold`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —                                                                                                                                                                                                                                                          |
| **Group `engines`** | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `activeBots`, `botID`, `botSettings` (built-in bots only; entries for custom bot IDs are dropped on write and ignored on apply)                                                                                                                            |
| **Never**           | `boardSize`, `boardSpace`, `boardTransform`, `disableBoard`, `disableNavigation`, `disablePTN`, `disablePTNTools`, `disableStoneCycling`, `disableText`, `disableUndo`, `editHeader`, `editingBranch`, `firstMoveNumber`, `hasChat`, `isPortrait`, `isVertical`, `nativeSharing`, `offline`, `selectedPiece`, `showHeader`, `textTab`, `theme`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `analysisSource`, `botList`, `botLogs`, `botMetaOverrides`, `botMetas`, `botPositions`, `botStates`, `collapsedBots`, `currentOpeningMoves`, `customBots`, `expandSuggestionPVs`, `openingPositions`, `openingStats`, `preferSavedResults`, `savedBotName` |

Reasons for the less obvious rows:

- `theme` is derived from `themeID` and `themes`; applying `themeID` runs `ui/SET_THEME`.
- `firstMoveNumber` is set per game by New Game.
- The `disable*` keys and `showHeader` are embed flags.
- `analysisSource`, `savedBotName`, `preferSavedResults` and `collapsedBots` are saved per game (`GAME_PERSISTED_KEYS`).
- `customBots` point at engines on this machine and are constructed at startup.
- `botMetaOverrides` is applied only at startup.
- `botSettings` (threads, hash size) depends on the device's hardware, which is why it sits in the opt-in `engines` group.

### Settings strings (i18n, alphabetical within each category)

- Top level: `"Input": "Input"`, `"Layout": "Layout"`, `"Sync Across Devices": "Sync Across Devices"`. `"3D Board"` and `"Engines"` already exist and are reused.
- `hint`: `syncBoard3D: "3D view, camera angle and perspective"`, `syncEngines: "Which engines are active, and their settings"`, `syncInput: "Scroll navigation, scroll sensitivity and haptics"`, `syncLayout: "Which panels and controls are shown, and their arrangement"`, `syncSettings: "Your theme and preferences follow your account. Choose which of these this device also shares."`

## Review Focus

1. **Echo loop between two open devices.** A remote apply on device B must not be written back. Otherwise A and B can ping-pong values, and the last-write-wins rule breaks. _(Task 4: echo test.)_
2. **The transient `animateBoard` flip.** `ui/WITHOUT_BOARD_ANIM` commits `SET_UI animateBoard false` directly, without the action. Hooking actions, not mutations, keeps that out of the account. _(Task 3: test that `WITHOUT_BOARD_ANIM` causes no write.)_
3. **Settings from an unknown or older build.** The server may hold keys this build doesn't classify, or values that don't parse. Skip those keys, never throw, and leave the device's value. _(Task 4: test with a seeded unknown key and invalid JSON.)_
4. **Sign out, then a new anonymous user.** After `LOG_OUT`, the old user's listener must stop before the new uid starts, so the old account's changes never reach the new one. _(Task 4: switching users test.)_
5. **Embedded pages.** An embed never reads or writes `users/{uid}`, even when a user is signed in on that origin. _(Task 3: `START` with `ui.embed` true makes no Firestore request.)_

---

### Task 1: Key classification and the `settings` module skeleton

**Files:**

- Create: `src/store/settings/keys.js`, `src/store/settings/index.js`, `src/store/settings/state.js`, `src/store/settings/mutations.js`, `src/store/settings/actions.js`, `src/store/settings/getters.js`
- Modify: `src/store/index.js` (register module `settings`)
- Test: `tests/e2e-online/settings.spec.js`

**Interfaces:**

- Produces, from `keys.js`:
  - `ALWAYS: string[]` of `"store:key"` IDs.
  - `GROUPS: { [group]: { keys: string[], default: boolean } }`, with the groups `layout`, `board3D`, `input` and `engines`.
  - `NEVER: string[]`.
  - `groupOf(id): string | null`, which returns `"always"`, a group name, or `null` for never and unknown keys.
  - `isSyncable(id, groups): boolean`.
- Produces, from the module:

  - State `{ groups: {layout, board3D, input, engines}, uid: null, applying: false }`. `groups` loads from LocalStorage `settingsSyncGroups`, defaulting from `GROUPS[g].default`.
  - Getter `classification` → `{ always, groups, never }`.
  - Action `SET_GROUP([group, on])`, which persists `settingsSyncGroups` to LocalStorage.

- [ ] **Step 1: Write the failing test.** In `settings.spec.js`, test `"every ui and analysis setting is classified exactly once"`. After `openApp(page)`, evaluate `window.app.$store`:
  - Build `all` = `Object.keys(state.ui.defaults).map(k => "ui:" + k)` together with the same for `analysis`.
  - Build `classified` = `always` + every group's `keys` + `never` from `getters["settings/classification"]`.
  - Assert `classified.sort()` deep-equals `all.sort()`, and that `new Set(classified).size === classified.length`.
- [ ] **Step 2: Run it and see it fail.**
  - Run: `cd tests && npx playwright test -c playwright.online.config.js e2e-online/settings.spec.js`
  - Expected: FAIL, because `settings/classification` is undefined.
- [ ] **Step 3: Implement.**
  - Write `keys.js` with the table from Global Constraints, verbatim.
  - Write the module and register it.
  - Add test `"group choices default per GROUPS and persist per device"`. It dispatches `settings/SET_GROUP ["layout", true]`, reloads, and expects `state.settings.groups.layout === true` and `board3D === true`.
- [ ] **Step 4: Run.** Expected: both tests PASS.
- [ ] **Step 5: Commit.** Run `npx prettier --write`, then `git commit -m "Classify which settings sync and add the settings store module"`.

### Task 2: Rules for the user's own settings document

**Files:**

- Test: `functions/test/rules.test.js`
- Modify, only if the test fails: `firestore.rules`

- [ ] **Step 1: Write the test.** `"users/{uid} document: owner reads and merges settings; others cannot"`:
  - `assertSucceeds(as("alice").doc("users/alice").set({ settings: { "ui:axisLabels": "false" } }, { merge: true }))`.
  - `assertSucceeds(as("alice").doc("users/alice").get())`.
  - `assertFails(as("bob").doc("users/alice").get())`.
  - `assertFails(as("bob").doc("users/alice").set({ settings: {} }, { merge: true }))`.
  - `assertFails(noAuth().doc("users/alice").get())`.
- [ ] **Step 2: Run.**
  - Run: `cd functions && npm test`
  - Expected: PASS. Under `rules_version = '2'`, `users/{uid}/{document=**}` also matches `users/{uid}`. If it fails, add `match /users/{uid} { allow read, write: if isUser(uid); }` beside the existing match, and re-run.
- [ ] **Step 3: Commit.** `git commit -m "Test that users can read and write their own settings document"`

### Task 3: Write-through

**Files:**

- Modify: `src/store/settings/actions.js`
- Modify: `src/store/ui/actions.js`, so that `SET_UI` and `TOGGLE_UI` dispatch `settings/QUEUE` after persisting.
- Modify: `src/store/analysis/actions.js`:
  - `SET` dispatches `QUEUE`.
  - Every caller of `saveActiveBots(state)` also dispatches `QUEUE` for `"analysis:activeBots"`.
  - `DELETE_BOT` dispatches `QUEUE` for `"analysis:botSettings"`.
- Test: `tests/e2e-online/settings.spec.js`

**Interfaces:**

- Consumes `isSyncable` and `groupOf` (Task 1).
- Produces:
  - `settings/QUEUE([store, key, value])`. It ignores the call when `state.applying`, when there's no `uid`, when `ui.embed` is set, or when `!isSyncable`. For `analysis:botSettings` it drops custom-bot IDs, i.e. any ID in `rootState.analysis.customBots`.
  - `settings/FLUSH()`, the debounced writer.
  - `settings/START(uid)`. For now it only stores `uid` and uploads every syncable key when the document has no `settings`. Task 4 extends it.
  - `settings/STOP()`.
- Wiring: in `online/INIT`'s `onAuthStateChanged`, dispatch `settings/START` with `user.uid` when there's a user. Dispatch `settings/STOP` before switching uid and when the user is null.

- [ ] **Step 1: Write the failing tests.** Read the document through Firestore REST with `Authorization: Bearer owner`, as `helpers.js` does for `names`, and decode `fields.settings.mapValue.fields`. Add helper `readSettings(uid)` in `helpers.js`, plus export.
  - `"a changed setting is written to the account"`: as a guest, dispatch `ui/SET_UI ["axisLabels", false]`. Within 5 s, `readSettings(uid)["ui:axisLabels"] === "false"`.
  - `"device-only and opted-out settings are not written"`: dispatch `ui/SET_UI ["textTab","notes"]` and `["showPTN", !current]`, plus `analysis/SET ["pvLimit", 12]`. After 3 s, the document has `"analysis:pvLimit": "12"` and has neither `"ui:textTab"` nor `"ui:showPTN"`.
  - `"WITHOUT_BOARD_ANIM does not write animateBoard"`: after the first flush, record `settingsUpdatedAt`. Dispatch `ui/WITHOUT_BOARD_ANIM` with `() => {}`, wait 3 s, and expect the same timestamp.
  - `"a first sign-in uploads the device's settings"`: a fresh guest's document holds `"ui:themeID"` equal to the page's `JSON.stringify(state.ui.themeID)`.
  - `"custom bot settings are never uploaded"`, with `engines` turned on: dispatch `analysis/SAVE_BOT` with a minimal custom TEI bot of the form `analysis/SAVE_BOT` takes in `src/dialogs/EditBot.vue`, then `SET ["botSettings", ...]`. The uploaded `"analysis:botSettings"` has no key for that bot's id.
  - `"an embed never starts sync"`: commit `ui/SET_EMBED_GAME`, dispatch `settings/START` with the uid, and assert no request to `/documents/users/` within 2 s, via `page.on("request")`.
- [ ] **Step 2: Run them and see them fail.** Same command as Task 1. Expected: FAIL.
- [ ] **Step 3: Implement** `QUEUE`, `FLUSH` (lodash `debounce` 1000 ms, one `db.doc("users/" + uid).set({ settings: {...}, settingsUpdatedAt: serverTimestamp() }, { merge: true })`), `START`, `STOP` and the wiring. If a write fails, log `console.error` and keep the queued values for the next flush.
- [ ] **Step 4: Run.** Expected: PASS, and the Task 1 tests still pass.
- [ ] **Step 5: Commit.** Run `npx prettier --write`, then `git commit -m "Write synced settings through to the user's account"`.

### Task 4: Apply on sign-in and live from other devices

**Files:**

- Modify: `src/store/settings/actions.js`
- Test: `tests/e2e-online/settings.spec.js`

**Interfaces:**

- Produces `settings/APPLY_REMOTE(settingsMap)`. It sets `applying` (mutation `SET_APPLYING`) around the dispatches. For each syncable key on the server whose JSON differs from the device's:
  - `ui:*` keys go through `ui/SET_UI`.
  - `analysis:*` keys go through `analysis/SET`.
  - `ui:themes` is applied before `ui:themeID`.
  - Unparseable values and unknown keys are skipped.
- `START(uid)` becomes:
  1. `STOP()`.
  2. `get()`.
  3. `APPLY_REMOTE` the server's map.
  4. Queue the syncable keys missing from the server.
  5. Subscribe with `onSnapshot`, ignoring snapshots with `metadata.hasPendingWrites`, and `APPLY_REMOTE` the rest.
- `STOP()` unsubscribes and cancels the pending flush.

- [ ] **Step 1: Write the failing tests.** Two browser contexts sign in to one registered account (`createAccount` and `signIn`).
  - `"signing in replaces the device's settings with the account's"`: seed `settings` through REST with `"ui:themeID": "\"dark\""` and `"ui:axisLabels": "false"`. Sign in on a fresh context. Within 5 s, `state.ui.themeID === "dark"`, `state.ui.theme.id === "dark"` and `localStorage` holds the same.
  - `"a change on one device appears on the other"`: in A, `SET_UI ["stackCounts", true]`. Within 5 s, B's `state.ui.stackCounts === true`.
  - `"an applied remote change is not written back"`: after the previous test, record `settingsUpdatedAt`, wait 3 s, and expect it unchanged.
  - `"unknown keys and bad values are skipped"`: seed `"ui:noSuchKey": "1"` and `"ui:axisLabels": "{"`. Sign in, expect no page error, and `axisLabels` keeps its value.
  - `"switching users stops the old account's sync"`: sign in as X, `online/LOG_OUT`. Change X's document through REST. After 3 s, the page didn't apply it.
- [ ] **Step 2: Run them and see them fail.** Same command. Expected: FAIL.
- [ ] **Step 3: Implement** `APPLY_REMOTE`, the full `START`, `STOP` and `SET_APPLYING`.
- [ ] **Step 4: Run.** Expected: all tests in the file PASS.
- [ ] **Step 5: Commit.** Run `npx prettier --write`, then `git commit -m "Apply account settings on sign-in and live from other devices"`.

### Task 5: Per-device sync choices in Preferences

**Files:**

- Modify: `src/dialogs/Preferences.vue`, adding a section at the end of the `q-list`.
- Modify: `src/i18n/en-us/index.js`
- Modify: `src/store/settings/actions.js`, so that `SET_GROUP` turning a group on applies that group's server values and queues its missing keys, following the conflict rule.
- Test: `tests/e2e-online/settings.spec.js`

- [ ] **Step 1: Write the failing tests.**
  - `"turning a group on adopts the account's values"`: seed `"ui:showPTN"` as the opposite of the page's value. `layout` is off, so the page keeps its value. Dispatch `settings/SET_GROUP ["layout", true]`, and within 5 s `showPTN` matches the server.
  - `"a group turned off stops writing"`: after `SET_GROUP ["board3D", false]` and `SET_UI ["perspective", 9]`, the document's `"ui:perspective"` is unchanged 3 s later.
  - `"Preferences shows the sync choices"`: navigate to the Preferences route. Four toggles labelled "Layout", "3D Board", "Input" and "Engines" are visible under "Sync Across Devices", with states matching `state.settings.groups`. Clicking "Layout" flips `groups.layout`.
- [ ] **Step 2: Run them and see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add a `q-item-label header` "Sync Across Devices" with the `hint.syncSettings` caption. Add one `q-item tag="label"` per group, with the group label, the `hint.sync*` caption as `q-item-label caption`, and a side `q-toggle` bound through `settings/SET_GROUP`.
  - Hide the section when `$store.state.ui.embed` or there's no `online.user`.
  - Add the strings listed in Global Constraints.
- [ ] **Step 4: Run.** Expected: all tests PASS. Then run the whole online suite with `cd tests && npx playwright test -c playwright.online.config.js`, and the functions tests with `cd functions && npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** Run `npx prettier --write`, then `git commit -m "Let each device choose which debatable settings it syncs"`.
