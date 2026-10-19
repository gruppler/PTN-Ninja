// @ts-check
const {
  test,
  expect,
  loadPTN,
  act,
  snapshot,
  expectInvariants,
  branchKeys,
  branchLine,
  branchOf,
  goToBranchEnd,
  settled,
} = require("./helpers");

/**
 * Branch Promotion E2E Tests
 *
 * These tests verify that branch promotion operations work correctly in PTN
 * Ninja. They drive the store actions the branch context menu dispatches.
 * More cases are in branch-promotion-matrix.spec.js.
 */

// Test fixtures - PTN strings for various test scenarios
const PTN_FIXTURES = {
  T1: `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{3w1}
3. c1 b3
4. c2 b4
`,

  T2: `[Size "6"]
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
`,

  T4: `[Size "6"]
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
`,

  T5: `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{3b1}
3. -- c1
4. a4 c2
`,

  T7: `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{3w1}
3. c1? b3
4. c2! b4
`,

  T8: `[Size "6"]
[Opening "swap"]

1. a1 b1
{a note on mainline}
2. a2 b2

{2w1}
2. c1 b2
{note in branch}
3. c2 b3
`,

  T11: `[Size "6"]
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

{3w3}
3. e1 b3
4. e2 b4
`,

  T10: `[Komi "2"]
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
`,

  T15: `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{analysis}
3. c1 b3
4. c2 b4
`,

  T16: `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3
4. a4 b4

{3w1}
3. c1 b3
4. c2 b4

{analysis}
3. d1 b3
4. d2 b4
`,

  T17: `[Size "6"]
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

{my-analysis}
3. e1 b3
4. e2 b4
`,
};

/**
 * Helper to get the current game state
 */
async function getGameState(page) {
  return await page.evaluate(() => {
    const game = window.app.$game;
    if (!game) return null;
    const ply = game.board.ply;
    return {
      plyCount: game.plies.length,
      moveCount: game.moves.length,
      branchKeys: Object.keys(game.branches).sort(),
      ptn: game.toString({ showAllBranches: true }),
      plyID: game.board.plyID,
      plyIsDone: game.board.plyIsDone,
      tps: game.board.tps,
      targetBranch: game.board.targetBranch,
      // Serializable path survives re-init and can be used to verify position
      position: ply ? ply.getSerializablePath() : null,
      // Current ply text for debugging
      plyText: ply ? ply.text : null,
    };
  });
}

/**
 * Helper to verify position was restored after promotion
 */
async function assertPositionRestored(page, beforePosition) {
  return await page.evaluate((position) => {
    if (!position) return { ok: true };
    const game = window.app.$game;
    const target = game.findPlyFromPath(position);
    if (!target) {
      return {
        ok: false,
        error: "Could not resolve pre-promotion position in new game",
      };
    }
    if (game.board.plyID !== target.id) {
      return {
        ok: false,
        error: `Position not restored. Expected plyID ${target.id}, got ${game.board.plyID}`,
      };
    }
    return { ok: true };
  }, beforePosition);
}

/**
 * Helper to navigate to main branch end
 */
async function goToMainEnd(page) {
  await page.evaluate(async () => {
    const store = window.app.$store;
    const game = window.app.$game;
    // Navigate to first ply of main branch, then go to end
    const mainStart = game.branches[""];
    if (mainStart) {
      await store.dispatch("game/SET_TARGET", mainStart);
    }
    await store.dispatch("game/LAST");
  });
}

/**
 * Helper to validate the game
 */
async function validateGame(page) {
  return await page.evaluate(() => {
    const Game = window.app.$game.constructor;
    const game = window.app.$game;
    return Game.validate(game.toString({ showAllBranches: true }), true);
  });
}

