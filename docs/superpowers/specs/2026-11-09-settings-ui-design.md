# Settings UI redesign

**Status:** proposal for owner review, 2026-11-09. The owner skipped the
questions; every decision here is my call unless marked otherwise.

## Why

Preferences are hard to find and hard to scan:

- **UI Preferences** (`dialogs/Preferences.vue`) is one flat list of 15 rows
  with no headers, mixing the theme, file handling, animation, navigation and
  scroll input.
- **Board Preferences** (`controls/BoardToggles.vue`) is a flat menu of 22
  rows, mixing board display, 3D, layout and analysis overlays.
- About 40 more settings live in contextual gear panels (Openings, Engines,
  Notes, Saved Results, Database Moves, Top Games, each engine card), in
  one-off buttons (branch view, notes, PTN panel, highlighter) and in hotkeys.
  Several appear in two or three places with no single home, e.g. the
  suggestion display options appear under both Engines and Saved Results.
- Settings sync (plan `2026-11-08-settings-sync.md`) needs a complete,
  classified list of settings anyway.

## Goals

1. **One home for every user preference**, browsable by category and
   searchable by name, so "where is that setting?" always has an answer.
2. **Shorter quick menus.** The board menu and the contextual gears stay for
   in-context tweaks, but are short and grouped, and link to the full home.
3. **One source of truth.** Each setting is described once (label, hint,
   control, category, dependencies, hotkey, sync class) and every surface
   renders from that description, so duplicates can't drift.

## Non-goals

- Export and embed options (GIF, PNG, Embed configs) stay in their dialogs.
  They configure one export, not the app. They may reuse the registry's labels
  and controls later.
- Per-game state (current tab, branch view, highlighter, selected piece,
  analysis source) stays where it is. It isn't a preference.
- Online game creation options stay in New Game.
- No change to what any setting does or to its default.
- Engine-specific options (limits, TEI connection, engine options) stay on
  the engine card and in the engine editor. Settings links to them.

## Anti-goals

- A settings screen so large that browsing it is worse than today's lists.
  Each category page should fit about one screen, using sections.
- Moving a frequently used control further away. Every toggle that has a
  hotkey or sits in a quick menu today keeps it.

## The design

### 1. Settings registry

A new module `src/settings/registry.js` describes every user-facing
preference, one entry each:

```js
{
  id: "ui:axisLabels",   // same "<store>:<key>" IDs as settings sync
  label: "Axis Labels",  // i18n key
  hint: "hint.axisLabels",        // optional, shown under the label and searched
  keywords: ["coordinates", "a1"], // optional, searched only
  category: "board",
  section: "labels",
  control: "toggle",     // toggle | select | slider | number | theme | custom
  options, min, max, step,        // per control
  dependsOn: "ui:board3D",        // optional: shown or enabled only when on
  hotkey: "axisLabels",           // key in keymap.js HOTKEYS.UI, if any
  sync: "always",        // always | layout | board3D | input | engines | never
}
```

- Values are read from the store and changed only with `ui/SET_UI` and
  `analysis/SET` (or the nested `dbSettings` update the Openings panel
  already uses), per `CLAUDE.md`.
- The settings sync plan's `keys.js` is replaced by the registry's `sync`
  field, plus a short list of `never` keys that have no UI. The coverage
  test from sync Task 1 then checks the registry.
- A generic `SettingRow` component renders any entry, and `SettingsSection`
  renders a section. Every surface below uses them.

### 2. A Settings dialog that replaces UI Preferences

- **Route:** `/settings`. `/preferences` redirects to it. The main menu item
  becomes "Settings", hotkey `P` stays, and `Ctrl+,` is added.
- **Layout on wide screens:** a category list on the left and the selected
  category's sections on the right.
- **Layout on phones:** full-screen. The category list first, then tap in,
  with a back arrow.
- **Search:** a search field at the top, focused when the dialog opens from
  the keyboard. Typing replaces the category view with matching rows from
  every category, each with a breadcrumb (e.g. "Board › Labels") and its
  live control, so a match can be changed right there. Matching is
  case-insensitive on the label, hint, keywords and section name. Clearing
  the search returns to the category. With no matches, it says so.
- **Deep links:** `/settings/:category` and `/settings/:category/:section`
  open a category and scroll to a section. The quick menus and contextual
  gears use these for their "All settings" link.

**Categories and sections** (owner to review; key IDs omit the `ui:` prefix):

