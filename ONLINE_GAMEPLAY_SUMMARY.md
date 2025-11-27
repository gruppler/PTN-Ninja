# Online Gameplay - Quick Reference

## What's Working ✅
- Firebase authentication (anonymous + email/password)
- User registration with unique display names
- Basic game creation
- Game listing (public and private)
- Firestore security rules

## What's Broken ⚠️
- **No actual gameplay**: Can't make moves yet
- **Can't create games with existing moves**: No branch/ply storage implemented

## What's Missing ❌
- Real-time move synchronization
- Branch management for analyses
- Chat system (player & spectator)
- Puzzle creation and solutions
- Analysis discussions
- JSON converters don't match new database schema

## Critical Path to MVP

### 1. Fix Database Converters (BLOCKS EVERYTHING)
**Files**: `src/utilities.js`, `src/Game/online.js`

The current converters don't match your new database schema. You need to:
- Update `gameConverter.fromFirestore()` to load branches from subcollection
- Implement missing `JSONState` and `JSONTags` getters in Game class
- Complete all the TODO items in `Game/online.js`

### 2. Quick Win: Fix Join Game Bug
**File**: `functions/index.js` line 276

```javascript
// WRONG (current):
if (game.config.players.indexOf(uid)) {
  return httpError("invalid-argument", "Already joined");
}
const game = gameSnapshot.data();

// CORRECT:
const game = gameSnapshot.data();
if (game.config.players.indexOf(uid) !== -1) {
  return httpError("invalid-argument", "Already joined");
}
```

### 3. Implement Real-time Gameplay
**Files**: `functions/index.js`, `src/store/online/actions.js`

- Complete `insertPly` cloud function (currently just a stub)
- Add `MAKE_MOVE` Vuex action
- Set up real-time listeners for opponent moves
- Handle turn validation and game state updates

### 4. Support Games with Existing Moves
**File**: `functions/index.js` - `createGame` function

Currently creates empty games. Need to:
- Store branches in `branches/root` subcollection
- Store plies array for each branch
- Handle initial game state (TPS, plyIndex)

## Database Schema Overview

```
gamesPublic/{gameID}
  ├─ branches/{branchID}      (root branch + analysis branches)
  ├─ playerChat/{messageID}
  └─ spectatorChat/{messageID}

gamesPrivate/{gameID}
  ├─ branches/{branchID}
  └─ playerChat/{messageID}

analyses/{analysisID}
  ├─ branches/{branchID}
  └─ comments/{commentID}

puzzles/{puzzleID}
  ├─ solutions/{solutionID}
  │   └─ comments/{commentID}
  └─ comments/{commentID}
```

## Key Files to Understand

### Frontend
- `src/Game/online.js` - Online game serialization (many TODOs)
- `src/store/online/actions.js` - Vuex actions for online features
- `src/utilities.js` - Firestore converters (need major updates)
- `src/dialogs/PlayOnline.vue` - Create game dialog
- `src/dialogs/LoadOnline.vue` - Browse/join games dialog

### Backend
- `functions/index.js` - Cloud functions (createGame, joinGame, insertPly)
- `firestore.rules` - Security rules (already complete)

## Next Actions

1. **Start with converters** - Nothing else works until these are fixed
2. **Fix join bug** - 5 minute fix, immediate value
3. **Implement gameplay** - Core feature, highest priority
4. **Add remaining features** - Chat, puzzles, analyses (can be done in parallel)

## Timeline Estimate

- **MVP (playable games)**: 1-2 weeks
- **Full feature set**: 3-4 weeks
- **Polish & testing**: +1 week

## See Also

- `ONLINE_GAMEPLAY_PLAN.md` - Detailed implementation plan with all 9 phases
- Database schema diagram (provided image)
