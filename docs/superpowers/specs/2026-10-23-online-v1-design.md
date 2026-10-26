# Online Play v1 — Design

Branch: `online` (worktree `../PTN-Ninja-online`). Date: 2026-10-23.

This supersedes the "Current State" and phase lists in `ONLINE_GAMEPLAY_PLAN.md`,
`ONLINE_GAMEPLAY_SUMMARY.md` and `PHASE1_COMPLETE.md`, which are out of date.
The schema in `ONLINE_GAMEPLAY_PLAN.md` ("Database Schema") still applies except
where this document changes it.

## Intent

Two people can play a complete game of Tak against each other through PTN Ninja,
asynchronously, from any of their devices. Each player can take as long as they
like between moves (correspondence style), so the app has to tell them when it's
their turn even when it isn't open. Their preferences follow them between
devices.

This is the first release of online play. It sets up the "play" half of a later
Play/Analyze split, so it should leave the codebase with a clear notion of "the
user is a seated player in this game" that local bot play can reuse.

## Goals (the release is done when all of these work)

1. **Move sync.** Both players and any spectators see every move as soon as the
   server accepts it, including after a reload or on another device.
2. **Game end.** A game ends on a road, flat win, board fill, resignation, or an
   accepted draw. The
   server records the result; no move is accepted afterwards; every client shows
   the game as over and turns analysis back on for it.
3. **Server authority.** Only the server writes moves, players, and results.
   Firestore rules allow nothing else.
4. **Links.** Every online game has a URL that opens it on any device: public
   games for anyone, private games for their players (and for the invitee while
   the seat is open). Sharing produces that URL.
5. **My games.** A signed-in user can see and reopen every game they're seated
   in, ongoing and finished.
6. **Settings sync.** A user's preferences follow their account across devices.
7. **Push notifications.** A player is notified when they're invited to a game,
   when it becomes their turn, when someone joins their game, when a game they're
   in ends, when the opponent makes or answers a draw or takeback request, and
   when the opponent sends a chat message.
8. **Small fixes** listed under "Known defects" below.
9. **Enter key.** In both the notes input and the chat input, Enter sends and
   Shift+Enter inserts a newline.
10. **Chat.** The two players can message each other during and after a game,
    and spectators of a public game have their own chat that the players can't
    see while the game is in progress.
11. **Draw offers.** A player can offer a draw; the opponent can accept or
    decline; an accepted offer ends the game as a draw.
12. **Takeback requests.** A player can ask to take back their last move; the
    opponent can accept or decline; an accepted request removes the moves on the
    server and every client follows.

## Non-goals (deferred, not built in this release)

- Clocks and time control. Games are untimed.
- Editing or deleting chat messages **(my call)**.
- Online analyses and puzzles. Their dialogs are stubs; hide their entry points
  (Share > Online > New Analysis / New Puzzle, the Analyses and Puzzles filters,
  the `/a/` and `/z/` routes) until they're built.
- Rating.
- Syncing notes to the server (notes stay local).
- Cleanup of abandoned games.
- The Play/Analyze routing question (see "Open questions").
- Local or offline bot play.

## Anti-goals (would make the release a failure even if it "works")

- Any client able to write or rewrite moves, players, or results directly.
- Anyone other than the two players reading their chat while the game is in
  progress, or either player reading the spectators' chat before it ends.
- The notification permission prompt appearing on page load, or before the user
  has done something online (creating or joining a game).
- A landing page or any dialog that opens automatically on startup.
- Breaking local (offline) PTN Ninja: every existing non-online flow must behave
  as it does on master.

## Constraints

- Project rules (`CLAUDE.md`): never attach Vue listeners to a `Game` object or
  mutate it directly; read through Vuex and change it through Vuex
  actions/mutations. New i18n strings go in the right category, alphabetically.
  Run `npx prettier --write` on changed files.
- Vue 2, Quasar 1, Vuex, Firebase JS SDK v8 (namespaced API) on the client;
  Firebase Admin + Functions v4 on the server (`functions/index.js`).
