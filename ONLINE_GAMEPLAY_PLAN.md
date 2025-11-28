# Online Gameplay Implementation Plan

## Current State (Updated Nov 28, 2025)

### Completed ✅
- Firebase authentication working (anonymous + email/password)
- User registration with unique display names
- Basic game creation (CREATE_GAME action)
- Game listing (LISTEN_PUBLIC_GAMES, LISTEN_PRIVATE_GAMES)
- Firestore rules defined for all game types
- Game deletion with subcollection cleanup (onDelete triggers)
- `isGameOver` getter to distinguish official game ended state
- GameTable updated to handle both Game instances and plain objects
- Online game visibility bug fixed (hasEnded was incorrectly set to true)
- Game duplication bug fixed (removed redundant LOAD_GAME call)

### UI/UX Improvements ✅
- **GameplayControls.vue**: New component for online gameplay with:
  - Undo button
  - Resign button (with confirmation dialog)
  - EvalButtons (compact mode with context menu on right-click for small screens)
  - Submit Move button (for scratchboard games)
  - Branch menu button (for scratchboard games)
- **BranchMenuButton.vue**: New reusable component encapsulating branch menu logic
  - Extracted from NavControls and GameplayControls to avoid duplication
  - Contains all branch navigation methods and computed properties
- **NavControls.vue**: Added compact mode prop
  - Hides play button in compact mode
  - Buttons stretch to fill width in compact mode
- **EvalButtons.vue**: Added compact mode
  - Shows Tak button with context menu for Tinue, ?, ! on right-click
  - Hotkeys still work in compact mode
- **Main.vue**: Scrubber moved to PTN drawer in gameplay mode
- Branch menu hotkeys work regardless of which component displays the button

### In Progress ⚠️
- Testing JOIN_GAME flow (cloud function fixed, action updated)
- Testing INSERT_PLY flow (cloud function exists, needs end-to-end testing)

### Recently Completed ✅
- JOIN_GAME action now loads game and sets up listeners after joining
- RESIGN cloud function implemented
- RESIGN action updated to use cloud function

### Not Started ❌
- Server-side move validation
- Real-time move synchronization
- Chat system
- Puzzles and analyses
- Time controls

## Database Schema (from diagram)

### Collections Structure

#### Public Games (`gamesPublic`)
```
gamesPublic/{gameID}
  - name: string
  - config: object
  - tags: object
  - state: object
  - createdBy: uid
  - createdAt: timestamp
  - updatedBy: uid
  - updatedAt: timestamp

  /branches/{branchID}
    - parent: reference
    - name: string
    - player: number
    - plies[]: array
    - uid: string
    - createdAt: timestamp
    - updatedAt: timestamp

  /playerChat/{messageID}
    - text: string
    - replyTo: reference
    - uid: string
    - createdAt: timestamp
    - updatedAt: timestamp

  /spectatorChat/{messageID}
    - text: string
    - replyTo: reference
    - uid: string
    - createdAt: timestamp
    - updatedAt: timestamp
```

#### Private Games (`gamesPrivate`)
Same structure as public games, but with restricted read access

#### Analyses (`analyses`)
```
analyses/{analysisID}
  - gameID: string
  - title: string
  - tags[]: array
  - uid: string
  - createdAt: timestamp
  - updatedAt: timestamp

  /branches/{branchID}
    - parent: reference
    - name: string
    - player: number
    - plies[]: array
    - uid: string
    - createdAt: timestamp
    - updatedAt: timestamp

  /comments/{commentID}
    - text: string
    - replyTo: reference
    - uid: string
    - createdAt: timestamp
    - updatedAt: timestamp
```

#### Puzzles (`puzzles`)
```
puzzles/{puzzleID}
  - name: string
  - type: string
  - tags[]: array
  - uid: string
  - createdAt: timestamp
  - updatedAt: timestamp

  /solutions/{solutionID}
    - title: string
    - isPublished: boolean
    - uid: string
    - createdAt: timestamp
    - updatedAt: timestamp

    /comments/{commentID}
      - text: string
      - replyTo: reference
      - uid: string
      - createdAt: timestamp
      - updatedAt: timestamp

  /comments/{commentID}
    - text: string
    - replyTo: reference
    - uid: string
    - createdAt: timestamp
    - updatedAt: timestamp
```

---

## Phase 1: Database Schema & Converters

### Files to Modify
- `src/utilities.js` - Update converters
- `src/Game/online.js` - Update JSON getters/setters

