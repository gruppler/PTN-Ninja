# Online v1, Plan 1: Core Online Play — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two players can play a complete, untimed online game: create, join by
link, alternate moves that sync live to both players and spectators, and finish
by road, flats, board fill or resignation — with the server as the only writer
of moves, players and results.

**Architecture:** Game logic moves out of the Cloud Functions callables into a
tested module (`functions/lib/`), and the callables become thin wrappers that run
it in Firestore transactions. On the client, the PlayTak "synced main line"
machinery (protected main line + `APPEND_PLY(S)` with a sync anchor) is
generalized so an online game's server main line is applied the same way, and
everything online reads through Vuex getters fed by per-game listeners.

**Tech Stack:** Vue 2, Quasar 1, Vuex, Firebase JS SDK v8 (client); Firebase
Admin 12 + Functions v4 + `tps-ninja` (server); Node's built-in test runner and
`@firebase/rules-unit-testing` against the emulators; Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-10-23-online-v1-design.md`

This is plan 1 of 6. Plans 2–6 (requests, notifications + poke, scratch-line
sync, chat + Enter key, settings sync) are outlined in "Roadmap" at the end and
each gets its own plan once this one lands.

## Global Constraints

- Never attach Vue listeners to a `Game` object or mutate it directly: read
  through Vuex getters, change it through Vuex actions/mutations (`CLAUDE.md`).
- New i18n strings go in the right category of `src/i18n/en-us/index.js`, in
  alphabetical order.
- Run `npx prettier --write` on every changed file; `npx eslint --ext .js,.vue src`
  must pass.
- Emulator ports: auth 9199, firestore 4989, functions 5011, UI 4010.
- Public games: creating or joining requires a registered (non-anonymous)
  account. Guests: private games only.
- A named opponent must be a registered account; their seat is reserved, not
  filled, at creation.
- A new game starts from a TPS; the root branch's main line starts empty.
- `branches/root` has `uid: null` and is written only by Cloud Functions.
- The game doc's `state` (`tps`, `plyIndex`, `hasEnded`, `result`) is the single
  source of truth for progress; `createGame` always writes `state.hasEnded:
