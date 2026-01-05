# Branch Structure Refactoring Plan

## Overview

Refactor the internal ply/branch data model from a flat array with mutable IDs to a tree structure with stable object references. This will simplify mutations (especially branch promotion) and preserve position through changes.

## Current Problems

1. **Plies indexed by mutable ID**: `this.plies[id]` means IDs must be renumbered when plies move
2. **Branch names embedded in ply objects**: Renaming branches requires updating every ply
3. **Sibling branches stored as arrays on plies**: `ply.branches` is shared across siblings, making mutations complex
4. **Non-contiguous plies**: Sibling branches are interleaved in `this.plies`, complicating splice operations
5. **Position tracked by ID**: When IDs change, position is lost

## New Structure

### Ply Object

```javascript
Ply {
  parent: Ply | null,      // Reference to parent ply (null for first ply)
  children: Ply[],         // [0] = main continuation, [1+] = branch alternatives
  move: Move,
  index: number,           // Position within current branch line
}
```

### Game Object

```javascript
Game {
  root: Ply | null,        // First ply of the game
  currentPly: Ply | null,  // Direct reference - stable within session
  plyIsDone: boolean,

  // Computed for legacy compatibility
  get plies() { ... }      // Flattened array with assigned IDs
  get branches() { ... }   // Branch name -> ply map
}
```

## Benefits

1. **Stable position**: `currentPly` reference survives all mutations
2. **Simple promotion**: Just reorder `children` array
3. **No ID renumbering**: IDs computed on-demand for legacy compatibility
4. **PCN support**: Tree naturally represents inline branches
5. **Cleaner code**: No more splice/filter/rebuild cycles

## URL Compatibility

Existing URLs use `branch=5b1&plyIndex=7` format. This will continue to work:

1. Parse PTN into tree
2. Resolve branch name + index to find the ply
3. Set `currentPly` to that reference

After mutations, URLs update based on new tree position, but old URLs still resolve correctly.

---

## Implementation Phases

### Phase 1: New Ply Structure

- [x] Add `parent` property to Ply
- [x] Add `children` array to Ply constructor
- [x] Keep `branches` array for backward compatibility during transition
- [x] Update Ply constructor and `addBranch`/`removeBranch` methods

**Files:** `src/Game/PTN/Ply.js`

### Phase 2: Tree Building During Parse

- [x] Build parent/children relationships during PTN parsing
- [x] Set `parent` when creating plies
- [x] Populate `children` array when setting parent (bidirectional link)
- [x] Update `children` in `addBranch` for branch plies
- [x] Update `removeBranch` to remove from parent's children

**Files:** `src/Game/PTN/index.js`, `src/Game/PTN/Move.js`, `src/Game/PTN/Ply.js`

### Phase 3: Computed Legacy Properties

- [ ] Add `get plies()` that flattens tree and assigns IDs
- [ ] Add `get branches()` that computes branch name map
- [x] Add `rootPly` getter and `getPliesFromTree()` method (now uses children)
- [x] Add `verifyParentRelationships()` debug method
- [x] Add `verifyChildrenRelationships()` debug method
- [ ] Ensure existing code continues to work

**Files:** `src/Game/base.js`

### Phase 4: Navigation Refactor

- [x] Add `getPrevPlyFromTree()` method to Board (now integrated into main getter)
- [x] Add `getNextPlyFromTree()` method to Board (now integrated into main getter)
- [x] Add `getPath()` method to Ply (returns array of plies from root)
- [x] Add `depth` getter to Ply
- [x] Add `getSerializablePath()` method to Ply (survives init())
- [x] Add `findPlyFromPath()` method to Game (restores position from path)
- [x] Update `nextPly` getter on Ply to use children array
- [x] Update Board `prevPly`/`nextPly` getters to use tree traversal
- [x] Update Board `getPrevPly(times)`/`getNextPly(times)` to walk tree
- [ ] Track position by `currentPly` reference (optional - plyID still works)

**Files:** `src/Game/Board/nav.js`, `src/Game/Board/index.js`, `src/Game/PTN/Ply.js`

### Phase 5: Mutation Simplification

- [x] Add `promoteToMainChild()` helper to Ply class
- [x] Add `swapWithSibling()` helper to Ply class
- [x] Position preserved via serializable path (survives init)
- [x] Mutations already work correctly - `init()` rebuilds tree via `Move.setPly`
- [N/A] `_rebuildTreeRelationships()` not needed - removed (init handles it)

**Files:** `src/Game/mutations.js`, `src/Game/PTN/Ply.js`

**Note:** Phase 5 is complete. The existing mutation code works correctly because:

1. Mutations modify plies and call `_updatePTN()` to serialize
2. `init()` re-parses PTN and rebuilds tree structure via `Move.setPly`
3. Position is restored via `getSerializablePath()` / `findPlyFromPath()`

### Phase 6: Serialization

- [ ] Update `toString()` to traverse tree
- [ ] Generate branch names from tree structure
- [ ] Support PCN inline branch syntax (optional)

**Files:** `src/Game/base.js`

### Phase 7: Cleanup

- [ ] Remove legacy `this.plies` array storage
- [ ] Remove ID renumbering code
- [ ] Remove `ply.branches` shared array pattern

