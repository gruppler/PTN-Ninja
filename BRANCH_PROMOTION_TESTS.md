# Branch Promotion Test Cases

This document defines regression and edge/corner test cases for branch promotion operations:

- `Game.promoteBranch(branch)`
- `Game.makeBranchMain(branch, recursively)`

The goal is to detect cases where promotion:

- Loses plies (e.g. missing moves after promotion)
- Produces an invalid PTN / invalid game state
- Breaks branch structure (missing/incorrect `branches` map)
- Fails to preserve the user’s logical position after promotion
- Changes the board position (TPS) when it should be preserved

## Quick harness (run in browser console)

## Automated runner (recommended)

In development builds, PTN Ninja now installs an automated runner at:

- `window.branchPromotionTests`

Run all cases:

```js
window.branchPromotionTests.runAll();
```

List case IDs:

```js
window.branchPromotionTests.list();
```

Run a single case:

```js
window.branchPromotionTests.runCase("T10");
```

If a test fails, it throws an error and prints a `console.table()` with results.

These snippets assume you’re running PTN Ninja in the browser and have a game loaded.

```js
const g = app.$store.state.game.ptn;

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const validateGame = (game) => {
  const result = game.constructor.validate(game.ptn, true);
  assert(result === true, "Game.validate failed: " + String(result));
};

const snapshot = (game) => {
  return {
    plyCount: game.plies.length,
    moveCount: game.moves.length,
    branchKeys: Object.keys(game.branches).sort(),
    // stable position representation
    position: game.board.ply ? game.board.ply.getSerializablePath() : null,
    ptn: game.ptn,
  };
};

const assertNoPlyLoss = (before, after) => {
  assert(after.plyCount === before.plyCount, "Ply count changed");
};

const assertPositionRestored = (game, beforeSnap) => {
  if (!beforeSnap.position) return;
  const target = game.findPlyFromPath(beforeSnap.position);
  assert(
    Boolean(target),
    "Could not resolve pre-promotion position in new game"
  );
  assert(game.board.plyID === target.id, "Did not restore to expected ply");
};
```

Common sequence:

```js
const before = snapshot(g);

// perform promotion here
// g.makeBranchMain("<branch>", true);
// or g.promoteBranch("<branch>");

validateGame(g);
const after = snapshot(g);
assertNoPlyLoss(before, after);
assertPositionRestored(g, before);
```

## Global invariants (apply to every test)

For every promotion operation in this file, verify:

- **[valid PTN]** `g.constructor.validate(g.ptn, true) === true`
- **[no ply loss]** `g.plies.length` unchanged
- **[no silent truncation]** PTN still contains a few key expected tokens from both mainline and promoted branch (case-specific)
- **[position preserved]** if you start on a ply in some branch, you end on the same logical ply after promotion
- **[board state preserved]** the board TPS and `targetBranch` are unchanged before vs after the operation
- **[branches intact]** `Object.keys(g.branches)` still includes `""` and does not include stale branch names that should have been removed

## Test matrix

Each test below specifies:

- **Setup PTN**
- **Starting position** (where to navigate before promoting)
- **Operation**
- **Extra assertions** (in addition to global invariants)

### T1: Promote branch to main (simple, top-level)

**Purpose:** minimal repro for `makeBranchMain` on a single-level branch.

**PTN:**

```ptn
[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{3w1}
3. c1 b3
4. c2 b4
```

**Starting position:**

- Navigate to the last ply of branch `3w1` (i.e. after `4... b4` on that branch)

**Operation:**

- `g.makeBranchMain("3w1", true)`

**Extra assertions:**

- **[promoted tokens]** resulting PTN contains `c1` and `c2` in the mainline
- **[original tokens preserved]** original mainline tokens `a3 b3` still exist somewhere (likely as a branch)

### T2: Promote branch among siblings (promoteBranch, 3+ siblings)

**Purpose:** `promoteBranch` reorders siblings without making branch main.