false`.
- Resignation results are `0-1` (player 1 resigned) and `1-0` (player 2
  resigned); `R` in a PTN result means a road win, not resignation.
- No landing page or automatically opening dialog; the notification permission
  prompt must not appear on load.
- Local (non-online) PTN Ninja behaves exactly as on master: the existing E2E
  suite must still pass.

## Review Focus

- A player has the game open on two devices and makes a move on one: the other
  must follow without duplicating or dropping a ply (Task 8 test).
- Two moves submitted at nearly the same time for the same turn: exactly one is
  accepted (Task 5 test).
- The opponent moves while I have unsent local moves on my line: my line is kept
  as a branch if it diverges, continued if it matches (Task 8 test).
- A user opens a link to a private game whose seat is reserved for someone else:
  they see a clear refusal, not a broken board (Task 10 test).
- Reloading in the middle of a game, including right after sending a move whose
  response hasn't arrived: the board matches the server (Task 13 test).

---

### Task 1: Test harness for functions and rules

**Files:**

- Modify: `functions/package.json` (devDependencies, scripts)
- Create: `functions/test/helpers.js`
- Create: `functions/test/smoke.test.js`

**Interfaces:**

- Produces: `npm test` in `functions/` runs every `functions/test/*.test.js`
  with Node's test runner inside `firebase emulators:exec --only
firestore,auth --project demo-ptn-ninja`.
- Produces in `functions/test/helpers.js`:

  - `adminDb() -> admin.firestore.Firestore` (emulator-backed)
  - `context(uid, { name, anonymous = false } = {}) -> { auth: { uid, token: { name, firebase: { sign_in_provider: anonymous ? "anonymous" : "password" } } } }`
  - `clearFirestore() -> Promise<void>`
  - `rulesEnv() -> Promise<RulesTestEnvironment>` loading `../firestore.rules`

- [ ] **Step 1:** Add devDependencies `@firebase/rules-unit-testing@^3` and
      `firebase@^10` to `functions/package.json`, and scripts:
      `"test": "npx firebase emulators:exec --only firestore,auth --project demo-ptn-ninja \"node --test test/\""`.
      Run `npm install` in `functions/`.
- [ ] **Step 2: Write the smoke test** `functions/test/smoke.test.js`:
      `test("emulator firestore round-trips a doc")` writes `smoke/a` `{ ok: true }`
      through `adminDb()` and asserts it reads back `{ ok: true }`;
      `test("rules env loads")` asserts `rulesEnv()` resolves.
- [ ] **Step 3:** Run `cd functions && npm test`. Expected: 2 passing.
- [ ] **Step 4: Commit** `git add functions/package.json functions/package-lock.json functions/test && git commit -m "Add emulator-backed tests for functions and rules"`

### Task 2: Server game logic module

**Files:**

- Create: `functions/lib/games.js`
- Test: `functions/test/games.test.js`

**Interfaces:**

- Produces (CommonJS, all pure; `tps-ninja` is ESM, loaded once via
  `loadTak() -> Promise<{ Board, parseTPS }>`):

  - `collectionFor(isPrivate: boolean) -> "gamesPrivate" | "gamesPublic"`
  - `seatOf(game, uid) -> 0 | 1 | 2` (0 = not a player)
  - `isRegistered(context) -> boolean` (`sign_in_provider !== "anonymous"`)
  - `resignResult(seat: 1 | 2) -> "0-1" | "1-0"`
  - `async buildNewGame(input, context, { lookupName }) -> { game, root }` where
    `input = { config: { isPrivate, playerSeat: 1|2|"random", playerName?, opponentName?, scratchboard?, uiOptions... }, tags: { size, komi, opening, flats?, caps?, ... }, tps }`
    and `lookupName(name) -> Promise<uid | null>`
  - `async applyPly(game, root, ply, uid) -> { gameUpdate, rootUpdate }`
  - `checkJoin(game, context, name) -> { seat, playerName }`
  - All validation failures throw `GameError(code, message)` with `code` one of
    `"unauthenticated" | "permission-denied" | "invalid-argument" | "failed-precondition"`.

- [ ] **Step 1: Write the failing tests** in `functions/test/games.test.js`
      (unit tests, no emulator use):
  - `buildNewGame` with `playerSeat: 1`, registered user "alice":
    `game.config.players` is `[aliceUid, null]`, `game.config.isOpen === true`,
    `game.state` equals `{ tps: <input tps>, plyIndex: 0, hasEnded: false, result: "" }`,
    `game.tags.player1 === "alice"`, `root` equals
    `{ parent: null, name: "root", uid: null, plies: [] }` plus timestamps.
  - Seat `"random"` yields seat 1 or 2 and the other is `null`.
  - Public game from an anonymous context throws `GameError` code
    `"permission-denied"`.
  - Private game from a guest uses `config.playerName` (trimmed, 1–30 chars)
    as the tag; empty name throws `"invalid-argument"`.
  - `opponentName: "bob"` with `lookupName` → `bobUid`: seat stays `null`,
    `config.reservedFor === bobUid`, `tags.player2 === "bob"`; unknown name
    throws `"invalid-argument"`.
  - Client-supplied `config.players`, `state.hasEnded`, `tags.result` are
    ignored. Size outside 3–8 or a TPS that `Board` rejects throws
    `"invalid-argument"`.
  - `applyPly`: wrong turn → `"permission-denied"`; illegal ply →
    `"invalid-argument"`; ended game → `"failed-precondition"`; open seat →
    `"failed-precondition"`; a legal move returns `rootUpdate.plies` with the
    new `{ index, ply, uid }` appended and `gameUpdate["state.plyIndex"]`
    incremented; a road-completing move sets `state.hasEnded: true`,
    `state.result` and `tags.result` to the board's result (e.g. `"R-0"`).
  - `checkJoin`: own game → `"failed-precondition"`; no open seat →
    `"failed-precondition"`; reserved for someone else → `"permission-denied"`;
    guest joining public → `"permission-denied"`; ended → `"failed-precondition"`.
  - `resignResult(1) === "0-1"`, `resignResult(2) === "1-0"`.
- [ ] **Step 2:** Run `cd functions && npm test`. Expected: the new tests fail
      (module missing).
- [ ] **Step 3: Implement `functions/lib/games.js`** with the interfaces above.
      Game end comes from `board.isGameEnd` / `board.result` after `doPly`. The
      turn is `parseTPS(game.state.tps).player`.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "Move online game rules into a tested module"`

### Task 3: createGame callable

**Files:**

- Create: `functions/lib/handlers.js`
- Modify: `functions/index.js:158-308` (replace the `createGame` body)
- Test: `functions/test/handlers.test.js`

**Interfaces:**

- Consumes: Task 2's `buildNewGame`, `collectionFor`.
- Produces: `createGameHandler(data, context) -> Promise<{ id, isPrivate }>` in
  `functions/lib/handlers.js` (handlers take `db` from `firebase-admin`), and
  `exports.createGame = functions.https.onCall(createGameHandler)`.
  `GameError` is converted to `functions.https.HttpsError` with the same code
  and message by a shared `wrap(handler)`.

- [ ] **Step 1: Write the failing test** `test("createGame stores game and an
ownerless root branch")`: call `createGameHandler` with a registered context;
      assert `{collection}/{id}` exists with `state.hasEnded === false` and
      `{collection}/{id}/branches/root` has `uid === null` and `plies` `[]`.
- [ ] **Step 2:** Run `npm test`; expected failure.
- [ ] **Step 3:** Implement `createGameHandler`: `lookupName` reads
      `names/{lowercased name}`; game doc and root branch are written in one
      batch. Replace the `createGame` export with the wrapped handler.
- [ ] **Step 4:** Run `npm test`; expected pass.
- [ ] **Step 5: Commit** `git commit -m "Validate new online games on the server"`

### Task 4: joinGame callable and account cleanup

**Files:**

- Modify: `functions/lib/handlers.js`, `functions/index.js:310-362`, `functions/index.js:562-601`
- Test: `functions/test/handlers.test.js`

**Interfaces:**

- Consumes: `checkJoin`, `collectionFor`.
- Produces: `joinGameHandler({ id, isPrivate, playerName }, context) -> Promise<{ seat }>`
  run in `db.runTransaction`; sets `config.players[seat-1]`,
  `tags.player{seat}` (registered: `context.auth.token.name`; guest: trimmed
  `playerName`), `config.isOpen: false`, `config.reservedFor: null`.

- [ ] **Step 1: Write the failing tests:** a second registered user joins an
      open public game and gets seat 2 with their name; a guest can't join a public
      game; a reserved seat refuses another user and accepts the reserved one; two
      concurrent joins (`Promise.all`) leave exactly one player in the seat and one
      rejected promise.
- [ ] **Step 2:** Run `npm test`; expected failure.
- [ ] **Step 3:** Implement `joinGameHandler` and export it as `joinGame`.
      In `deleteInactiveUser`, also check `gamesPrivate`, and delete the user's
      `names/{name}` doc (found by `where("uid", "==", uid)`) with the account.
- [ ] **Step 4:** Run `npm test`; expected pass.
- [ ] **Step 5: Commit** `git commit -m "Join online games in a transaction"`

### Task 5: insertPly and resign callables

**Files:**

- Modify: `functions/lib/handlers.js`, `functions/index.js:364-518`
- Test: `functions/test/handlers.test.js`

**Interfaces:**

- Consumes: `applyPly`, `resignResult`, `seatOf`.
- Produces:

  - `insertPlyHandler({ id, isPrivate, ply, plyIndex }, context) -> Promise<{ plyIndex }>`
    — `plyIndex` is the main-line length the client expects before its move;
    a mismatch throws `"failed-precondition"` ("Out of sync") so a stale
    client can't append to the wrong position.
  - `resignHandler({ id, isPrivate }, context) -> Promise<{ result }>`
  - Both run in `db.runTransaction`, reading the game and `branches/root`.
  - Callable names stay `insertPly` and `resign`; the client argument name
    changes from `gameId` to `id`.

- [ ] **Step 1: Write the failing tests:** alternating legal moves append to
      `branches/root.plies` and advance `state.tps`; a road win ends the game and a
      further move is refused with `"failed-precondition"`; a wrong `plyIndex` is
      refused; two concurrent `insertPlyHandler` calls for the same turn result in
      exactly one appended ply; resigning as player 1 writes `state.result` and
      `tags.result` `"0-1"`; resigning twice is refused.
- [ ] **Step 2:** Run `npm test`; expected failure.
- [ ] **Step 3:** Implement both handlers and replace the exports.
- [ ] **Step 4:** Run `npm test`; expected pass.
- [ ] **Step 5: Commit** `git commit -m "Apply moves and resignations in transactions and detect game end"`

### Task 6: Firestore rules and indexes

**Files:**

- Modify: `firestore.rules` (rewrite the game sections), `firestore.indexes.json`
- Test: `functions/test/rules.test.js`

**Interfaces:**

- Consumes: Task 1's `rulesEnv()`.
- Produces rules (spec "Access"):
  - `gamesPublic/{id}`: `get, list` if signed in; no client `create`/`update`;
    `delete` by `createdBy` while `config.isOpen`.
  - `gamesPrivate/{id}`: `get` if a player, or while `config.isOpen` and
    (`config.reservedFor == null` or `== auth.uid`); `list` only with
    `where("config.players", "array-contains", auth.uid)`; no client writes;
    `delete` as above.
  - `{games}/{id}/branches/root`: readable whenever the game is; no client
    writes. Other branches: deny all (Plan 4 opens them for their owner).
  - `playerChat`, `spectatorChat`, `analyses`, `puzzles`: deny all.
  - `users/{uid}/{document=**}`: read/write when `auth.uid == uid`.
  - `names/{name}`: `get` if signed in; `create` by the owner once; no updates.
- Indexes for: `gamesPublic` (`config.isOpen` ==, `createdAt` desc),
  (`state.hasEnded` ==, `updatedAt` desc), and for both collections
  (`config.players` array-contains, `updatedAt` desc).

- [ ] **Step 1: Write the failing rules tests**, one `test()` per rule above,
      each with its allowed and denied case (e.g. the creator can't `update`
      `branches/root`; an opponent can `get` it; a stranger can't `get` a full
      private game; a stranger can `get` an open, unreserved private game; a
      reserved private game is readable only by its reserved user; a user can't
      read another user's `users/{uid}`).
- [ ] **Step 2:** Run `npm test`; expected failures.
- [ ] **Step 3:** Rewrite `firestore.rules` and add the indexes.
- [ ] **Step 4:** Run `npm test`; expected pass.
- [ ] **Step 5: Commit** `git commit -m "Lock online games to server writes in Firestore rules"`

### Task 7: Client store foundations and defects

**Files:**

- Modify: `src/utilities.js` (`LISTEN_DOC`, `LISTEN_COLLECTION`)
- Modify: `src/store/online/{actions,getters,mutations,state}.js`
- Modify: `src/boot/firebase.js:25-30` (remove boot-time `messaging.getToken`)
- Test: `tests/e2e-online/store.spec.js`, `tests/playwright.online.config.js`, `tests/e2e-online/helpers.js`

**Interfaces:**

- Produces:

  - `LISTEN_DOC`/`LISTEN_COLLECTION` key `state.listeners` by
    `listenerPath || path`, so `UNLISTEN(listenerPath)` stops them.
  - `online/INIT` registers `onAuthStateChanged` once (returns the same
    promise on later calls).
  - Getter `online/player` returns the user's seat in the current game (0 when
    not seated); `online/mySeat` is the same value read from
    `currentGame.game.config.players`, and later tasks use `mySeat`.
  - Online state: `currentGame: { id, isPrivate, game, root } | null`
    (plain data from the listeners, frozen); mutation
    `SET_CURRENT_GAME(payload)`, `CLEAR_CURRENT_GAME()`.
  - Getters: `online/currentState` (`currentGame.game.state` or `null`),
    `online/hasEnded`, `online/mySeat`, `online/isMyTurn`
    (`parseTPS(currentState.tps).player === mySeat && !hasEnded`),
    `online/syncedPlyCount` (`currentGame.root.plies.length`).
  - E2E helpers in `tests/e2e-online/helpers.js`:
    `createAccount(name) -> { email, password, uid }` (auth emulator REST
    `accounts:signUp`, then `names/{name}` via the Firestore emulator REST),
    `signIn(page, account)`, `signInAsGuest(page)`,
    `openApp(page)`. `tests/playwright.online.config.js` uses `BASE_URL`
    (default `http://localhost:8082`) and assumes `yarn emulate` is running.

- [ ] **Step 1: Write the failing tests** in `tests/e2e-online/store.spec.js`:
      calling `online/INIT` twice registers one auth listener (count via a probe on
      `auth.onAuthStateChanged`); `UNLISTEN("x")` stops a `LISTEN_DOC` started
      with `listenerPath: "x"` (later writes don't reach state); a guest's
      `online/player` is their seat after creating a private game.
- [ ] **Step 2:** Run `cd tests && npx playwright test -c playwright.online.config.js e2e-online/store.spec.js`; expected failure.
- [ ] **Step 3:** Implement the changes above.
- [ ] **Step 4:** Run the same command; expected pass.
- [ ] **Step 5: Commit** `git commit -m "Fix online store listeners, init and player seat"`

### Task 8: Apply the server main line to the local game

**Files:**

- Modify: `src/Game/mutations.js:15-62` (`hasProtectedMainline`, `getProtectedMainlinePlies`)
- Modify: `src/store/game/getters.js` (`hasProtectedMainlineInState`)
- Modify: `src/store/game/actions.js:1674-1736`, `src/store/game/mutations.js` (`APPEND_PLY`, `APPEND_PLIES`: accept `liveSync` as an alias of `playtakLive`)
- Modify: `src/store/online/actions.js` (`OPEN_GAME`, `LISTEN_GAME`, `UNLISTEN_GAME`, `APPLY_REMOTE`)
- Test: `tests/e2e-online/sync.spec.js`

**Interfaces:**

- Consumes: Task 7 getters and `SET_CURRENT_GAME`.
- Produces:

  - A game with `config.isOnline` has a protected main line whose length is
    `config.syncedMainline` (generic name; PlayTak keeps
    `playtakSyncedMainline`).
  - `online/OPEN_GAME({ id, isPrivate }) -> Promise<{ joinable: boolean }>`:
    loads the game doc and root branch, adds or selects the local game
    (`game/ADD_GAME` with `config.isOnline`, `id`, `isPrivate`,
    `syncedMainline: 0`), then `LISTEN_GAME`.
  - `online/LISTEN_GAME({ id, isPrivate })`: listeners keyed `game:${id}` and
    `root:${id}`; each snapshot dispatches `APPLY_REMOTE`.
  - `online/UNLISTEN_GAME(id)`; `game/SET_GAME` unlistens the previous online
    game.
  - `online/APPLY_REMOTE({ game, root })`: commits `SET_CURRENT_GAME`; mirrors
    players, tags and `state.result` through `game/SET_CONFIG` / `game/SET_TAGS`;
    appends server plies beyond `config.syncedMainline` with
    `game/APPEND_PLIES({ plies, liveSync: { syncedMainlineCount } })` and then
    sets `syncedMainline` to the server count.

- [ ] **Step 1: Write the failing tests** in `tests/e2e-online/sync.spec.js`
      (two browser contexts, Alice and Bob, public game): each move made by one
      appears on the other's board within 5s; a third context (spectator) sees the
      same main line; Alice's game open in two tabs stays in step without
      duplicated plies; when Bob plays a move different from Alice's unsent local
      continuation, Alice's continuation becomes a branch and the main line matches
      the server; when Bob plays the same move, Alice's continuation stays on the
      main line.
- [ ] **Step 2:** Run the online E2E for `sync.spec.js`; expected failure.
- [ ] **Step 3:** Implement the interfaces above.
- [ ] **Step 4:** Run `sync.spec.js` and the full local suite
      (`cd tests && npx playwright test`); expected pass, PlayTak specs included.
- [ ] **Step 5: Commit** `git commit -m "Sync online games' main line through the protected main line"`

### Task 9: Making and sending moves

**Files:**

- Modify: `src/store/ui/state.js` (defaults `onlineSendMode: "auto"`, `onlineAutoSendTipShown: false`)
- Modify: `src/store/online/{actions,getters,mutations,state}.js` (`SEND_PLY`, send status)
- Modify: `src/store/game/actions.js` (`SELECT_SQUARE` gate)
- Modify: `src/components/controls/GameplayControls.vue` (mode control, Submit, Undo)
- Modify: `src/components/PTN/Ply.vue` (unsent dimming, failed icon)
- Modify: `src/i18n/en-us/index.js` (strings below), `src/icons.js` (`auto_send`, `send_failed`)
- Test: `tests/e2e-online/send.spec.js`

**Interfaces:**

- Consumes: `online/isMyTurn`, `online/syncedPlyCount`, `online/mySeat`.
- Produces:

  - Getter `online/unsentPly` — the first ply past the synced main line on the
    current line, if it belongs to `mySeat`; else `null`.
  - Getter `online/blocksInput` — true when the game is online, the player is
    seated, `config.scratchboard` is off, and there is an unsent ply (or it
    isn't my turn). `game/SELECT_SQUARE` returns early when it's true.
  - `online/SEND_PLY() -> Promise<void>`: calls `insertPly` with
    `{ id, isPrivate, ply: unsentPly.text, plyIndex: syncedPlyCount }`; sets
    `sendStatus[plyIndex]` to `"sending"`, clears it when the server main line
    reaches it, sets `"failed"` on error and shows the error. Getter
    `online/sendStatus(plyIndex) -> "sending" | "failed" | null`.
  - In auto-send mode, a watcher in `GameplayControls` dispatches `SEND_PLY`
    when `unsentPly` changes while `isMyTurn`.
  - `Ply.vue` adds class `unsent` (dimmed like local-only lines) to plies past
    `syncedPlyCount` in an online game, and a `send_failed` icon button that
    dispatches `SEND_PLY` when its status is `"failed"`.
  - Footer: the slot after Resign shows the mode control (`auto_send` icon,
    hint "Auto-send") in auto mode or the Submit button in submit mode; a
    mode toggle beside it switches `ui.onlineSendMode`. Undo removes the last
    unsent ply and is disabled when there is none.
  - One-time tip after the first auto-sent move: `$q.notify` with
    `"hint.autoSend"`, then `ui.onlineAutoSendTipShown = true`.
  - Strings: `"Auto-send"`, `"Submit"` (root, alphabetical); `hint.autoSend`:
    "Moves are sent as soon as you make them. Switch to Submit to confirm each
    move first."

- [ ] **Step 1: Write the failing tests** in `tests/e2e-online/send.spec.js`:
      auto mode sends on placement (opponent sees it); submit mode doesn't send
      until Submit is pressed; with scratchboard off, a second ply is refused until
      the first is sent; with scratchboard on, further plies are allowed and stay
      dimmed (`.unsent`); a refused move (simulate by advancing the server from
      another context first) is marked failed and Retry succeeds after resync;
      Undo removes only unsent plies.
- [ ] **Step 2:** Run `send.spec.js`; expected failure.
- [ ] **Step 3:** Implement the interfaces above.
- [ ] **Step 4:** Run `send.spec.js`; expected pass.
- [ ] **Step 5: Commit** `git commit -m "Send online moves automatically or on submit"`

### Task 10: Links, joining and loading

**Files:**

- Modify: `src/store/ui/getters.js:211-219` (`url`)
- Modify: `src/layouts/Main.vue` (route `gameID` handling at ~1225, the `currentGameId`/`user` join watchers at ~1177-1190)
- Modify: `src/dialogs/JoinGame.vue` (name field for guests), `src/store/online/actions.js` (`JOIN_GAME` via Vuex only; `CREATE_GAME` payload)
- Modify: `src/dialogs/PlayOnline.vue` (sends the new `createGame` input)
- Modify: `src/dialogs/LoadOnline.vue` (`ok()` passes each game's `isPrivate`)
- Modify: `src/router/routes.js` (remove `/a/` and `/z/`), `src/components/controls/ShareButton.vue` (Online submenu keeps only Play Online)
- Test: `tests/e2e-online/links.spec.js`

**Interfaces:**

- Consumes: `online/OPEN_GAME`.
- Produces:

  - `ui/url(game)` returns `${origin}/g/${id}` or `${origin}/p/${id}` for
    online games.
  - `Main.vue` dispatches `online/OPEN_GAME({ id: gameID, isPrivate: $route.name === "privateGame" })`
    for those routes; when it resolves `joinable` and the id isn't in
    LocalStorage `dismissedJoinPrompts`, it opens the join dialog once.
    Dismissing adds the id. No watcher on `user` opens it.
  - `online/CREATE_GAME({ config, tags, tps }) -> Promise<{ id, isPrivate }>`
    calls `createGame` with Task 2's input shape (the current position's TPS,
    `config.playerName` for guests, `config.opponentName`, `config.scratchboard`)
    and then `OPEN_GAME`. Server error messages are shown as given, not
    replaced with a generic one.
  - `online/JOIN_GAME({ id, isPrivate, playerName })` calls `joinGame` and lets
    the listeners update the game; it no longer assigns to `$game`. JoinGame.vue
    asks a guest for their name.
  - A failed `OPEN_GAME` (missing, or forbidden by rules) shows
    `error["Game unavailable"]` and leaves the current game in place.

- [ ] **Step 1: Write the failing tests:** Share > Copy > Full Link on an
      online game gives `/g/<id>` (public) / `/p/<id>` (private); opening that URL
      in a fresh context loads the game; the join prompt appears once and not after
      dismissal and reload; a link to a private game reserved for Bob, opened by
      Carol, shows the "Game unavailable" error; joining by link fills the seat on
      both clients.
- [ ] **Step 2:** Run `links.spec.js`; expected failure.
- [ ] **Step 3:** Implement the interfaces above.
- [ ] **Step 4:** Run `links.spec.js`; expected pass.
- [ ] **Step 5: Commit** `git commit -m "Open online games from their links and join once"`

### Task 11: Game lists and "Mine"

**Files:**

- Modify: `src/components/controls/GameTable.vue` (filters, queries at ~400-565)
- Modify: `src/store/online/actions.js` (`LISTEN_MY_GAMES`)
- Modify: `src/i18n/en-us/index.js` (`Mine`)
- Test: `tests/e2e-online/lists.spec.js`

**Interfaces:**

- Produces:

  - Filters: `mine`, `open`, `ongoing`, `recent` (analyses and puzzles removed).
    Ongoing/Recent query `state.hasEnded` (`false` / `true`), ordered by
    `updatedAt` desc.
  - `online/LISTEN_MY_GAMES()` listens to both collections with
    `config.players array-contains uid`, merged and sorted ongoing first, then
    `updatedAt` desc.
  - The default filter is `mine` when that list is non-empty on first load,
    otherwise `open`.

- [ ] **Step 1: Write the failing tests:** after Alice and Bob play, both see
      the game under Mine (ongoing first); after it ends it moves under Recent and
      out of Ongoing; Mine is the default for Alice and Open for a new user.
- [ ] **Step 2:** Run `lists.spec.js`; expected failure.
- [ ] **Step 3:** Implement the interfaces above.
- [ ] **Step 4:** Run `lists.spec.js`; expected pass.
- [ ] **Step 5: Commit** `git commit -m "List my online games and fix ongoing and recent filters"`

### Task 12: Game end on the client

**Files:**

- Modify: every online `config.hasEnded` read — `src/layouts/Main.vue`
  (`hasAnalysis`, `isOnlinePlayer`), `src/components/controls/{GameplayControls,NavControls,PTNTools,ShareButton}.vue`,
  `src/dialogs/GameInfo.vue`, `src/components/controls/GameInfo.vue`
- Test: `tests/e2e-online/end.spec.js`

**Interfaces:**

- Consumes: `online/hasEnded`.
- Produces: those components read `online/hasEnded`; `hasAnalysis` is
  `!isOnline || hasEnded`; Resign is disabled once the game ends; the result
  appears in the move list (from `tags.result`, via Task 8's mirroring).

- [ ] **Step 1: Write the failing tests:** after a road win both players see
      the result, play mode switches off (analysis tabs appear), and the board
      accepts no move; after a resignation the same holds with `0-1`/`1-0`.
- [ ] **Step 2:** Run `end.spec.js`; expected failure.
- [ ] **Step 3:** Replace the reads.
- [ ] **Step 4:** Run `end.spec.js`; expected pass.
- [ ] **Step 5: Commit** `git commit -m "End online games on every client from the server state"`

### Task 13: Full two-player flow and regression run

**Files:**

- Test: `tests/e2e-online/flow.spec.js`

- [ ] **Step 1: Write the test** `flow.spec.js`: Alice (registered) creates a
      public game; Bob joins from the Open list; they alternate moves to a road
      win; Bob reloads mid-game, including immediately after sending a move, and
      his board matches the server; a guest creates a private game and Alice joins
      by link; Alice resigns; both games appear correctly in each player's Mine.
- [ ] **Step 2:** Run `cd tests && npx playwright test -c playwright.online.config.js`; expected: all online specs pass.
- [ ] **Step 3:** Run `cd functions && npm test` and the local suite
      `cd tests && npx playwright test`; expected: all pass.
- [ ] **Step 4: Commit** `git commit -m "Add the two-player online flow test"`

---

## Roadmap (plans 2–6, written after plan 1 lands)

Each builds on plan 1's handlers, rules tests and online E2E harness.

2. **Draw offers and takeback requests.** `state.request` and the request
   callables (make, withdraw, accept, decline), takeback state recomputation
   (one or two plies), the client shrinking its synced main line on an accepted
   takeback, the Draw button, "Request takeback" on Undo, and the in-place
   request UI.
3. **Push notifications and poke.** FCM device tokens (`users/{uid}/devices`,
   cap 10, refresh on open, 60-day cleanup), the messaging service worker
   alongside Workbox, permission on first create/join, sends from every
   handler event, foreground handling, and the `poke` callable and button.
4. **Scratch-line sync.** Rules for player-owned branches, debounced writes of
   the player's local lines, live listeners on their other devices, and
   re-anchoring when the main line advances.
5. **Chat and the Enter key.** Player chat and spectator chat (rules fixes,
   loading, sending, listening, the Chat tab for both), and Enter-to-send in
   notes and chat.
6. **Settings sync.** `users/{uid}.settings`, the synced key list (for owner
   review), write-through and sign-in replacement.