test.describe("Branch Promotion Tests", () => {
  test("T1: Promote branch to main (simple, top-level)", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T1);
    await goToBranchEnd(page, "3w1");

    const before = await getGameState(page);
    const snap = await snapshot(page);

    // Perform promotion
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/MAKE_BRANCH_MAIN", "3w1");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);
    const positionCheck = await assertPositionRestored(page, before.position);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);
    expect(after.tps).toBe(before.tps); // Board state preserved
    expect(positionCheck.ok).toBe(true); // Position restored
    expect(after.ptn).toContain("c1");
    expect(after.ptn).toContain("c2");
    await expectInvariants(page, snap);
  });

  test("T2: Promote branch among siblings (promoteBranch, 3+ siblings)", async ({
    page,
  }) => {
    await loadPTN(page, PTN_FIXTURES.T2);
    await goToBranchEnd(page, "3w2");

    const before = await getGameState(page);
    const snap = await snapshot(page);

    // Perform promotion
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/PROMOTE_BRANCH", "3w2");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);
    const positionCheck = await assertPositionRestored(page, before.position);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);
    expect(after.tps).toBe(before.tps); // Board state preserved
    expect(positionCheck.ok).toBe(true); // Position restored
    expect(after.ptn).toContain("d1");
    expect(after.ptn).toContain("d2");
    // Branch should still exist (not promoted to main)
    expect(after.branchKeys).toContain("3w2");
    await expectInvariants(page, snap);
  });

  test("T3: Promote branch while currently on mainline", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T1);
    await goToMainEnd(page);

    const before = await getGameState(page);
    const snap = await snapshot(page);

    // Perform promotion
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/MAKE_BRANCH_MAIN", "3w1");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);
    const positionCheck = await assertPositionRestored(page, before.position);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);
    expect(after.tps).toBe(before.tps); // Board state preserved
    expect(positionCheck.ok).toBe(true); // Position restored
    expect(after.ptn).toContain("a3");
    expect(after.ptn).toContain("b3");
    expect(after.ptn).toContain("c1");
    expect(after.ptn).toContain("c2");
    await expectInvariants(page, snap);
  });

  test("T4: Promote nested branch (depth 2)", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T4);
    await goToBranchEnd(page, "3w1/4w1");

    const before = await getGameState(page);
    const snap = await snapshot(page);

    // Perform promotion
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/MAKE_BRANCH_MAIN", "3w1/4w1");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);
    const positionCheck = await assertPositionRestored(page, before.position);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);
    expect(after.tps).toBe(before.tps); // Board state preserved
    expect(positionCheck.ok).toBe(true); // Position restored
    expect(after.ptn).toContain("d1");
    expect(after.ptn).toContain("d2");
    await expectInvariants(page, snap);
  });

  test("T5: Promote branch with NOP (--) at branch start", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T5);
    await goToBranchEnd(page, "3b1");

    const before = await getGameState(page);
    const snap = await snapshot(page);

    // Perform promotion
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/MAKE_BRANCH_MAIN", "3b1");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);
    const positionCheck = await assertPositionRestored(page, before.position);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);
    expect(after.tps).toBe(before.tps); // Board state preserved
    expect(positionCheck.ok).toBe(true); // Position restored
    await expectInvariants(page, snap);
  });

  test("T7: Promote branch with annotations/eval markers", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T7);
    await goToBranchEnd(page, "3w1");

    const before = await getGameState(page);

    // Perform promotion
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/MAKE_BRANCH_MAIN", "3w1");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);
    const positionCheck = await assertPositionRestored(page, before.position);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);
    expect(after.tps).toBe(before.tps); // Board state preserved
    expect(positionCheck.ok).toBe(true); // Position restored
    expect(after.ptn).toContain("?");
    expect(after.ptn).toContain("!");
  });

  test("T8: Promote branch with notes attached", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T8);
    await goToBranchEnd(page, "2w1");

    const before = await getGameState(page);

    // Perform promotion
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/MAKE_BRANCH_MAIN", "2w1");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);
    const positionCheck = await assertPositionRestored(page, before.position);

    expect(isValid).toBe(true);
    expect(after.tps).toBe(before.tps); // Board state preserved
    expect(positionCheck.ok).toBe(true); // Position restored
    expect(after.ptn).toContain("a note on mainline");
    expect(after.ptn).toContain("note in branch");
  });

  test("T9: Repeat promotions (stability)", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T2);
    await goToBranchEnd(page, "3w2");

    const before = await getGameState(page);

    // Perform multiple promotions
    await page.evaluate(async () => {
      const store = window.app.$store;
      const game = window.app.$game;
      const Game = game.constructor;

      await store.dispatch("game/PROMOTE_BRANCH", "3w2");
      let result = Game.validate(
        game.toString({ showAllBranches: true }),
        true
      );
      if (result !== true) {
        throw new Error("Validation failed after first promotion");
      }

      await store.dispatch("game/PROMOTE_BRANCH", "3w2");
      result = Game.validate(game.toString({ showAllBranches: true }), true);
      if (result !== true) {
        throw new Error("Validation failed after second promotion");
      }

      await store.dispatch("game/PROMOTE_BRANCH", "3w1");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);
    const positionCheck = await assertPositionRestored(page, before.position);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);
    expect(after.tps).toBe(before.tps); // Board state preserved
    expect(positionCheck.ok).toBe(true); // Position restored
    expect(after.ptn).toContain("c1");
    expect(after.ptn).toContain("d1");
  });

  test("T11: Promote among 3+ siblings while on that branch", async ({
    page,
  }) => {
    await loadPTN(page, PTN_FIXTURES.T11);
    await goToBranchEnd(page, "3w3");

    const before = await getGameState(page);
    const snap = await snapshot(page);

    // Perform promotion
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/PROMOTE_BRANCH", "3w3");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);
    const positionCheck = await assertPositionRestored(page, before.position);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);
    expect(after.tps).toBe(before.tps); // Board state preserved
    expect(positionCheck.ok).toBe(true); // Position restored
    expect(after.ptn).toContain("e1");
    expect(after.ptn).toContain("e2");
    await expectInvariants(page, snap);
  });

  test("T12: Promote among 3+ siblings while on mainline", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T11);
    await goToMainEnd(page);

    const before = await getGameState(page);
    const snap = await snapshot(page);

    // Perform promotion
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/PROMOTE_BRANCH", "3w3");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);
    const positionCheck = await assertPositionRestored(page, before.position);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);
    expect(after.tps).toBe(before.tps); // Board state preserved
    expect(positionCheck.ok).toBe(true); // Position restored
    expect(after.ptn).toContain("e1");
    expect(after.ptn).toContain("e2");
    await expectInvariants(page, snap);
  });

  test("T10: Full regression (large PTN with complex branching)", async ({
    page,
  }) => {
    await loadPTN(page, PTN_FIXTURES.T10);

    const before = await getGameState(page);

    // Perform complex sequence of promotions
    await page.evaluate(async () => {
      const store = window.app.$store;
      const game = window.app.$game;
      const Game = game.constructor;

      // Helper to find branch by predicate
      const resolveBranch = (predicate, label) => {
        const entries = Object.entries(game.branches);
        for (const [name, ply] of entries) {
          if (predicate(ply, name)) return name;
        }
        throw new Error("Could not resolve branch: " + label);
      };

      // First promotion: 14... c2
      const b14 = resolveBranch(
        (ply) =>
          ply.move.number === 14 && ply.player === 2 && ply.text === "c2",
        "14... c2"
      );
      await store.dispatch("game/MAKE_BRANCH_MAIN", b14);
      let result = Game.validate(
        game.toString({ showAllBranches: true }),
        true
      );
      if (result !== true) {
        throw new Error("Validation failed after first makeBranchMain");
      }

      // Second promotion: 10... f5
      const deep = resolveBranch(
        (ply) =>
          ply.move.number === 10 && ply.player === 2 && ply.text === "f5",
        "10... f5"
      );
      await store.dispatch("game/MAKE_BRANCH_MAIN", deep);
      result = Game.validate(game.toString({ showAllBranches: true }), true);
      if (result !== true) {
        throw new Error("Validation failed after second makeBranchMain");
      }

      // Third promotion: 14. c6-
      const w14c6 = resolveBranch(
        (ply) =>
          ply.move.number === 14 && ply.player === 1 && ply.text === "c6-",
        "14. c6-"
      );
      await store.dispatch("game/PROMOTE_BRANCH", w14c6);
      result = Game.validate(game.toString({ showAllBranches: true }), true);
      if (result !== true) {
        throw new Error("Validation failed after first promoteBranch");
      }

      // Fourth promotion: 11... b6
      const b11b6 = resolveBranch(
        (ply) =>
          ply.move.number === 11 && ply.player === 2 && ply.text === "b6",
        "11... b6"
      );
      await store.dispatch("game/PROMOTE_BRANCH", b11b6);
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);
    const positionCheck = await assertPositionRestored(page, before.position);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);
    expect(after.tps).toBe(before.tps); // Board state preserved
    expect(positionCheck.ok).toBe(true); // Position restored
    // Critical tokens that were previously lost
    expect(after.ptn).toContain("c2");
    expect(after.ptn).toContain("d1");
  });

  test("T13: Collapsed branch state preserved after promotion", async ({
    page,
  }) => {
    // Use a PTN with multiple branch points
    await loadPTN(page, PTN_FIXTURES.T2);

    // Get the branch point info before any changes
    // Note: in game.plies, branches[0] is a ply object, not an ID
    const branchPointsBefore = await page.evaluate(() => {
      const game = window.app.$game;
      return game.plies
        .filter(
          (ply) =>
            ply.branches && ply.branches.length > 1 && ply.branches[0] === ply
        )
        .map((ply) => ({
          id: ply.id,
          moveNumber: ply.move.number,
          player: ply.player,
          moveText: ply.toString(true),
          siblings: ply.branches
            .map((siblingPly) => siblingPly?.toString(true))
            .filter(Boolean)
            .sort()
            .join("|"),
        }));
    });

    // Collapse all branch points (set override to false)
    if (branchPointsBefore.length > 0) {
      await page.evaluate((branchPoints) => {
        const overrides = {};
        branchPoints.forEach((bp) => {
          overrides[bp.id] = false; // Collapsed
        });
        window.app.$store.dispatch(
          "game/SET_BRANCH_POINT_OVERRIDES",
          overrides
        );
      }, branchPointsBefore);
    }

    // Verify overrides are set
    const overridesBefore = await page.evaluate(() => {
      return window.app.$store.state.game.ptnUI?.branchPointOverrides || {};
    });

    // Perform promotion
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/PROMOTE_BRANCH", "3w2");
    });

    // Get overrides after promotion
    const overridesAfter = await page.evaluate(() => {
      return window.app.$store.state.game.ptnUI?.branchPointOverrides || {};
    });

    // Get the branch point info after promotion
    // Note: in game.plies, branches[0] is a ply object, not an ID
    const branchPointsAfter = await page.evaluate(() => {
      const game = window.app.$game;
      return game.plies
        .filter(
          (ply) =>
            ply.branches && ply.branches.length > 1 && ply.branches[0] === ply
        )
        .map((ply) => ({
          id: ply.id,
          moveNumber: ply.move.number,
          player: ply.player,
          moveText: ply.toString(true),
          siblings: ply.branches
            .map((siblingPly) => siblingPly?.toString(true))
            .filter(Boolean)
            .sort()
            .join("|"),
        }));
    });

    // Verify that the number of branch points is preserved
    expect(branchPointsAfter.length).toBe(branchPointsBefore.length);

    // Verify that the collapsed state is preserved for each branch point
    // (the override should be false for each branch point after promotion)
    const collapsedCountAfter = Object.values(overridesAfter).filter(
      (v) => v === false
    ).length;
    const collapsedCountBefore = Object.values(overridesBefore).filter(
      (v) => v === false
    ).length;

    expect(collapsedCountAfter).toBe(collapsedCountBefore);
  });

  // ============================================================
  // Phase 5b: Smart Branch Renaming Tests
  // ============================================================

  test("T14: Default branch names are renumbered after promotion", async ({
    page,
  }) => {
    // T2 has branches 3w1 and 3w2 (default names)
    await loadPTN(page, PTN_FIXTURES.T2);

    const before = await getGameState(page);

    // Verify we have the expected default branch names
    expect(before.branchKeys).toContain("3w1");
    expect(before.branchKeys).toContain("3w2");

    // Promote 3w2 (should become 3w1, old 3w1 should become 3w2)
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/PROMOTE_BRANCH", "3w2");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);

    // After promotion, branch names should be renumbered sequentially
    // The promoted branch should now be 3w1, the demoted branch should be 3w2
    expect(after.branchKeys).toContain("3w1");
    expect(after.branchKeys).toContain("3w2");

    // The content of 3w1 should now be what was in 3w2 (d1, d2)
    // and 3w2 should have what was in 3w1 (c1, c2)
    const branch3w1Content = await page.evaluate(() => {
      const game = window.app.$game;
      const ply = game.branches["3w1"];
      return ply ? ply.text : null;
    });
    expect(branch3w1Content).toBe("d1");
  });

  test("T15: Custom branch names are preserved during promotion", async ({
    page,
  }) => {
    // Create a PTN with a custom-named branch
    await loadPTN(page, PTN_FIXTURES.T15);

    const before = await getGameState(page);

    // Verify we have the custom branch name
    expect(before.branchKeys).toContain("analysis");

    // Promote the custom-named branch to main
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/MAKE_BRANCH_MAIN", "analysis");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);

    expect(isValid).toBe(true);

    // The custom name should be discarded when promoted to main
    // (main branch has empty string as name)
    expect(after.branchKeys).toContain("");

    // The old main should now have a default branch name
    // (since the custom name was on the promoted branch)
  });

  test("T16: Custom branch name moves with branch during sibling promotion", async ({
    page,
  }) => {
    // Create a PTN with multiple branches, one with custom name
    await loadPTN(page, PTN_FIXTURES.T16);

    const before = await getGameState(page);

    // Verify we have both branch names
    expect(before.branchKeys).toContain("3w1");
    expect(before.branchKeys).toContain("analysis");

    // Promote the custom-named "analysis" branch (should keep its name)
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/PROMOTE_BRANCH", "analysis");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);

    // The custom name "analysis" should be preserved
    expect(after.branchKeys).toContain("analysis");

    // The content should still be associated with the custom name
    const analysisContent = await page.evaluate(() => {
      const game = window.app.$game;
      const ply = game.branches["analysis"];
      return ply ? ply.text : null;
    });
    expect(analysisContent).toBe("d1");
  });

  test("T17: Mixed default and custom names handled correctly", async ({
    page,
  }) => {
    // Create a PTN with 3 branches: main, default name, custom name
    await loadPTN(page, PTN_FIXTURES.T17);

    const before = await getGameState(page);

    // Verify initial state
    expect(before.branchKeys).toContain("3w1");
    expect(before.branchKeys).toContain("3w2");
    expect(before.branchKeys).toContain("my-analysis");

    // Promote the custom-named branch
    await page.evaluate(async () => {
      await window.app.$store.dispatch("game/PROMOTE_BRANCH", "my-analysis");
    });

    const after = await getGameState(page);
    const isValid = await validateGame(page);

    expect(isValid).toBe(true);
    expect(after.plyCount).toBe(before.plyCount);

    // Custom name should be preserved
    expect(after.branchKeys).toContain("my-analysis");

    // Default names should be renumbered appropriately
    // (exact behavior depends on implementation)
  });
});