**PTN:**

```ptn
[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3
4. a4 b4

{3w1}
3. c1 b3
4. c2 b4

{3w2}
3. d1 b3
4. d2 b4
```

**Starting position:**

- Navigate to last ply of `3w2`.

**Operation:**

- `g.promoteBranch("3w2")`

**Extra assertions:**

- **[still a branch]** `"3w2" in g.branches` remains true (it’s not main)
- **[order change]** within the branch menu UI, `3w2` should move “up” one step relative to its siblings (manual check)
- **[board state preserved]** TPS should be unchanged before vs after

### T3: Promote branch while currently on mainline

**Purpose:** ensure current position is preserved even if user is not in the promoted branch.

Use PTN from **T1**.

**Starting position:**

- Navigate to end of mainline (after `3... b3`).

**Operation:**

- `g.makeBranchMain("3w1", true)`

**Extra assertions:**

- **[position preserved]** you should still be on the same logical ply (end of original mainline, which is now a branch)

### T4: Promote nested branch (depth 2)

**Purpose:** exercise `branch/subBranch` renaming and descendant retention.

**PTN:**

```ptn
[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3
4. a4 b4

{3w1}
3. c1 b3
4. c2 b4

{3w1/4w1}
4. d1 b4
5. d2 b5
```

**Starting position:**

- Navigate to the last ply of `3w1/4w1`.

**Operation:**

- `g.makeBranchMain("3w1/4w1", true)`

**Extra assertions:**

- **[no descendant loss]** PTN still contains `d1` and `d2` after promotion
- **[branch name updates]** ensure no duplicated/ghost branches exist (manual check of branch list)

### T5: Promote branch with a NOP (`--`) at branch start (black-branch)

**Purpose:** cover branches that start on black’s move using `--`.

**PTN:**

```ptn
[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{3w1/3b1}
3. -- c1
4. a4 c2
```

**Starting position:**

- Navigate to last ply of `3w1/3b1`.

**Operation:**

- `g.makeBranchMain("3w1/3b1", true)`

**Extra assertions:**

- **[nop preserved]** resulting PTN still has a valid placeholder where needed (`--`), and validation passes

### T6: Promote branch where current ply is the branch-point ply

**Purpose:** ensure promoting doesn’t break when `board.ply` is a ply that owns the `branches` array.

Use PTN from **T2**.

**Starting position:**

- Navigate to the branch-point ply at move 3 (the ply at which the first variation occurs).

**Operation:**

- `g.makeBranchMain("3w1", true)`

**Extra assertions:**

- **[still navigable]** after promotion, `next`/`prev` navigation still works from the branch-point location

### T7: Promote branch that contains annotations/eval/smash markers

**Purpose:** ensure non-move tokens survive promotion.

**PTN:**

```ptn
[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{3w1}
3. c1? b3
4. c2! b4
```

**Operation:**

- `g.makeBranchMain("3w1", true)`

**Extra assertions:**

- **[annotations preserved]** resulting PTN still contains `?` and `!` on the same plies

### T8: Promote branch with chatlog/notes attached near the branch

**Purpose:** ensure `notes` mapping does not get lost or attached to the wrong ply.

**PTN:**

```ptn
[Size "6"]
[Opening "swap"]

1. a1 b1
{a note on mainline}
2. a2 b2

{2w1}
2. c1 b2
{note in branch}
3. c2 b3
```

**Operation:**

- `g.makeBranchMain("2w1", true)`

**Extra assertions:**

- **[notes preserved]** both comments still appear in the UI and remain attached to the intended ply

### T9: Repeat promotions (stability)

**Purpose:** promote multiple times to shake out stale references.

Use PTN from **T2**.

**Operation:**

- `g.promoteBranch("3w2")`
- `g.promoteBranch("3w2")` again
- `g.promoteBranch("3w1")`

**Extra assertions:**

- **[still valid]** validate after each operation
- **[board state preserved]** TPS should be unchanged before vs after

