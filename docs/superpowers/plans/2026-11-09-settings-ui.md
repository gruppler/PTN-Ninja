# Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every user preference has one home, a searchable Settings dialog, and the board menu and contextual gears render the same rows from one registry.

**Architecture:** A static registry (`src/settings/registry.js`) describes each setting once. Two global components, `SettingRow` and `SettingsSection`, render any entry or section, reading values from the store and writing only through `ui/SET_UI` and `analysis/SET`. The Settings dialog, the board menu (`BoardToggles.vue`) and the gear panels (`EnginesSettings`, `SavedResults`, `NotesSettings`) all render through `SettingsSection`.

**Tech Stack:** Vue 2, Quasar 1, Vuex, vue-i18n, Playwright E2E (`tests/e2e`).

**Spec:** `docs/superpowers/specs/2026-11-09-settings-ui-design.md`. It is the authority. This plan doesn't build settings sync. Its last task revises the sync plan (`docs/superpowers/plans/2026-11-08-settings-sync.md`) to build on the registry.

## Global Constraints

- `CLAUDE.md`: never mutate state directly. Read from the store, and write only with `ui/SET_UI [key, value]`, `analysis/SET [key, value]`, or (for `dbSettings`) the way `OpeningsSettings.vue` already writes it.
- `CLAUDE.md`: new i18n strings go in their category in `src/i18n/en-us/index.js`, in alphabetical order. Run `npx prettier --write` on every modified file.
- No change to what any setting does or to its default (spec non-goal). The one removal is `hideAnalysisNotes` (owner decision).
- Registry IDs are `"<store>:<key>"`, e.g. `"ui:axisLabels"`, the same IDs the sync plan uses.
- Every surface that shows a parent shows its children, indented directly under it (spec, "Dependent settings stay with their parent").
- Embedded pages (`state.ui.embed`): a setting listed in `getters["game/disabledOptions"]` is hidden. Elsewhere it is disabled and reads as `false`, matching `isDisabled` in today's `BoardToggles.vue` and `Preferences.vue`.
- Tests are Playwright E2E in `tests/e2e/settings.spec.js`, using `openApp` from `tests/e2e/helpers.js`. Run: `cd tests && npx playwright test e2e/settings.spec.js`.

## Registry contents

`category`/`section` IDs and their i18n labels (new keys, in a new `settings` i18n category):

| Category        | Icon (`src/icons.js` name, add if missing) | Sections (in order)                                              |
| --------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| `board`         | `board`                                    | `theme`, `onBoard`, `aroundBoard`, `view`                        |
| `analysis`      | `analysis`                                 | `onBoard`, `suggestions`, `saving`, `openingDatabase`, `engines` |
| `navigation`    | `navigation`                               | `controls`, `scrolling`, `loading`                               |
| `notifications` | `notifications`                            | `notifications`                                                  |
| `general`       | `settings`                                 | `general`                                                        |
| `account`       | `account`                                  | `account`                                                        |

Entries, in registry order (children right after their parent; `›` = `dependsOn` the row above at one less indent). `label` is the i18n key the setting's current control uses; find it in the file the setting is shown in today.