/**
 * Nested branch promotion
 *
 * Promoting a branch nested inside another branch must keep the names of
 * the other siblings at the same branch point, and of branches that fork off
 * before it. Siblings used to be renamed as sub-branches of the demoted line
 * (1b1/2b2 -> 1b1/2b1/2b2), which pointed them at the wrong parent and showed
 * white's move as "--" in the move list.
 */

const NESTED_PTN = `[Size "6"]
[Opening "swap"]

1. a1 f6
2. e5 e4

{1b1}
1. -- f1
2. e3 e2
3. e4 f2
4. d2 Cd3

{1b1/2b1}
2. -- a3

{1b1/2b2}
2. -- Cd3
3. e4 e2
4. d5

{1b1/2b3}
2. -- e4

{1b2}
1. -- b1
2. b2

{1b2/2w1}
2. b3 Cc3
`;

const NESTED_WHITE_PTN = `[Size "6"]
[Opening "swap"]

1. a1 f6
2. a2 f5
3. a3 f4
4. a4 f3

{3w1}
3. b1 f4
4. b2 f3
5. b3 f2

{3w1/4w1}
4. c1 f3

{3w1/4w2}
4. c2 f3

{3w1/4w3}
4. c3 f3
`;

// Adds a fork of 1b1 before its 2b branch point (1b1/2w1), and a fork of
// 1b1 after it (1b1/3w1)
const NESTED_FORKS_PTN = `${NESTED_PTN}
{1b1/2w1}
2. a5 a6

{1b1/3w1}
3. a4
`;