### Tasks
1. **Update `gameConverter` in utilities.js**
   - `toFirestore()`: Convert Game object to match schema (separate branches subcollection)
   - `fromFirestore()`: Reconstruct Game from Firestore data + branches
   - Handle nested branches subcollection properly

2. **Update `analysisConverter`**
   - Similar to gameConverter but for analyses collection
   - Handle branches and comments subcollections

3. **Update `puzzleConverter`**
   - Handle puzzle-specific fields
   - Support solutions and comments subcollections

4. **Implement JSON serialization in `Game/online.js`**
   - Complete `set jsonBranches()` - parse branches from Firestore format
   - Complete `set jsonBranch()` - parse single branch
   - Complete `set jsonPlayerChat()` - parse player chat messages
   - Complete `set jsonSpectatorChat()` - parse spectator chat messages
   - Add `get JSONState()` and `get JSONTags()` methods (currently referenced but missing)

5. **Update Ply data serialization**
   - Complete `set data()` in `Game/PTN/Ply.js` to deserialize ply data

---

## Phase 2: Game Creation with Existing Moves

### Files to Modify
- `functions/index.js` - Update `createGame` cloud function
- `src/store/online/actions.js` - Update CREATE_GAME action

### Tasks
1. **Update `createGame` cloud function**
   - After creating game document, create `branches/root` subcollection document
   - Store initial plies array in root branch
   - Handle existing game state (TPS, plyIndex, branch)
   - Store each branch as separate document in branches subcollection

2. **Update CREATE_GAME action**
   - Send branches data along with config/state/tags
   - Handle response and open game for editing
   - Set up listeners for the created game

3. **Test creating games with:**
   - Empty board (new game)
   - Existing TPS position
   - Full game with moves
   - Games with multiple branches

---

## Phase 3: Fix Join Game Functionality

### Files to Modify
- `functions/index.js` - Fix `joinGame` cloud function (line 276 bug)
- `src/store/online/actions.js` - Complete JOIN_GAME action

### Tasks
1. **Fix bug in `joinGame` function (line 276)**
   ```javascript
   // Current (WRONG - checks before game is defined):
   if (game.config.players.indexOf(uid)) {

   // Should be:
   const game = gameSnapshot.data();
   if (game.config.players.indexOf(uid) !== -1) {
   ```

2. **Complete JOIN_GAME action**
   - After successful join, load the game
   - Open the game in the UI
   - Set up real-time listeners for game updates
   - Navigate to game view

3. **Update UI to show join status**
   - Show loading state while joining
   - Handle errors (game full, already joined, etc.)
   - Update game list when join succeeds

---

## Phase 4: Real-time Gameplay

### Files to Modify
- `functions/index.js` - Implement `insertPly` cloud function
- `src/store/online/actions.js` - Add MAKE_MOVE action
- `src/store/game/actions.js` - Integrate online moves
- `src/Game/Board/nav.js` - Handle online move submission

### Tasks
1. **Implement `insertPly` cloud function**
   - Validate user is a player in the game
   - Validate it's the player's turn
   - Validate the ply is legal
   - Add ply to the current branch's plies array
   - Update game state (plyIndex, plyIsDone, tps)
   - Notify opponent via push notification
   - Return updated game state

2. **Add MAKE_MOVE action**
   - Call insertPly cloud function
   - Handle optimistic updates
   - Handle errors and rollback if needed

3. **Integrate with Board navigation**
   - When online game, intercept move submission
   - Call MAKE_MOVE instead of local mutation
   - Wait for server confirmation
   - Handle move rejection

4. **Implement move listeners**
   - Listen to branches/root for move updates
   - Update local game state when opponent moves
   - Show notifications for opponent moves

5. **Handle game end**
   - Detect game end conditions
   - Update game state (hasEnded, result)
   - Show game over UI
   - Allow post-game analysis

---

## Phase 5: Branch Management

### Files to Modify
- `functions/index.js` - Add `createBranch`, `updateBranch`, `deleteBranch` functions
- `src/store/online/actions.js` - Add branch management actions
- `src/Game/online.js` - Complete branch serialization

### Tasks
1. **Implement cloud functions**
   - `createBranch`: Create new analysis branch
   - `updateBranch`: Add plies to existing branch
   - `deleteBranch`: Remove branch (only by creator)

2. **Add Vuex actions**
   - CREATE_BRANCH
   - UPDATE_BRANCH
   - DELETE_BRANCH
   - LISTEN_BRANCHES (already partially implemented)

3. **Complete branch serialization**
   - Implement `set jsonBranches()` to parse branch data
   - Handle parent references correctly
   - Reconstruct branch tree structure