- **board / theme:** `ui:themeID` (control `theme`, renders `ThemeSelector` with `edit-button`).
- **board / onBoard:** `ui:highlightSquares` (hotkey `highlightSquares`), `ui:flatWinHighlights`, `ui:showRoads` (hotkey `showRoads`), `ui:stackCounts` (hotkey `stackCounts`), `ui:centerStackCounts` (`disabledWhen: ui.axisLabels && ui.axisLabelsSmall`, `forcedValue: true`, `disabledHint: "settings.lockedBySmallAxisLabels"`).
- **board / aroundBoard:** `ui:turnIndicator` (hotkey) › `ui:flatCounts` (hotkey); `ui:moveNumber` (hotkey) › `ui:evalText` (keywords `["evaluation", "analysis"]`); `ui:unplayedPieces` (hotkey); `ui:axisLabels` (hotkey, keywords `["coordinates"]`) › `ui:axisLabelsSmall` (hotkey).
- **board / view:** `ui:animateBoard` › `ui:animateScrub`; `ui:verticalLayout` (`disabledWhen: !ui.unplayedPieces`, `disabledHint: "settings.requiresUnplayedPieces"`) › `ui:verticalLayoutAuto`; `ui:board3D` (hotkey) › `ui:orthographic` (`hideWhenOff: "quick"`), `ui:perspective` (slider, same min/max/step as today, `hideWhenOff: "quick"`, also hidden while `ui.orthographic` is on, as today).
- **analysis / onBoard:** `ui:showAnalysisBoard` (hotkey), `ui:showEval` › `ui:boardEvalBar`, `analysis:showEvalMarks`.
- **analysis / suggestions:** `analysis:showContinuation` › `analysis:showFullPVs` (`hideWhenOff: true`, as today); `analysis:evalType` (select, options from `EnginesSettings.vue`); `analysis:analyzeBackward`.
- **analysis / saving:** `analysis:pvsToSave`, `analysis:pvLimit`, `analysis:saveSearchStats`, `analysis:autoSaveEachPosition`, `analysis:autoSaveOnSearchComplete`. Controls, options and any `v-if`/`:disable` dependency come from `SavedResults.vue`, unchanged.
- **analysis / openingDatabase:** one entry `analysis:dbSettings`, control `component`, `component: "OpeningsSettings"`, keywords `["players", "rating", "komi", "tournament", "dates", "bot games", "top games"]`.
- **analysis / engines:** one entry `analysis:activeBots`, control `component`, `component: "SettingsEngines"` (new, Task 2).
- **navigation / controls:** `ui:showControls` (hotkey) › `ui:hapticNavControls`, `ui:showPlayButton` › `ui:playSpeed` (slider, as today); `ui:showScrubber` (hotkey).
- **navigation / scrolling:** `ui:scrollNavigation` › `ui:scrollThreshold` (control `component`, `component: "SettingScrollThreshold"`, moved from `Preferences.vue` with its Autodetect dialog).
- **navigation / loading:** `ui:skipToEndOnLoad`.
- **notifications:** `ui:notifyGame`, `ui:notifyNotes` › `ui:notifyAnalysisNotes` (`hideWhenOff: true`, as today in `NotesSettings.vue`).
- **general:** `ui:showHints` (hotkey), `ui:nativeSharing`, `ui:openDuplicate` (select, options from `Preferences.vue`), `ui:showChangelogAfterUpdate`, `ui:autoAnnotateTak`.
- **account:** one entry `account:status`, control `component`, `component: "SettingsAccount"` (new, Task 2), `sync: "never"`.

Every entry also has `sync`, copied from the "Key classification" table in the sync plan. `UNLISTED` maps every other key of `ui` and `analysis` `defaults` to its class from that table. Add `ui:boardMenuSections` (Task 4) as `never`, and drop `hideAnalysisNotes`.

New i18n strings (category `settings`, alphabetical): `"All Settings"`, `lockedBySmallAxisLabels: "Always on while small axis labels are shown"`, `noResults: "No settings match \"{query}\""`, `requiresUnplayedPieces: "Requires Unplayed pieces"`, `"Search Settings"`, `countOn: "{n} on"`, and one key per category and section ID above (`categories.<id>`, `sections.<category>.<id>`), with labels from the spec: Board, Analysis, Navigation, Notifications, General, Account and Sync; Theme, On the board, Around the board, View, Suggestions, Saving, Opening database, Engines, Controls, Scrolling, Loading, Notifications, General, Account.

Two dependencies found in the code that the spec's table doesn't list are included above: Note notifications › Analysis note notifications (`NotesSettings.vue`) and Show continuation › Show full suggestion (`EnginesSettings.vue`, `SavedResults.vue`). Both are hidden while their parent is off today, so they get `hideWhenOff: true`.

## Review Focus

1. **Center stack counts while locked.** Turning small axis labels on shows Center stack counts as on and disabled, and turning them off again restores the user's stored value, as `centerStackCountsToggle` does today. _(Task 2 test.)_
2. **Clearing the scroll threshold.** Clearing the field stores `0`, never `null` or `""`, as the watcher in `Preferences.vue` does today. _(Task 2 test.)_
3. **Embedded board menu.** In an embed, a disabled option is hidden, and so are its children. _(Task 4 test.)_
4. **A search that matches only a child.** "scrubbing" shows Animate board above Animate while scrubbing; the child never appears alone. _(Task 3 test.)_
5. **A stale deep link.** `/settings/nonsense/also-nonsense` opens the first category without an error. _(Task 2 test.)_

---

