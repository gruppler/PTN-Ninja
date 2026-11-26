# Embed: quiet host commands, and hiding the analysis toggle

Two embed options asked for by a site that hosts PTN Ninja as its puzzle board
and draws its own analysis UI. Each is its own PR into `dev`.

## 1. `echoHostCommands`

### Why

Every outgoing message leaves through `postMessage()` in `src/utilities.js`,
called from the Vuex mutations. A mutation can't tell whether the host or the
person at the board caused it, so a host's own `APPEND_PLY`, `LAST`,
`SET_UI`, `HIGHLIGHT_SQUARES` and so on come straight back to it, and each URL
setting arrives as a `SET_UI` on load. A host has to keep counters to tell its
own commands from the player's moves.

### Goals

- A host can treat every `INSERT_PLY`, `UNDO`, `SET_UI` and navigation
  message as something the person at the board did.
- Off by default (decided after the first draft: every known host filters the
  echoes out). A host that relies on them asks for them back. playtak-ui
  relied on the `DELETE_PLY` echo and was changed first.

### Non-goals

- A `PLY_PLAYED` event: with echoes off, `INSERT_PLY` already means that.
- Reply IDs, an `ERROR` message, or silencing settings the app changes by
  itself after loading (going offline, for one).

### Approaches

1. **A gate at `postMessage()`** (chosen). A counter in `utilities.js` is
   raised while a host command or the URL settings are applied; messages are
   dropped while it is raised. One place, and every present and future echo is
   covered.
2. **Tag each mutation with its origin.** About twenty call sites and every
   action in between would have to carry the flag. Rejected.
3. **A separate set of host-only mutations.** Duplicates the game logic.
   Rejected.

### Design

- UI option `echoHostCommands`, default `false`, in `embedUIOptions`, so it
  is set by URL (`&echoHostCommands=true`) or `SET_UI`, and has a row in the
  Embed dialog.
- `utilities.js` gains `withoutEcho(fn)`: raises the counter, runs `fn`, and
  lowers it once whatever `fn` returned has settled (a Vuex `dispatch` returns
  a promise, so an action that awaits before committing stays covered).
- `postMessage()` drops a message while the counter is raised unless its
  action is one the host never sent itself: `GAME_STATE`, `GAME_END`, `READY`,
  `SELECTION`, `UNHANDLED_KEY`, and the `GET_THEME`, `GET_THEMES` and
  `GET_URL` replies. `GAME_STATE` comes from a watcher that can flush while
  the counter is still raised, which is why the list is needed.
- `App.vue` runs the message switch inside `withoutEcho` unless the option
  is on. `Embed.vue` does the same for the URL settings and the first game load,
  reading the option from its own URL state because the store doesn't have it
  yet. Settings the app works out for itself (`boardSize`, `offline`) are
  still sent: they are news to the host, not an echo.
- A person's action that lands while an awaiting host command is still running
  would be dropped as well. The window is one microtask for nearly every
  command; accepted.

## 2. `showToolbarAnalysisBtn`

### Why

A host that draws its own analysis wants the arrows and ghost stones on the
board with nothing else. `showToolbarAnalysis: false` already collapses the
panel and keeps the arrows, but the Show/Hide chevron stays in the corner.

### Approaches

1. **A separate option for the button** (chosen), like `showBoardPrefsBtn` and
   `showBoardTransformBtn`.
2. **Unmount the panel when `showToolbarAnalysis` is false.** That setting is
   the collapsed state the button itself flips, so in every existing embed a
   viewer who collapsed the panel would lose the way to reopen it. Rejected.

### Design

- UI option `showToolbarAnalysisBtn`, default `true`, in `embedUIOptions`.
  It applies in embeds only; the app keeps its button.
- In an embed with the option off, `ToolbarAnalysis` doesn't render the
  button. With the panel collapsed as well, the component renders nothing
  that takes space or shows, and stays mounted, so whatever it does for the
  board overlay carries on.
- With the button hidden and the panel open, the panel shows as usual; the
  host closes it with `SET_UI`.

## Both

- Documented in `readme.md` (URL parameters, and Outgoing Messages for the
  first).
- An e2e spec each, driven from a page on another origin like
  `tests/e2e/embed-api-theme.spec.js`.
- A changelog entry each (`minor`: new embed options).