4. **UI Integration**
   - Allow creating branches in online games (for ended games/spectators)
   - Show branch tree for analyses
   - Navigate between branches

---

## Phase 6: Chat System

### Files to Modify
- `functions/index.js` - Add `sendMessage` cloud function
- `src/store/online/actions.js` - Add chat actions
- `src/components/` - Create chat UI components

### Tasks
1. **Implement `sendMessage` cloud function**
   - Validate user permissions (player vs spectator)
   - Create message document in appropriate subcollection
   - Support reply threading (replyTo field)
   - Return message ID

2. **Add Vuex actions**
   - SEND_PLAYER_MESSAGE
   - SEND_SPECTATOR_MESSAGE
   - LISTEN_PLAYER_CHAT
   - LISTEN_SPECTATOR_CHAT
   - DELETE_MESSAGE (own messages only)

3. **Create chat UI components**
   - ChatPanel.vue - Main chat container
   - ChatMessage.vue - Individual message
   - ChatInput.vue - Message input field
   - Support threaded replies
   - Show timestamps and user names

4. **Integrate with game view**
   - Show player chat for players
   - Show spectator chat for spectators
   - Real-time message updates
   - Unread message indicators

---

## Phase 7: Puzzle & Solution System

### Files to Modify
- `functions/index.js` - Add puzzle/solution cloud functions
- `src/store/online/actions.js` - Add puzzle actions
- `src/dialogs/PuzzleOnline.vue` - Complete puzzle dialog

### Tasks
1. **Implement cloud functions**
   - `createPuzzle`: Create puzzle post
   - `createSolution`: Submit solution to puzzle
   - `publishSolution`: Make solution public
   - `addComment`: Add comment to puzzle or solution

2. **Add Vuex actions**
   - CREATE_PUZZLE
   - LOAD_PUZZLE
   - CREATE_SOLUTION
   - PUBLISH_SOLUTION
   - ADD_PUZZLE_COMMENT
   - ADD_SOLUTION_COMMENT
   - LISTEN_PUZZLES (already exists)
   - LISTEN_SOLUTIONS
   - LISTEN_PUZZLE_COMMENTS

3. **Complete PuzzleOnline.vue dialog**
   - Form for creating puzzles
   - Puzzle type selection
   - Initial position setup
   - Tags and metadata

4. **Create puzzle viewing UI**
   - PuzzleView.vue - Display puzzle
   - SolutionList.vue - List of solutions
   - SolutionView.vue - View solution details
   - Allow users to submit solutions
   - Show comments and discussions

---

## Phase 8: Analysis Discussions

### Files to Modify
- `functions/index.js` - Add analysis cloud functions
- `src/store/online/actions.js` - Add analysis actions
- `src/dialogs/AnalysisOnline.vue` - Complete analysis dialog

### Tasks
1. **Implement cloud functions**
   - `createAnalysis`: Create analysis post
   - `updateAnalysis`: Update analysis branches
   - `addAnalysisComment`: Add comment to analysis

2. **Add Vuex actions**
   - CREATE_ANALYSIS
   - UPDATE_ANALYSIS
   - LOAD_ANALYSIS
   - ADD_ANALYSIS_COMMENT
   - LISTEN_ANALYSES (already exists)
   - LISTEN_ANALYSIS_COMMENTS

3. **Complete AnalysisOnline.vue dialog**
   - Form for creating analysis posts
   - Link to source game
   - Title and description
   - Initial branches

4. **Create analysis viewing UI**
   - AnalysisView.vue - Display analysis
   - Show multiple branches
   - Allow users to add branches
   - Comment system
   - Upvoting/rating system (future)

---

## Phase 9: Testing & Polish

### Tasks
1. **Test all game types**
   - Create and join public games
   - Create and join private games
   - Play full games with move synchronization
   - Test with multiple players/spectators
   - Test disconnection/reconnection

2. **Test puzzles**
   - Create puzzles
   - Submit solutions
   - Publish solutions
   - Comment on puzzles and solutions

3. **Test analyses**
   - Create analysis posts
   - Add branches
   - Comment on analyses
   - Navigate between branches

4. **Error handling**
   - Network errors
   - Permission errors
   - Invalid moves
   - Concurrent modifications
   - Add proper error messages

5. **Performance optimization**
   - Optimize Firestore queries
   - Add pagination for large lists
   - Implement proper loading states
   - Cache frequently accessed data

6. **UI/UX polish**
   - Loading indicators
   - Error messages
   - Success notifications
   - Smooth transitions
   - Mobile responsiveness

---

## Key Issues to Address