---

## Progress Log

### Session 1 - Dec 6, 2025

**Completed:**

- Fixed the immediate `promoteBranch`/`_makeBranchMain` bug:
  - Fixed `getDescendents` to handle non-contiguous plies
  - Fixed branch ply filtering to use correct branch name after rename
  - Ensured `this.plies` is updated after reordering
  - Sorted all `branches` arrays after ID changes

**Current State:**

- Branch promotion works correctly (PTN is valid, no errors)
- Position is not preserved after promotion (minor UX issue)
- Ready to begin tree structure refactor

**Next Steps:**

- Continue Phase 1: Wire up `parent` during ply creation

**Phase 1 Progress:**

- [x] Add `parent` parameter to Ply constructor
- [x] Set `parent` when creating plies during parsing (in `Move.setPly`)
- [x] Update `addBranch` to set parent on branch plies

**Phase 2 Progress:**

- [x] Set `parent` in `Move.setPly` for sequential plies
- [x] Set `parent` in `Ply.addBranch` for branch plies
- [x] Add `verifyParentRelationships()` debug method to Game class
- [x] Add tree traversal helpers to Ply class (`nextPly`, `prevPly`, `siblings`)
- [ ] Verify parent relationships are correct during game play

**Notes:**

- Position restoration after promotion attempted but not working yet
- Will be properly addressed in Phase 4-5 when navigation uses tree structure
- Multiple approaches tried (plyIndex, move number, ply ID) - all failed due to `init()` recreating all objects

**Phase 3 Progress:**

- [x] Add `rootPly` getter
- [x] Add `getPliesFromTree()` method
- [x] Add `verifyParentRelationships()` debug method

**Phase 4 Progress:**

- [x] Add `getPrevPlyFromTree()` method to Board
- [x] Add `getNextPlyFromTree()` method to Board
- [x] Add `getPath()` method to Ply (returns array of plies from root)
- [x] Add `depth` getter to Ply
- [x] Add `getSerializablePath()` method to Ply (survives init())
- [x] Add `findPlyFromPath()` method to Game (restores position from path)
- [ ] Replace existing navigation with tree-based navigation
- [ ] Track position by `currentPly` reference

---

### Session 2 - Jan 5, 2026

**Completed:**

- Implemented bidirectional parent-children links:
  - `Move.setPly` now adds ply to parent's `children` array when setting parent
  - `Ply.addBranch` adds branch plies to parent's children
  - `Ply.removeBranch` removes from parent's children
- Updated tree traversal to use `children` array:
  - `Ply.nextPly` getter now returns `children[0]` (main continuation)
  - `getPliesFromTree()` traverses via children (depth-first)
  - Board `prevPly`/`nextPly` getters now use tree parent/children
  - Board `getPrevPly(times)`/`getNextPly(times)` walk tree structure
- Added `verifyChildrenRelationships()` debug method

**Completed (continued):**

- Added `promoteToMainChild()` and `swapWithSibling()` helpers to Ply class
- Analyzed mutation code - discovered `init()` already rebuilds tree via `Move.setPly`
- Removed unused `_rebuildTreeRelationships()` method (not needed)
- Phase 5 complete - mutations work correctly with existing architecture

**Current State:**

Phase 1-2 complete. Phase 4-5 complete:

- Tree structure is fully bidirectional (parent ↔ children)
- `children[0]` = main continuation, `children[1+]` = branch alternatives
- All navigation uses tree traversal (parent for prev, children for next)
- Mutations serialize to PTN, `init()` rebuilds tree, position restored via path
- All 12 Playwright tests passing

**Next Steps:**

1. Phase 6: Serialization improvements (optional - current serialization works)
2. Phase 7: Cleanup legacy code (optional - requires careful analysis)

---

## Testing

### Automated E2E Tests (Playwright)

Branch promotion tests are automated using Playwright in the `tests/` directory.

**Setup:**

```bash
yarn test:install
```

**Run tests:**

```bash
yarn test          # Run all tests (headless)
yarn test:ui       # Run with Playwright UI
yarn test:headed   # Run in headed mode (see browser)
```

**Test cases:**

- **T1**: Promote branch to main (simple, top-level)
- **T2**: Promote branch among siblings (promoteBranch, 3+ siblings)
- **T3**: Promote branch while currently on mainline
- **T4**: Promote nested branch (depth 2)
- **T5**: Promote branch with NOP (--) at branch start
- **T7**: Promote branch with annotations/eval markers
- **T8**: Promote branch with notes attached
- **T9**: Repeat promotions (stability)
- **T10**: Full regression (large PTN with complex branching)
- **T11**: Promote among 3+ siblings while on that branch
- **T12**: Promote among 3+ siblings while on mainline

### Browser Console Runner

In development builds, tests can also be run via the browser console:

```js
window.branchPromotionTests.runAll();     // Run all tests
window.branchPromotionTests.list();       // List test IDs
window.branchPromotionTests.runCase("T10"); // Run single test
```

### Test Invariants

Each test verifies:

- **Valid PTN**: `Game.validate()` passes after promotion
- **No ply loss**: Ply count unchanged
- **Tokens preserved**: Expected move tokens still present
- **Board state preserved**: TPS unchanged where applicable