async function dispatch(page, action, payload) {
  expect(await act(page, action, payload)).toBeNull();
}

test.describe("Nested branch promotion", () => {
  test("R1: Promote nested black-ply sibling keeps later siblings' names", async ({
    page,
  }) => {
    await loadPTN(page, NESTED_PTN);
    await goToBranchEnd(page, "1b1/2b1");
    const before = await snapshot(page);

    await dispatch(page, "game/PROMOTE_BRANCH", "1b1/2b1");

    expect(await branchKeys(page)).toEqual([
      "",
      "1b1",
      "1b1/2b1",
      "1b1/2b2",
      "1b1/2b3",
      "1b2",
      "1b2/2w1",
    ]);
    expect(await branchLine(page, "1b1")).toEqual(["f1", "e3", "a3"]);
    expect(await branchLine(page, "1b1/2b1")).toEqual([
      "e2",
      "e4",
      "f2",
      "d2",
      "Cd3",
    ]);
    expect(await branchLine(page, "1b1/2b2")).toEqual([
      "Cd3",
      "e4",
      "e2",
      "d5",
    ]);
    expect(await branchLine(page, "1b1/2b3")).toEqual(["e4"]);
    await expectInvariants(page, before);
  });

  test("R2: Make Main from a nested sibling renames every line correctly", async ({
    page,
  }) => {
    await loadPTN(page, NESTED_PTN);
    await goToBranchEnd(page, "1b1/2b2");
    const before = await snapshot(page);

    await dispatch(page, "game/MAKE_BRANCH_MAIN", "1b1/2b2");

    const keys = await branchKeys(page);
    expect(keys).toEqual(["", "1b1", "1b2", "1b2/2w1", "2b1", "2b2", "2b3"]);
    expect(keys.some((key) => /\/2b\d+\/2b/.test(key))).toBe(false);
    expect(await branchLine(page, "")).toEqual([
      "a1",
      "f1",
      "e3",
      "Cd3",
      "e4",
      "e2",
      "d5",
    ]);
    expect(await branchLine(page, "2b1")).toEqual([
      "e2",
      "e4",
      "f2",
      "d2",
      "Cd3",
    ]);
    expect(await branchLine(page, "2b2")).toEqual(["a3"]);
    expect(await branchLine(page, "2b3")).toEqual(["e4"]);
    await expectInvariants(page, before);
  });

  test("R3: Move list keeps white's move after nested black-ply promotion", async ({
    page,
  }) => {
    await loadPTN(page, NESTED_PTN);
    await goToBranchEnd(page, "1b1/2b1");
    const before = await snapshot(page);

    await dispatch(page, "game/PROMOTE_BRANCH", "1b1/2b1");

    const list = await page.evaluate(async () => {
      const store = window.app.$store;
      const game = window.app.$game;
      await store.dispatch("ui/SET_UI", ["showAllBranches", false]);
      const cd3 = game.plies.find(
        (ply) => ply.text === "Cd3" && ply.move.number === 2
      );
      await store.dispatch("game/SET_TARGET", cd3);
      await store.dispatch("game/GO_TO_PLY", { plyID: cd3.id, isDone: true });
      const plies = store.state.game.ptn.allPlies;
      const text = (ply) =>
        ply == null ? "" : (typeof ply === "number" ? plies[ply] : ply).text;
      return store.state.game.ptn.branchMoves.map((move) =>
        [text(move.ply1Original || move.ply1), text(move.ply2)].join(" ")
      );
    });
    expect(list[1]).toBe("e3 Cd3");
    // The test moved the board itself, so don't compare positions
    await expectInvariants(page, before, { position: false });
  });

  test("R4: Promote nested white-ply sibling keeps later siblings' names", async ({
    page,
  }) => {
    await loadPTN(page, NESTED_WHITE_PTN);
    await goToBranchEnd(page, "3w1/4w1");
    const before = await snapshot(page);

    await dispatch(page, "game/PROMOTE_BRANCH", "3w1/4w1");

    expect(await branchKeys(page)).toEqual([
      "",
      "3w1",
      "3w1/4w1",
      "3w1/4w2",
      "3w1/4w3",
    ]);
    expect(await branchLine(page, "3w1")).toEqual(["b1", "f4", "c1", "f3"]);
    expect(await branchLine(page, "3w1/4w1")).toEqual(["b2", "f3", "b3", "f2"]);
    expect(await branchLine(page, "3w1/4w2")).toEqual(["c2", "f3"]);
    expect(await branchLine(page, "3w1/4w3")).toEqual(["c3", "f3"]);
    // The board ends on f3, which every line plays at move 4, so
    // findPlyFromPath puts it back on the main line. See "Board position when
    // its ply text repeats on other lines" in branch-promotion-matrix.spec.js.
    await expectInvariants(page, before, { position: false });
  });

  test("R5: Forks before the branch point keep their names", async ({
    page,
  }) => {
    await loadPTN(page, NESTED_FORKS_PTN);
    await goToBranchEnd(page, "1b1/2b1");
    const before = await snapshot(page);

    await dispatch(page, "game/PROMOTE_BRANCH", "1b1/2b1");

    expect(await branchKeys(page)).toEqual([
      "",
      "1b1",
      "1b1/2b1",
      "1b1/2b1/3w1",
      "1b1/2b2",
      "1b1/2b3",
      "1b1/2w1",
      "1b2",
      "1b2/2w1",
    ]);
    expect(await branchLine(page, "1b1/2w1")).toEqual(["a5", "a6"]);
    // The fork after the branch point moves with the demoted line
    expect(await branchLine(page, "1b1/2b1/3w1")).toEqual(["a4"]);
    await expectInvariants(page, before);
  });

  test("R6: Round trip and trim at a nested branch point", async ({ page }) => {
    await loadPTN(page, NESTED_PTN);
    const before = await snapshot(page);

    // Put the board just before a3 and trim
    await page.evaluate(async () => {
      const store = window.app.$store;
      const game = window.app.$game;
      const a3 = game.branches["1b1/2b1"];
      await store.dispatch("game/SET_TARGET", a3);
      await store.dispatch("game/GO_TO_PLY", { plyID: a3.id, isDone: false });
      await store.dispatch("game/TRIM_TO_PLY");
    });
    // TRIM_TO_PLY commits on the next tick
    await settled(page);

    expect(await branchKeys(page)).toEqual(["", "2b1", "2b2", "2b3"]);
    expect(await branchLine(page, "")).toEqual(["a3"]);
    expect(await branchLine(page, "2b1")).toEqual([
      "e2",
      "e4",
      "f2",
      "d2",
      "Cd3",
    ]);
    expect(await branchLine(page, "2b2")).toEqual(["Cd3", "e4", "e2", "d5"]);
    expect(await branchLine(page, "2b3")).toEqual(["e4"]);

    // Reparsing keeps the branch keys, and undo restores the original
    const reparsedKeys = await page.evaluate(() => {
      const game = window.app.$game;
      return Object.keys(
        new game.constructor({ ptn: game.ptn }).branches
      ).sort();
    });
    expect(reparsedKeys).toEqual(["", "2b1", "2b2", "2b3"]);
    await dispatch(page, "game/UNDO");
    expect((await snapshot(page)).ptn).toBe(before.ptn);
  });
});