### Missing Features
1. **Move validation**: Server-side move legality checking
2. **Turn management**: Enforce turn order
3. **Time controls**: Optional time limits per move/game
4. **Notifications**: Push notifications for game events
5. **Game history**: Track all moves and states
6. **Undo requests**: Allow players to request undo
7. **Draw offers**: Allow players to offer draws
8. **Resignation**: Allow players to resign

### Security Considerations
1. **Validate all inputs** in cloud functions
2. **Check permissions** before allowing actions
3. **Rate limiting** to prevent abuse
4. **Sanitize user content** (names, messages, etc.)

---

## Dependencies & Prerequisites

### Required
- Firebase SDK v8.10.0 (already installed)
- Firestore security rules (already defined)
- Cloud Functions (already set up)

### Optional Enhancements
- Firebase Cloud Messaging for push notifications
- Algolia for search functionality
- Firebase Storage for game exports

---

## Estimated Timeline

- **Phase 1**: 2-3 days (converters are complex)
- **Phase 2**: 1-2 days
- **Phase 3**: 0.5 days (mostly bug fixes)
- **Phase 4**: 3-4 days (core gameplay)
- **Phase 5**: 2-3 days
- **Phase 6**: 2-3 days
- **Phase 7**: 3-4 days
- **Phase 8**: 2-3 days
- **Phase 9**: 2-3 days

**Total**: ~18-28 days of focused development

---

## Priority Order

### Critical (MVP)
1. Phase 1 - Database converters (blocks everything)
2. Phase 3 - Fix join game (quick win)
3. Phase 4 - Real-time gameplay (core feature)
4. Phase 2 - Games with existing moves (important for testing)

### Important
5. Phase 6 - Chat system (enhances multiplayer)
6. Phase 5 - Branch management (needed for analysis)

### Nice to Have
7. Phase 7 - Puzzles (separate feature)
8. Phase 8 - Analyses (separate feature)
9. Phase 9 - Polish (ongoing)

---

## Testing Strategy

### Unit Tests
- Test converters with various game states
- Test cloud functions with mock data
- Test Vuex actions and mutations

### Integration Tests
- Test full game flow (create → join → play → end)
- Test real-time synchronization
- Test concurrent user actions

### Manual Testing
- Test on multiple devices/browsers
- Test with slow network conditions
- Test with multiple simultaneous games
- Test edge cases (disconnection, etc.)

---

## Next Steps (Priority Order)

### Immediate (Current Sprint)
1. ~~**Test and fix JOIN_GAME**~~ ✅ Completed
   - ~~Fix bug in `joinGame` cloud function (line 276)~~
   - ~~After successful join, load the game and set up listeners~~
   - Navigate to game view (handled by existing UI)

2. **Test INSERT_PLY flow** - Core gameplay functionality
   - Verify cloud function validates moves correctly
   - Test real-time synchronization between players
   - Handle move rejection gracefully

3. ~~**Implement RESIGN cloud function**~~ ✅ Completed
   - ~~Create `resign` cloud function in `functions/index.js`~~
   - ~~Update game state in Firestore (hasEnded, result)~~
   - Notify opponent (TODO)

### Short-term
4. **Real-time move listeners** - Watch for opponent moves
   - Listen to branches/root for move updates
   - Update local game state when opponent moves
   - Show notifications for opponent moves

5. **Game end handling**
   - Detect game end conditions (road, flat win, draw)
   - Update game state properly
   - Show game over UI
   - Allow post-game analysis

### Medium-term
6. **Branch management for ended games/spectators**
7. **Chat system**
8. **Puzzles and analyses**

---

## Recent Changes Log

### Nov 28, 2025 (Evening)
- Fixed JOIN_GAME action to load game and set up listeners after joining
- Created `resign` cloud function in `functions/index.js`
- Updated RESIGN action to use the cloud function instead of local state

### Nov 28, 2025 (Morning)
- Created `BranchMenuButton.vue` to consolidate branch menu logic
- Added compact mode to `NavControls.vue` and `EvalButtons.vue`
- Moved Scrubber to PTN drawer in gameplay mode
- Fixed branch menu hotkeys to work in both NavControls and GameplayControls
- Added context menu for eval buttons (Tinue, ?, !) on right-click in compact mode

### Previous Session
- Fixed online game visibility bug (hasEnded incorrectly set to true)
- Fixed game duplication bug (removed redundant LOAD_GAME call)
- Implemented game deletion with subcollection cleanup (onDelete triggers)
- Added `isGameOver` getter to Game class
- Updated GameTable to handle both Game instances and plain objects
- Created GameplayControls component with undo, resign, eval, submit, branch buttons