### Task 1: The registry

**Files:**

- Create: `src/settings/registry.js`
- Modify: `src/boot/globalComponents.js` (set `Vue.prototype.$settingsRegistry`), `src/store/ui/state.js` (remove `hideAnalysisNotes`)
- Test: `tests/e2e/settings.spec.js`

**Interfaces:**

- Produces, from `registry.js`:

  - `CATEGORIES: { id, label, icon, sections: { id, label }[] }[]`
  - `SETTINGS: Entry[]`, where `Entry = { id, store, key, label, hint?, keywords?, category, section, control, options?, min?, max?, step?, component?, dependsOn?, hideWhenOff?: true | "quick", disabledWhen?: (rootState) => boolean, forcedValue?, disabledHint?, hotkey?, sync }`. `control` is one of `toggle | select | slider | number | theme | component`.
  - `UNLISTED: { [id]: syncClass }`
  - `byId(id): Entry | undefined`, `childrenOf(id): Entry[]` (direct children, in order), `entriesIn(category, section, ids?): Entry[]` (top-level entries only; with `ids`, only those).
  - `getValue(rootState, entry)` and `setValue(dispatch, entry, value)`.

- [ ] **Step 1: Write the failing tests** in `tests/e2e/settings.spec.js`, using `window.app.$settingsRegistry`:
  - `"every ui and analysis default is listed exactly once"`: every key of `state.ui.defaults` and `state.analysis.defaults`, as `"ui:" + k` or `"analysis:" + k`, appears exactly once across `SETTINGS` IDs (excluding `account:status`) and `UNLISTED` keys. Neither list contains an unknown key.
  - `"children sit with their parent"`: for each entry with `dependsOn`, the parent exists, has the same `category` and `section`, and comes before the child in `SETTINGS`, with only its other children (and their children) between them.
  - `"sections and hotkeys exist"`: every entry's `category`/`section` is in `CATEGORIES`, and every `hotkey` is a key of `HOTKEYS.UI` (expose `HOTKEYS` on the registry module as a re-export for the test).
  - `"hideAnalysisNotes is gone"`: `"hideAnalysisNotes" in state.ui.defaults` is false.
- [ ] **Step 2: Run them and see them fail.** Expected: FAIL, because `$settingsRegistry` is undefined.
- [ ] **Step 3: Implement** `registry.js` from "Registry contents" above, and remove `hideAnalysisNotes`.
- [ ] **Step 4: Run.** Expected: all four PASS.
- [ ] **Step 5: Commit.** `npx prettier --write` the changed files, then `git commit -m "Add the settings registry"`.

### Task 2: Rows, sections, and the Settings dialog

**Files:**

- Create: `src/components/settings/SettingRow.vue`, `src/components/settings/SettingsSection.vue`, `src/components/settings/SettingScrollThreshold.vue`, `src/components/settings/SettingsEngines.vue`, `src/components/settings/SettingsAccount.vue`, `src/dialogs/Settings.vue`
- Delete: `src/dialogs/Preferences.vue`
- Modify: `src/boot/globalComponents.js` (register `setting-row` and `settings-section`), `src/router/routes.js`, `src/keymap.js`, `src/layouts/Main.vue`, `src/components/controls/MainMenu.vue`, `src/i18n/en-us/index.js`
- Test: `tests/e2e/settings.spec.js`

**Interfaces:**

- Consumes: Task 1's registry.
- Produces:

  - `<setting-row :entry="entry" :quick="false" :depth="0" />`. It renders the control for `entry.control`, the hotkey from `HOTKEYS_FORMATTED.UI[entry.hotkey]` on the right, and its children indented below it (recursively, `depth + 1`). It is disabled when its parent is off, when `disabledWhen` is true (showing `forcedValue` and `disabledHint`), or when the option is in `game/disabledOptions`. It is hidden in an embed when disabled by `game/disabledOptions`, and hidden when its parent is off and `hideWhenOff` is `true` (or `"quick"` with `quick` set).
  - `<settings-section :category :section :ids? :quick? :collapsible? :open? @update:open />`. It renders the top-level entries of `entriesIn(category, section, ids)` as `setting-row`s. Collapsible mode is used by Task 4.
  - Route `settings`, path `/settings/:category?/:section?`. `/preferences` redirects to it. Query `focus=search` focuses the search field.
  - `SettingsEngines`: one row per `analysis.activeBots` entry, linking to route `bot` with `params: { botID }`, plus an "Add Engine" row that does what the existing add-engine control in `BotSuggestions.vue` does.
  - `SettingsAccount`: the signed-in user's name, or "Not signed in", and a link to route `account`. Sync choices are added to it by the sync plan.