/**
 * Undo, redo and round trip after the cases above that didn't check them
 * (audit P32/P33). Each step runs the full invariants: lines and annotations
 * kept, healthy game, reparse fixed point, board position, UNDO/REDO exact.
 */
test.describe("Undo, redo and round trip after promotion", () => {
  const T10_STEPS = [
    ["game/MAKE_BRANCH_MAIN", { number: 14, player: 2, text: "c2" }],
    ["game/MAKE_BRANCH_MAIN", { number: 10, player: 2, text: "f5" }],
    ["game/PROMOTE_BRANCH", { number: 14, player: 1, text: "c6-" }],
    ["game/PROMOTE_BRANCH", { number: 11, player: 2, text: "b6" }],
  ];

  for (const [label, ptn, start, steps] of [
    ["T7", PTN_FIXTURES.T7, "3w1", [["game/MAKE_BRANCH_MAIN", "3w1"]]],
    ["T8", PTN_FIXTURES.T8, "2w1", [["game/MAKE_BRANCH_MAIN", "2w1"]]],
    [
      "T9",
      PTN_FIXTURES.T2,
      "3w2",
      [
        ["game/PROMOTE_BRANCH", "3w2"],
        ["game/PROMOTE_BRANCH", "3w2"],
        ["game/PROMOTE_BRANCH", "3w1"],
      ],
    ],
    ["T10", PTN_FIXTURES.T10, null, T10_STEPS],
    ["T14", PTN_FIXTURES.T2, null, [["game/PROMOTE_BRANCH", "3w2"]]],
    ["T15", PTN_FIXTURES.T15, null, [["game/MAKE_BRANCH_MAIN", "analysis"]]],
    ["T16", PTN_FIXTURES.T16, null, [["game/PROMOTE_BRANCH", "analysis"]]],
    ["T17", PTN_FIXTURES.T17, null, [["game/PROMOTE_BRANCH", "my-analysis"]]],
  ]) {
    // BUG: T10's 9w siblings are listed 9w3, 9w1, 9w2. Making 9w1/9b1/10b1
    // main renames the intermediate sibling 9w3 to 9w2, which 9w2 (9. f3)
    // still has, so f3 loses its parent. See P20 in
    // branch-promotion-matrix.spec.js.
    const t = label === "T10" ? test.fixme : test;
    t(
      `P32: ${label} keeps every invariant, and undo/redo are exact`,
      async ({ page }) => {
        await loadPTN(page, ptn);
        if (start) {
          await goToBranchEnd(page, start);
        }
        let before = await snapshot(page);
        for (const [op, target] of steps) {
          const branch =
            typeof target === "string" ? target : await branchOf(page, target);
          await dispatch(page, op, branch);
          before = await expectInvariants(page, before);
        }
      }
    );
  }
});