### T11: Promote among 3+ siblings while on that branch

**Purpose:** ensure `promoteBranch()` reorders siblings without altering the current board position.

Use PTN from **T2** but with an extra third sibling branch at the same point.

**Starting position:**

- Navigate to end of the 3rd sibling branch (e.g. `3w3`).

**Operation:**

- `g.promoteBranch("3w3")`

**Extra assertions:**

- **[board state preserved]** TPS should be unchanged before vs after

### T12: Promote among 3+ siblings while on mainline

**Purpose:** ensure `promoteBranch()` does not alter the current board position even when the user is on mainline.

Use the same PTN as **T11**.

**Starting position:**

- Navigate to end of mainline.

**Operation:**

- `g.promoteBranch("3w3")`

**Extra assertions:**

- **[board state preserved]** TPS should be unchanged before vs after

### T10: Full regression (large PTN)

**Purpose:** cover real-world dense branching with deep nesting and many siblings.

**PTN:** use the provided PTN from the bug report (below).

**Starting position:**

- Navigate to a ply in a deep nested branch (e.g. `9w1/9b1/10b1` end)

**Operations:**

Run these and validate after each:

- `g.makeBranchMain("14b1", true)`
- `g.makeBranchMain("9w1/9b1/10b1", true)`
- `g.promoteBranch("14w5")`
- `g.promoteBranch("11w1/11b1")`

**Extra assertions:**

- **[no move loss]** ensure tokens `c2` and `d1` still appear after promotions (these were previously lost in at least one broken scenario)

#### Large PTN fixture

```ptn
[Komi "2"]
[Player1 "PlutoTheBrave"]
[Player2 "Its_Just_Boris"]
[Size "6"]
[Opening "swap"]
[Date "2025.12.06"]
[Time "02:20:38"]

1. a1 f6
2. d4 d3
3. e5 c3
4. Ce3 Ce4
5. d5 c5
6. c4 b5
7. b4 a5
8. e6 d3+
9. c6 a4
10. f4 a3
11. Sa2 f5
12. d3 d6
13. d2 e4+
14. b4+ b4

{5b1}
5. -- c4
6. e3< e4<
7. e4

{6w1}
6. c6

{6b2}
6. -- e4<
7. b5 2d4<

{6b1}
6. -- f4
7. b4 d3+

{7w1}
7. e3<

{9w3}
9. Sd3 f4
10. d3+ e4<*
11. e4 2d4>

{9w3/11w1}
11. e3+

{9w1}
9. e3< f4
10. d3+

{9w1/9b1}
9. -- e4<
10. e4 f4
11. e3

{9w1/9b1/10b1}
10. -- f5
11. e3 3d4+
12. b4+

{9w2}
9. f3

{9b1}
9. -- f4
10. c6- e4+
11. d6 2e5<
12. c6 3d5<
13. b6 a6
14. c2

{9b1/10w1}
10. b4+ b4

{9b1/14w1}
14. e4 4c5-

{11w1}
11. a2 b2
12. b3 b6
13. a2+

{11w1/11b1}
11. -- b6
12. Sb3

{11w1/11b1/12w1}
12. b3 b2
13. a2+

{11b1}
11. -- b2

{12w1}
12. d6

{12b1}
12. -- f1
13. e3<

{14w2}
14. c4> d6- 0-R

{14w1}
14. f4+ 2e5>
15. Se5

{14w3}
14. d5< 2e5<11

{14w4}
14. c4+ 2e5<11

{14w5}
14. c6-

{14b1}
14. -- c2
15. d1 c1
16. c4> 2e5<
17. 3d4>12 c1>
18. c1 c4

{14b1/15b1}
15. -- b3
16. c4> d6-
17. a2+ b4
18. 2d4+ 2e5<

{14b1/15b1/18w1}
18. 3d4<12

{14b1/15b2}
15. -- b4
16. e4

{14b1/15b3}
15. -- e4
```