- [ ] **Step 1: Write the failing tests.**
  - `"P opens Settings on the Board category"`: press `p`; expect the URL path `/settings`, a visible "Board" category marked active, and the "Around the board" section header.
  - `"deep link opens a section"`: go to `/#/settings/navigation/scrolling` (the app's router mode, check `quasar.conf.js`); expect "Scroll threshold" in view.
  - `"stale deep link falls back"`: `/settings/nonsense/also-nonsense` shows the Board category, with no page errors.
  - `"/preferences redirects"`: the path becomes `/settings`.
  - `"toggling a row writes through the store"`: click the Axis labels row; `state.ui.axisLabels` flips.
  - `"a child is disabled while its parent is off"`: with `ui.scrollNavigation` false, the scroll threshold input is disabled; turn it on and it's enabled.
  - `"clearing the scroll threshold stores 0"`: set 25, clear the field; `state.ui.scrollThreshold === 0`.
  - `"center stack counts locks on with small axis labels"`: set `centerStackCounts` false, `axisLabels` and `axisLabelsSmall` true; the row shows on, disabled, with "Always on while small axis labels are shown". Turn `axisLabelsSmall` off; the row shows off.
  - `"vertical layout requires unplayed pieces"`: with `unplayedPieces` false, the Vertical layout row is disabled with "Requires Unplayed pieces".
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.** Build the dialog on `large-dialog`, with the category list on the left and the selected category's sections on the right. On screens under 600px wide (Quasar `$q.screen.lt.sm`), show the category list first, then the category with a back arrow. In `keymap.js`, add `DIALOGS.settings: ["ctrl", ","]` next to `preferences`, and name both "Settings" in `HOTKEY_NAMES`. In `Main.vue`, both hotkeys and the existing `preferences` case push `{ name: "settings", query: { focus: "search" } }`. Rename the main menu item to "Settings", keeping its icon.
- [ ] **Step 4: Run.** Expected: all PASS, and every Task 1 test still passes.
- [ ] **Step 5: Commit.** `npx prettier --write`, then `git commit -m "Replace UI Preferences with a Settings dialog"`.

### Task 3: Search

**Files:**

- Modify: `src/settings/registry.js`, `src/dialogs/Settings.vue`, `src/i18n/en-us/index.js`
- Test: `tests/e2e/settings.spec.js`

**Interfaces:**

- Produces `search(query, t): { entry, context: boolean }[]` in `registry.js`. It matches case-insensitively on `t(label)`, `t(hint)`, `keywords`, and the translated section label. Each match is preceded by its ancestors (`context: true`) unless they already match, and followed by its children. Results are in registry order, so they stay grouped by category in category order.

- [ ] **Step 1: Write the failing tests.**
  - `"search finds settings by keyword with a breadcrumb"`: type "coordinates"; expect a row "Axis labels" with breadcrumb "Board › Around the board", and its child "Small axis labels" under it.
  - `"a child match shows its parent"`: type "scrubbing"; expect "Animate board" directly above "Animate while scrubbing".
  - `"a result can be changed in place"`: type "roads", click the row; `state.ui.showRoads` flips.
  - `"no matches says so"`: type "zzzz"; expect `No settings match "zzzz"`.
  - `"clearing returns to the category"`: clear the field; the previous category's sections are back.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement** `search` and the results view. Debounce input by 150 ms. Breadcrumbs are shown on top-level results only.
- [ ] **Step 4: Run.** Expected: all PASS.
- [ ] **Step 5: Commit.** `npx prettier --write`, then `git commit -m "Search settings by name, hint and keyword"`.

### Task 4: The sectioned board menu

**Files:**

- Modify: `src/components/controls/BoardToggles.vue`, `src/store/ui/state.js` (add `boardMenuSections: { onBoard: true, aroundBoard: false, analysis: false, view: false }` to defaults and to the persisted keys list next to `showBoardPrefsBtn`), `src/settings/registry.js` (`UNLISTED["ui:boardMenuSections"] = "never"`)
- Test: `tests/e2e/settings.spec.js`

**Interfaces:**

- Consumes: `settings-section` with `collapsible`, `quick`, `open` and `@update:open`. Collapsed, its header shows `settings.countOn` with the number of toggles in it that are on.

- [ ] **Step 1: Write the failing tests.**
  - `"board menu has theme then four sections"`: open the board menu; expect the theme selector, then headers "On the board", "Around the board", "Analysis", "View", and "All settings" in the footer. Only "On the board" is expanded.
  - `"open sections persist"`: expand "View", reload, reopen; "View" is expanded.
  - `"3D camera rows appear only with 3D"`: in View, Orthographic is absent while `board3D` is false, and present after turning it on.
  - `"All settings opens the Board category"`: click it; path is `/settings/board`.
  - `"embed hides disabled options and their children"`: load an embed with `axisLabels` disabled, the way `tests/e2e/embed-notify.spec.js` builds embed URLs; open the menu; neither "Axis labels" nor "Small axis labels" is present.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.** Keep the gear button and the board transform menu as they are. Replace the toggle rows with the theme selector and four `settings-section`s: `board/onBoard`, `board/aroundBoard`, `analysis/onBoard` with `ids: ["ui:showAnalysisBoard", "ui:showEval"]` and title "Analysis", and `board/view`. Write open state with `ui/SET_UI ["boardMenuSections", …]`.
- [ ] **Step 4: Run.** Expected: all PASS.
- [ ] **Step 5: Commit.** `npx prettier --write`, then `git commit -m "Group the board menu into collapsible sections"`.

### Task 5: Gear panels render from the registry

**Files:**

- Modify: `src/components/drawers/EnginesSettings.vue`, `src/components/drawers/SavedResults.vue`, `src/components/drawers/NotesSettings.vue`
- Test: `tests/e2e/settings.spec.js`

**Interfaces:**

- Consumes: `settings-section` with `ids`.
- Ruling: the Database Moves and Top Games gears in `OpeningExplorer.vue` stay as they are. Their rows are parts of the single `analysis:dbSettings` entry, which the Settings dialog renders through `OpeningsSettings`, so there's nothing separate to share.
- Ruling (spec over today's behavior): `NotesSettings` with `notes-only` showed only Note notifications. It now also shows Analysis note notifications under it, because a parent can't be shown without its children.

- [ ] **Step 1: Write the failing tests.**
  - `"engine and saved results gears share the suggestion rows"`: open the Engines tab gear and the Saved Results gear; both show "Show continuation" with "Show full suggestion" under it when on, and toggling it in one shows the new state in the other.
  - `"gears link to their Settings section"`: the Engines gear's "All settings" goes to `/settings/analysis/suggestions`; Saved Results' goes to `/settings/analysis/saving`; Notes' goes to `/settings/notifications`.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
  - `EnginesSettings`: `analysis/suggestions` plus `analysis/onBoard` with `ids: ["analysis:showEvalMarks"]`.
  - `SavedResults` gear: `analysis/suggestions` with `ids: ["analysis:showContinuation", "analysis:evalType"]`, then `analysis/saving`.
  - `NotesSettings`: `notifications/notifications` with `ids: ["ui:notifyNotes"]`, children included.
  - Each ends with an "All settings" link to its section. `OpeningsSettings` stays as it is, and the Settings dialog renders it.
- [ ] **Step 4: Run.** Expected: all PASS, and the whole `settings.spec.js` passes.
- [ ] **Step 5: Commit.** `npx prettier --write`, then `git commit -m "Render the analysis and notes gears from the settings registry"`.

### Task 6: Point the sync plan at the registry

**Files:**

- Modify: `docs/superpowers/plans/2026-11-08-settings-sync.md`

- [ ] **Step 1:** Rewrite sync Task 1 so `keys.js` builds `ALWAYS`, `GROUPS` and `NEVER` from each registry entry's `sync` and from `UNLISTED`, instead of holding its own lists. Its coverage test becomes this plan's Task 1 test. Drop `hideAnalysisNotes` from the key classification table and add `boardMenuSections` to Never.
- [ ] **Step 2:** Rewrite sync Task 5 so the per-device group choices go in `SettingsAccount.vue` instead of `Preferences.vue`.
- [ ] **Step 3: Commit.** `npx prettier --write` the plan, then `git commit -m "Build settings sync on the settings registry"`.