- Local development uses the emulators (`yarn emulate`, ports in `firebase.json`:
  auth 9199, firestore 4989, functions 5011, UI 4010), with seed data in `db/`.
- Server-side Tak logic comes from `tps-ninja` (`Board`, `parseTPS`), already used
  by `insertPly`.

## Decisions

Items marked **(my call)** were chosen by Claude during design, not by the owner;
the owner should confirm or override them. Everything else was decided by the
owner.

### Scope of accounts and data

- No production online data or deployed online client needs to stay compatible
  (master's client has the online store disabled). Master's `games`/`moves`
  collections, rules and callables are replaced outright; no migration.
- A new online game starts from a position (a TPS, normally the initial one).
  Moves played before that position are not part of the online game; the root
  branch's main line starts empty. `createGame` validates the TPS.
- Anonymous guests can create and join **private** games and receive
  notifications; public games require a registered account. A guest's name is
  the one they type when creating or joining.
- A named opponent must be a registered account. The seat is reserved for them —
  they are not seated at creation — and they take it by opening the game's link
  and joining, like anyone else. Only they can take that seat.

### Data and authority

- The game document's `state` is the single source of truth for game progress
  (`tps`, `plyIndex`, `hasEnded`, `result`). The client mirrors it into the local
  game through a Vuex action; nothing reads `config.hasEnded` for online games any
  more. `createGame` always writes `state.hasEnded: false` so `!=` queries match.
- `branches/root` is server-owned: written only by Cloud Functions, with no `uid`
  that grants a client write. Clients never create or edit branches in v1
  (scratchboard lines stay local).
- `insertPly`, `joinGame` and `resign` run in Firestore transactions.
- `insertPly` rejects moves when the game has ended or has no opponent, applies
  the ply with `tps-ninja`, and if the board reports a result, writes
  `state.hasEnded`, `state.result` and `tags.result` in the same transaction.
- `createGame` derives players from `context.auth` and validates every other
  client-supplied field (size, komi, opening, piece counts, starting TPS,
  privacy, seat choice, named opponent) instead of storing them as given.

### Draw offers and takeback requests

- One pending request per game at a time, stored as `state.request`:
  `{ type: "draw" | "takeback", player, plyIndex, createdAt }`. It replaces the
  unused `state.undoRequest` field **(my call)**.
- Everything goes through callables, in transactions: making a request,
  withdrawing it (the requester), and accepting or declining it (the opponent).
  Clients never write `state.request` directly.
- A pending request is cleared when either player makes a move, when the game
  ends, or when the requester withdraws it. Declining just clears it
  **(my call)**.
- Either player may offer a draw at any time during the game, on either turn
  **(my call)**. Accepting ends the game with result `1/2-1/2` (in `state.result`
  and `tags.result`).
- A takeback undoes the requester's last move: one ply if the opponent hasn't
  replied yet, two if they have, so it becomes the requester's turn again
  **(my call)**. Only possible while the requester has a move on the main line
  and the game hasn't ended. Accepting removes those plies from
  `branches/root`, recomputes `state` by replaying the remaining main line, and
  every client follows through its listeners.
- In play mode the footer's Undo first removes moves that haven't been sent.
  When there are none, it becomes "Request takeback" **(my call)**. A "Draw"
  button sits next to Resign. When the opponent has a pending request, the
  player sees it in the game (with Accept and Decline) without a dialog opening
  on its own **(my call — exact UI left to the builder)**.

### Chat

- Player chat lives in `{games}/{id}/playerChat/{messageID}`:
  `{ text, uid, player, plyIndex, createdAt }`. `plyIndex` is the main-line length
  when the message was sent, so the existing Chat panel can show messages by
  move.
- Clients write messages directly (no callable); the rules check that the writer
  is a player in the game, `uid`, `player` and `createdAt` (server timestamp)
  are truthful, and `text` is a non-empty string of at most 500 characters
  **(my call)**. Messages can't be edited or deleted.
- Readable by the two players. After the game ends, readable by anyone who can
  read the game **(my call)**.
- The Chat tab appears for online games in play mode, as now; it loads the
  messages and listens for new ones through Vuex like the rest of the game.

### Spectator chat

- Public games only (only players can read a private game, so it has no
  spectators). Stored in `gamesPublic/{id}/spectatorChat/{messageID}` with the
  same fields and limits as player chat, except `player` is absent.
- Readable by any signed-in user who isn't a player in the game; once the game
  ends, readable by the players too. Writable by signed-in non-players only
  **(my call)**. Guests may read it but not write, since public games need a
  registered account **(my call)**.
- These are the existing intent of `firestore.rules`; the rules just need fixing
  (see "Known defects").
- A spectator's Chat tab shows spectator chat. After the game ends, everyone can
  see both chats; how the tab presents the two is left to the builder.
- Spectator messages never trigger notifications **(my call)**.

### Access (Firestore rules)

- Public games and their root branch: readable by any signed-in user
  (including anonymous); writable by no client.
- Private games: readable by their players. While the second seat is open, the
  game is also readable by anyone who has its ID — the link is the invitation —
  **(my call)**. If the creator named an opponent, only that account may take the
  seat (and read the game while it's open); otherwise the first person with the
  link takes it.
- Public games: creating or joining requires a registered (non-anonymous)
  account.
- Listing private games: only one's own (`config.players` contains the uid).
- Clients may delete their own game only while it's open (unchanged).
- `users/{uid}` and its subcollections: read and write by that user only.
- Player chat and spectator chat: as described under "Chat" and "Spectator
  chat". Analyses and puzzles: deny everything until those features ship.

### Client sync

- Opening an online game (from a list, a URL, or after creating/joining) loads the
  game doc and root branch and replays the main line into a local `Game` through
  Vuex. Live listeners on both apply later changes the same way. Listeners are
  keyed by game, cleaned up when the game is closed or another is opened.
- "Is it my turn" comes from the server state (`state.tps` turn vs. my seat), not
  from the local board position.
- Sending a move: in normal mode, completing a ply that extends the server's main
  line by one move for my seat sends it immediately. In scratchboard mode, Submit
  sends the first ply of the current line past the server's main line. A rejected
  move is removed locally and the error is shown.
- Undo in play mode only removes moves that haven't been sent. It's disabled once
  everything local is on the server.

### Links and joining

- Canonical URLs: `/g/:id` for public games, `/p/:id` for private ones. Share >
  Copy > Full Link produces these for online games.
- The join prompt appears once when a user opens a joinable game they aren't
  seated in — not on auth state changes, and not again after they dismiss it for
  that game **(my call)**.

### My games

- A "Mine" filter in the online games list shows every game the user is seated in
  across both collections, newest first, ongoing ones first **(my call)**. It's the
  default filter when the user has any games **(my call)**.

### Settings sync

- Stored at `users/{uid}` as a `settings` map plus `settingsUpdatedAt`.
- Synced for every signed-in user, including anonymous guests (a guest has one
  device, so it's harmless, and upgrading the account keeps them) **(my call)**.
- What syncs: user preferences in `src/store/ui/state.js` — theme, board and
  notation display options, notification preferences, analysis/engine
  preferences. Not synced: anything per-device or per-session (drawer
  open/closed, panel widths, fullscreen, layout orientation, window state,
  current tab) **(my call; the builder makes the exact list and the owner reviews
  it)**.
- Conflict rule: on sign-in, if the server has settings, they replace the
  device's; after that, every change is written through. Last write wins
  **(my call)**.

### Push notifications

- Firebase Cloud Messaging. Each device's token is stored at
  `users/{uid}/devices/{token}` with a timestamp; invalid tokens are deleted when
  a send fails.
- Events: you were invited to a game (named as its opponent), your turn
  (opponent moved), someone joined your game, a game you're in ended (result in
  the text), the opponent offered a draw or asked for a takeback, the opponent
  answered your request, and a new chat message. The tapped notification opens
  the game's URL. Chat notifications for one game are collapsed so a burst of
  messages produces one notification **(my call)**.
- Permission is requested the first time the user creates or joins an online
  game, and from the existing "Game Notifications" setting (`ui.notifyGame`) —
  never at startup. The current boot-time `getToken` call is removed.
- Turning off "Game Notifications" stops notifications for that device (delete
  its token) **(my call)**.
- While the app is open and showing that game, no system notification is shown;
  otherwise the app shows an in-app notification **(my call)**.
- Background delivery uses a messaging service worker; it must coexist with the
  existing PWA (Workbox) service worker. The builder decides between importing
  the messaging handler into the Workbox worker and registering a separate one.

## Known defects to fix (from the 2026-10-23 audit)

- `online/player` getter uses `this` in an arrow function and always returns 0
  (`src/store/online/getters.js`).
- `online/INIT` registers another `onAuthStateChanged` handler on every call.
- `LISTEN_DOC` keys listeners by path rather than `listenerPath`, so unlisten
  calls miss and listeners leak; branch state is keyed by branch id, so games
  overwrite each other.
- `isMyTurn` reads the turn after the current ply (replaced by the server-state
  rule above).
- The `/join` watcher on `user` in `Main.vue` fires on every auth change.
- `Main.vue` calls `online/LOAD_GAME` with an id instead of `{ id, isPrivate }`;
  `/p/` never passes `isPrivate`.
- `ui/url` builds `/game/:id`, a removed route.
- `LoadOnline.ok()` always loads from the public collection.
- Ongoing and Recent lists filter on `config.hasEnded`.
- `joinGame` stores `undefined` as the player name for anonymous users.
- `accountcleanup` leaves the user's `names/{name}` document behind.
- `messaging.getToken` at boot (removed; see notifications).
- Chat: `send()` is commented out, chat is never loaded or listened to, and the
  chat rules are broken: `isPlayer(game, "games")` and `isSpectator` read a
  nonexistent `games` collection, and `isSpectator` checks
  `config.state.hasEnded` and `config.players` under the wrong paths.

## Verification

- Everything runs against the emulators.
- An end-to-end test drives two browser contexts as two players through:
  create (public with two accounts; private with a guest), join by link, a
  reserved seat refusing the wrong user, alternating moves with live sync,
  reload mid-game, a road win, a resignation, a declined and an accepted
  takeback (both one-ply and two-ply), a declined and an accepted draw, chat in
  both directions (and a spectator unable to read it until the game ends),
  spectator chat (and the players unable to read it until the game ends), and
  the game appearing correctly in both players' "Mine" lists. A third context
  spectates a public game.
- Rules tests (emulator) for every rule above, including the denied cases.
- Function tests for `insertPly` (turn, legality, game end, ended-game rejection,
  concurrent submissions, clearing a pending request), `joinGame` (seat taken,
  named opponent, ended game), `createGame` validation, and the request
  callables (only the opponent can answer, one pending at a time, takeback ply
  counts and state recomputation, draw result).
- The existing E2E suite still passes (local play is unaffected).
- Notifications are checked by hand on a phone and a desktop browser.

## Left to the builder

- How remote plies are applied through Vuex (new actions vs. reusing
  `game/APPEND_PLY` and friends), as long as `CLAUDE.md`'s rules hold.
- The exact list of synced settings (for owner review).
- Service worker arrangement for FCM.
- Notification wording (new i18n strings, alphabetical, in the right category).
- How a pending draw or takeback request is shown in the game, within the
  "no dialog opens on its own" rule.
- How the Chat tab shows player and spectator chat side by side after a game
  ends.
- Index definitions in `firestore.indexes.json` for the new queries.
- Test tooling for functions and rules (e.g. `@firebase/rules-unit-testing`).

## Open questions (not for this release)

- **Play vs. Analyze routing.** "Play" covers anything where the user sends moves
  as one side against another entity — online, local bot, puzzles. "Analyze" is
  spectating and everything else. No landing page and no automatic popup. One
  idea: the existing "+" button / New Game dialog splits into Play and Analyze,
  and play mode becomes a property of the open game rather than a place. Revisit
  once v1 works end to end.
