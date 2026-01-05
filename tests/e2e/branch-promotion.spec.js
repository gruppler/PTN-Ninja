// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Branch Promotion E2E Tests
 *
 * These tests verify that branch promotion operations work correctly in PTN Ninja.
 * They use the existing branchPromotionRunner that's installed in development builds.
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
};

/**
 * Helper to load a PTN into the app
 */
async function loadPTN(page, ptn) {
  // Use the app's ADD_GAME action to load PTN
  await page.evaluate(async (ptnText) => {
    const app = window.app;
    if (app && app.$store) {
      // Create a game object with the PTN
      const game = {
        ptn: ptnText,
        name: "Test Game",
      };
      await app.$store.dispatch("game/ADD_GAME", game);
    }
  }, ptn);
  // Wait for the game to be loaded and board ready
  await page.waitForFunction(
    () => {
      const app = window.app;
      const game = app && app.$game;
      return game && game.board && game.plies && game.plies.length > 0;
    },
    { timeout: 10000 }
  );

  // Enable "Show All Branches" and expand all branches for better visibility
  await page.evaluate(async () => {
    const store = window.app.$store;
    const game = window.app.$game;

    // Enable Show All Branches
    await store.dispatch("ui/SET_UI", ["showAllBranches", true]);

    // Expand all branch points
    const branchPoints = game.plies.filter(
      (ply) => ply.branches && ply.branches.length > 1
    );
    const overrides = {};
    branchPoints.forEach((ply) => {
      overrides[ply.id] = true;
    });
    await store.dispatch("game/SET_BRANCH_POINT_OVERRIDES", overrides);
  });
}

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
 * Helper to navigate to a branch end
 */
async function goToBranchEnd(page, branch) {
  await page.evaluate(async (branchName) => {
    const store = window.app.$store;
    const game = window.app.$game;
    const start = game.branches[branchName];
    if (!start) throw new Error("Missing branch: " + branchName);
    // Use SET_TARGET to set the branch and navigate
    await store.dispatch("game/SET_TARGET", start);
    await store.dispatch("game/LAST");
  }, branch);
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
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the app to be ready
    await page.waitForFunction(() => window.app && window.app.$store);
  });

  test("T1: Promote branch to main (simple, top-level)", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T1);
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
    expect(after.ptn).toContain("c1");
    expect(after.ptn).toContain("c2");
  });

  test("T2: Promote branch among siblings (promoteBranch, 3+ siblings)", async ({
    page,
  }) => {
    await loadPTN(page, PTN_FIXTURES.T2);
    await goToBranchEnd(page, "3w2");

    const before = await getGameState(page);

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
  });

  test("T3: Promote branch while currently on mainline", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T1);
    await goToMainEnd(page);

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
    expect(after.ptn).toContain("a3");
    expect(after.ptn).toContain("b3");
    expect(after.ptn).toContain("c1");
    expect(after.ptn).toContain("c2");
  });

  test("T4: Promote nested branch (depth 2)", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T4);
    await goToBranchEnd(page, "3w1/4w1");

    const before = await getGameState(page);

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
  });

  test("T5: Promote branch with NOP (--) at branch start", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T5);
    await goToBranchEnd(page, "3b1");

    const before = await getGameState(page);

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
  });

  test("T12: Promote among 3+ siblings while on mainline", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.T11);
    await goToMainEnd(page);

    const before = await getGameState(page);

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
});

