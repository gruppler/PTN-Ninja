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
- [ ] Refactor `children` to be direct child plies (not branch points)
- [x] Keep `branches` array for backward compatibility during transition
- [x] Update Ply constructor and `addBranch`/`removeBranch` methods

**Files:** `src/Game/PTN/Ply.js`

### Phase 2: Tree Building During Parse

- [x] Build parent/children relationships during PTN parsing
- [x] Set `parent` when creating plies
- [ ] Populate `children` array instead of relying on ID arithmetic

**Files:** `src/Game/PTN/index.js`, `src/Game/PTN/Move.js`

### Phase 3: Computed Legacy Properties

- [ ] Add `get plies()` that flattens tree and assigns IDs
- [ ] Add `get branches()` that computes branch name map
- [x] Add `rootPly` getter and `getPliesFromTree()` method
- [x] Add `verifyParentRelationships()` debug method
- [ ] Ensure existing code continues to work

**Files:** `src/Game/base.js`

### Phase 4: Navigation Refactor

- [ ] Navigate via `parent`/`children` instead of ID arithmetic
- [ ] Track position by `currentPly` reference
- [ ] Update `goToPly`, `next`, `prev`, `first`, `last`

**Files:** `src/Game/Board/nav.js`, `src/Game/Board/index.js`

### Phase 5: Mutation Simplification

- [ ] Simplify `promoteBranch` - just reorder children
- [ ] Simplify `_makeBranchMain` - swap children positions
- [ ] Simplify `deleteBranch` - remove from parent's children
- [ ] Position automatically preserved via stable references

**Files:** `src/Game/mutations.js`

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