| Category           | Sections and settings                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Appearance**     | Theme: themeID (with edit). Motion: animateBoard, animateScrub.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Board**          | Pieces: flatCounts, stackCounts, centerStackCounts, unplayedPieces, turnIndicator, moveNumber. Highlights: highlightSquares, flatWinHighlights, showRoads. Labels: axisLabels, axisLabelsSmall. 3D: board3D, orthographic, perspective. Layout: verticalLayout, verticalLayoutAuto.                                                                                                                                                                                               |
| **Analysis**       | On the board: showAnalysisBoard, showEval, boardEvalBar, evalText, analysis:showEvalMarks. Suggestions: showContinuation, showFullPVs, evalType, analyzeBackward. Saving: pvsToSave, pvLimit, saveSearchStats, autoSaveEachPosition, autoSaveOnSearchComplete. Opening database: includeBotGames, players, minRating, komi, game type, dates, maxSuggestedMoves, maxTopGames, openGamesInNewTab. Engines: one row per active engine, opening the engine editor, and "Add engine". |
| **Navigation**     | Controls: showControls, showPlayButton, playSpeed, hapticNavControls, showScrubber. Scrolling: scrollNavigation, scrollThreshold. Loading: skipToEndOnLoad.                                                                                                                                                                                                                                                                                                                       |
| **Notifications**  | notifyGame, notifyNotes, notifyAnalysisNotes. Push notifications go here when they ship.                                                                                                                                                                                                                                                                                                                                                                                          |
| **General**        | showHints, nativeSharing, openDuplicate, showChangelogAfterUpdate, autoAnnotateTak.                                                                                                                                                                                                                                                                                                                                                                                               |
| **Account & Sync** | Signed-in state with a link to Account, and the per-device sync choices from the sync plan (Layout, 3D Board, Input, Engines).                                                                                                                                                                                                                                                                                                                                                    |

Each row shows its hotkey on the right when it has one. This fixes today's
board menu hints that look up hotkeys `keymap.js` never defines.

### 3. A shorter board menu

`BoardToggles.vue` keeps its gear button and stays a menu, with three
changes:

- **Theme stays at the top.**
- **The toggles become a compact grid** of icon toggle buttons, three or four
  per row. Each has a tooltip with its label and hotkey, and the buttons are
  grouped under the same section headers as Settings › Board. This takes the
  menu from 22 rows to about 8.
- **Dependent controls appear only when relevant.** Orthographic and
  Perspective appear as rows under the grid only while 3D is on.
- **The footer has "All settings"**, opening `/settings/board`.

The analysis overlays (Visualize Suggestions, Evaluation Bars, Board
Evaluation Bar, Evaluation Text) stay in this menu as their own "Analysis"
group, since they draw on the board.

_Alternative, if icons can't be found for every toggle:_ keep labeled rows
but collapse each section to an expansion item with only "Pieces" open by
default.

### 4. Contextual gears render the same sections

The Openings, Engines, Notes, Saved Results, Database Moves and Top Games
gears each render the matching registry section(s) with `SettingsSection`,
and end with a link to that section in Settings. Behavior and placement
don't change, but the rows are identical everywhere. Today's duplicates,
like the suggestion display options under both Engines and Saved Results,
become the same component instead of two copies.

### 5. Clean-ups found along the way

- Drop the unused `showAllBranches` and `showMove` entries from
  `Preferences.vue`'s `props`, which go away with the file.
- `hideAnalysisNotes` has no references. Remove it from the defaults, or
  register it if it's meant to be used (owner to confirm).
- `hasChat` is never set through `SET_UI`. Leave it, classified as `never`.

## Order of work

1. Registry, `SettingRow`, `SettingsSection`, and the Settings dialog with
   categories, search and deep links, replacing UI Preferences.
2. Settings sync, on top of the registry. The sync plan's Task 1 classifies
   from the registry, and its Task 5 puts the choices in Account & Sync
   instead of at the end of Preferences.
3. The compact board menu.
4. Contextual gears rendered from the registry.

Steps 3 and 4 don't depend on sync and can run in parallel with it.

## Left to the builder

- The icon for each board toggle. The `src/icons.js` registry is the place
  to add any that are missing.
- Exact category and section icons.
- Search scoring and debounce, as long as results stay grouped by category
  in category order.
- How the Settings dialog remembers the last category, within one session.

## Owner decisions this proposal needs

1. The category and section table above.
2. The board menu: an icon grid (my recommendation) or collapsible labeled
   sections.
3. Whether `hideAnalysisNotes` should be removed or wired up.
