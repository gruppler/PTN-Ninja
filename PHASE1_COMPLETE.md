# Phase 1 Complete: Database Schema & Converters

## Summary

Phase 1 is now complete. All JSON converters have been updated to match the new database schema with branches as subcollections.

## Changes Made

### 1. Game/online.js - Added Missing Methods

- ✅ Added `JSONState` getter (uppercase) - referenced by CREATE_GAME action
- ✅ Added `JSONTags` getter (uppercase) - referenced by CREATE_GAME action
- ✅ Implemented `jsonPlayerChat` getter/setter - returns player chat messages
- ✅ Implemented `jsonSpectatorChat` getter/setter - returns spectator chat messages
- ✅ Updated `jsonBranches` setter - added structure for parsing branches (full implementation in Phase 5)
- ✅ Updated `jsonBranch` setter - added structure for parsing single branch

### 2. Game/PTN/Ply.js - Implemented Data Setter

- ✅ Implemented `set data()` - deserializes ply data from Firestore format
- ✅ Handles linenum, notes, uid, createdAt, updatedAt fields

### 3. utilities.js - Updated All Converters

#### gameConverter
- ✅ `toFirestore()` - properly serializes Game to Firestore format
  - Uses `jsonConfig`, `jsonTags`, `jsonState`, `jsonNotes`
  - Omits online-specific fields (id, collection, path, isOnline, player)
  - Includes metadata (createdBy, createdAt, updatedBy, updatedAt)
- ✅ `fromFirestore()` - deserializes Firestore document to Game data
  - Adds online-specific config fields
  - Converts timestamps properly
  - Note: Branches loaded separately via listeners

#### branchConverter (NEW)
- ✅ `toFirestore()` - converts branch data to Firestore format
- ✅ `fromFirestore()` - deserializes branch document
- ✅ `getStateID()` - extracts branch ID from path for state management
- Handles: parent, name, player, plies[], uid, createdAt, updatedAt

#### analysisConverter
- ✅ Updated to match new schema
- ✅ Handles: gameID, title, tags[], uid, timestamps
- ✅ Proper timestamp conversion

#### puzzleConverter
- ✅ Updated to match new schema
- ✅ Handles: name, type, tags[], uid, timestamps
- ✅ Proper timestamp conversion

#### commentConverter (NEW)
- ✅ `toFirestore()` - converts comment to Firestore format
- ✅ `fromFirestore()` - deserializes comment document
- Handles: text, replyTo, uid, timestamps
- Used for: puzzle comments, solution comments, analysis comments

### 4. store/online/actions.js

- ✅ Added imports for `branchConverter` and `commentConverter`
- ✅ Updated `LISTEN_CURRENT_GAME` to use `branchConverter`
  - Listens to `branches/root` for main game moves
  - Listens to user-specific branches for analyses/variations
  - Uses separate state key for branches

### 5. store/online/state.js

- ✅ Added state keys for branches:
  - `gamesPrivate_branches`
  - `gamesPublic_branches`
  - `analyses_branches`

## Database Schema Alignment

The converters now properly align with your database schema:

```
gamesPublic/{gameID}
  ├─ Main document: name, config, tags, state, notes, metadata
  ├─ branches/{branchID} ← Handled by branchConverter
  ├─ playerChat/{messageID} ← Handled by commentConverter
  └─ spectatorChat/{messageID} ← Handled by commentConverter

gamesPrivate/{gameID}
  ├─ Same structure as public games

analyses/{analysisID}
  ├─ Main document: gameID, title, tags[], uid, timestamps
  ├─ branches/{branchID} ← Handled by branchConverter
  └─ comments/{commentID} ← Handled by commentConverter

puzzles/{puzzleID}
  ├─ Main document: name, type, tags[], uid, timestamps
  ├─ solutions/{solutionID}
  │   └─ comments/{commentID} ← Handled by commentConverter
  └─ comments/{commentID} ← Handled by commentConverter
```

## What Works Now

1. **Game Creation** - `CREATE_GAME` can now properly serialize games
2. **Game Loading** - `LOAD_GAMES` can deserialize game documents
3. **Branch Listening** - `LISTEN_CURRENT_GAME` properly listens to branches subcollection
4. **Proper Separation** - Main game document separate from branches (matches schema)

## What Still Needs Work

### Immediate (Phase 2)
- **Branch Storage** - `createGame` cloud function needs to create branches/root document
- **Ply Storage** - Store plies array in branch documents when creating games with moves

### Near-term (Phases 3-4)
- **Join Game Bug** - Fix line 276 in functions/index.js
- **Move Submission** - Implement `insertPly` cloud function
- **Real-time Sync** - Handle incoming moves from opponents

### Later (Phases 5-8)
- **Branch Parsing** - Complete `set jsonBranches()` to reconstruct game tree
- **Chat Integration** - Convert chat messages to Comment objects
- **Full Branch Management** - Create/update/delete branches
- **Puzzle & Analysis Systems** - Full implementation

## Testing Recommendations

Before moving to Phase 2, test:

1. **Create a new empty game** - Verify converter serialization
2. **Load existing games** - Verify converter deserialization
3. **Check console for errors** - Ensure no converter failures
4. **Verify state structure** - Check Vuex devtools for proper state

## Next Steps

**Phase 2: Game Creation with Existing Moves**
- Update `createGame` cloud function to store branches
- Store plies in branches/root document
- Handle initial game state (TPS, plyIndex)
- Test creating games with moves

**Quick Win: Phase 3**
- Fix the join game bug (5 minutes)
- Test joining games works properly

Then proceed to **Phase 4: Real-time Gameplay** for the core multiplayer functionality.
