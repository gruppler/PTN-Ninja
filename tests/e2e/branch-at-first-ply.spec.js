// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Branch at First Ply E2E Tests
 *
 * These tests verify that games where a branch diverges at the very first ply
 * (index 0) are handled correctly. This is a regression suite for bugs where:
 * 1. addBranch created a self-referential children entry when the branch point
 *    was the first ply of its own branch (causing "Player does not control
 *    initial square" errors during navigation).
 * 2. getBranchesSorted failed to discover branches at the root ply (causing
 *    branches to be lost in PTN output).
 * 3. isInBranch prematurely exited its loop when ply.index was 0 (falsy check).
 */

// The original bug report PTN — branches diverge at the same move as the TPS
const PTN_BRANCH_AT_TPS = `[Size "6"]
[Komi "2.5"]
[Flats "30"]
[Caps "1"]
[Opening "swap"]
[TPS "1,2,1,x3/2,1,1,1221C,2,1/x2,2,x,1,x/x3,2,1,1/x3,2,x,112/2,2,x,2,x,1 1 16"]
[Date "2026.02.05"]
[Time "21:28:06"]
[Result "R-0"]

16. f5< b6<
17. f3- d3>
18. 3f2+12 R-0

{16w1}
16. 3d5> c4+
17. e2 d2>
18. f3-

{16w1/17w1}
17. f3- Se1
18. d6 c5>
19. 3f2+12 e1>

{16w1/17w1/17b1}
17. -- Ce2
18. d6 c5>
19. d6-

{16w1/17w1/17b1/18b1}
18. -- 2c5>
19. e6 3d5+
20. 3f2+12 R-0

{16w1/19w1}
19. 3f2<12 e1+
20. e6

{16b1}
16. -- d3>
17. c6<`;

// Simple game with a branch at move 1 (the very first ply, no TPS)
const PTN_BRANCH_AT_MOVE_1 = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2

{1w1}
1. c1 b1
2. c2 b2`;

// Branch at move 1 player 2 (second ply)
const PTN_BRANCH_AT_MOVE_1_BLACK = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2

{1b1}
1. -- c1
2. a2 c2`;

// Multiple branches at the first ply
const PTN_MULTI_BRANCH_AT_FIRST = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2

{1w1}
1. c1 b1
2. c2 b2

{1w2}
1. d1 b1
2. d2 b2`;

// Nested branch starting from a first-ply branch
const PTN_NESTED_FROM_FIRST = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{1w1}
1. c1 b1
2. c2 b2

{1w1/2w1}
2. d1 b2
3. d2 b3`;

/**
 * Helper to load a PTN into the app
 */
async function loadPTN(page, ptn) {
  await page.evaluate(async (ptnText) => {
    const app = window.app;
    if (app && app.$store) {
      const game = {
        ptn: ptnText,
        name: "Test Game",
      };
      await app.$store.dispatch("game/ADD_GAME", game);
    }
  }, ptn);
  await page.waitForFunction(
    () => {
      const app = window.app;
      const game = app && app.$game;
      return game && game.board && game.plies && game.plies.length > 0;
    },
    { timeout: 10000 }
  );
}

/**
 * Helper to validate the game (returns true if valid, error string otherwise)
 */
async function validateGame(page) {
  return await page.evaluate(() => {
    const Game = window.app.$game.constructor;
    const game = window.app.$game;
    return Game.validate(game.toString({ showAllBranches: true }), true);
  });
}

test.describe("Branch at First Ply", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store);
  });

  test("Original bug: PTN with branches at TPS move loads without errors", async ({
    page,
  }) => {
    // This was the original bug report — loading this PTN caused
    // "Player does not control initial square f5"
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warn") {
        const text = msg.text();
        if (text.includes("Player does not control")) {
          errors.push(text);
        }
      }
    });

    await loadPTN(page, PTN_BRANCH_AT_TPS);

    expect(errors).toEqual([]);
  });

  test("Original bug: PTN round-trip preserves all branches", async ({
    page,
  }) => {
    await loadPTN(page, PTN_BRANCH_AT_TPS);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const branchKeys = Object.keys(game.branches).sort();
      const ptn = game.toString({ showAllBranches: true });
      return { branchKeys, ptn };
    });

    // All branches from the original PTN must be present
    expect(result.branchKeys).toContain("");
    expect(result.branchKeys).toContain("16w1");
    expect(result.branchKeys).toContain("16w1/17w1");
    expect(result.branchKeys).toContain("16w1/17w1/17b1");
    expect(result.branchKeys).toContain("16w1/17w1/17b1/18b1");
    expect(result.branchKeys).toContain("16w1/19w1");
    expect(result.branchKeys).toContain("16b1");

    // PTN output must contain key moves from each branch
    expect(result.ptn).toContain("f5<");
    expect(result.ptn).toContain("3d5>");
    expect(result.ptn).toContain("c6<");
    expect(result.ptn).toContain("Ce2");
    expect(result.ptn).toContain("2c5>");
  });

  test("Original bug: validation passes after loading", async ({ page }) => {
    await loadPTN(page, PTN_BRANCH_AT_TPS);
    const isValid = await validateGame(page);
    expect(isValid).toBe(true);
  });

  test("Original bug: can navigate to every branch without errors", async ({
    page,
  }) => {
    await loadPTN(page, PTN_BRANCH_AT_TPS);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const errors = [];

      for (const [branch, ply] of Object.entries(game.branches)) {
        if (!branch) continue;
        try {
          const ok = game.board.goToPly(ply.id, true);
          if (!ok) {
            errors.push(`goToPly failed for branch "${branch}"`);
          }
          game.board.last();
        } catch (e) {
          errors.push(`Error navigating to branch "${branch}": ${e.message}`);
        }
      }

      return errors;
    });

    expect(result).toEqual([]);
  });

  test("Branch at move 1: no self-referential children on root ply", async ({
    page,
  }) => {
    await loadPTN(page, PTN_BRANCH_AT_MOVE_1);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const rootPly = game.branches[""];
      const issues = [];

      // Root ply must NOT be in its own children array
      if (rootPly.children.includes(rootPly)) {
        issues.push("Root ply is in its own children array (self-reference)");
      }

      // Root ply should have branches
      if (rootPly.branches.length < 2) {
        issues.push(
          `Root ply should have branches, got ${rootPly.branches.length}`
        );
      }

      return { ok: issues.length === 0, issues };
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.log("Issues:", result.issues);
    }
  });

  test("Branch at move 1: all branches appear in output", async ({ page }) => {
    await loadPTN(page, PTN_BRANCH_AT_MOVE_1);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      return {
        branchKeys: Object.keys(game.branches).sort(),
        ptn: game.toString({ showAllBranches: true }),
      };
    });

    expect(result.branchKeys).toContain("");
    expect(result.branchKeys).toContain("1w1");
    expect(result.ptn).toContain("a1");
    expect(result.ptn).toContain("c1");
  });

  test("Branch at move 1: validation passes", async ({ page }) => {
    await loadPTN(page, PTN_BRANCH_AT_MOVE_1);
    const isValid = await validateGame(page);
    expect(isValid).toBe(true);
  });

  test("Branch at move 1 black: all branches preserved", async ({ page }) => {
    await loadPTN(page, PTN_BRANCH_AT_MOVE_1_BLACK);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      return {
        branchKeys: Object.keys(game.branches).sort(),
        ptn: game.toString({ showAllBranches: true }),
      };
    });

    expect(result.branchKeys).toContain("");
    expect(result.branchKeys).toContain("1b1");
    expect(result.ptn).toContain("b1");
    expect(result.ptn).toContain("c1");

    const isValid = await validateGame(page);
    expect(isValid).toBe(true);
  });

  test("Multiple branches at first ply: all branches preserved", async ({
    page,
  }) => {
    await loadPTN(page, PTN_MULTI_BRANCH_AT_FIRST);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      return {
        branchKeys: Object.keys(game.branches).sort(),
        ptn: game.toString({ showAllBranches: true }),
      };
    });

    expect(result.branchKeys).toContain("");
    expect(result.branchKeys).toContain("1w1");
    expect(result.branchKeys).toContain("1w2");
    expect(result.ptn).toContain("a1");
    expect(result.ptn).toContain("c1");
    expect(result.ptn).toContain("d1");

    const isValid = await validateGame(page);
    expect(isValid).toBe(true);
  });

  test("Nested branch from first ply: all branches preserved", async ({
    page,
  }) => {
    await loadPTN(page, PTN_NESTED_FROM_FIRST);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      return {
        branchKeys: Object.keys(game.branches).sort(),
        ptn: game.toString({ showAllBranches: true }),
      };
    });

    expect(result.branchKeys).toContain("");
    expect(result.branchKeys).toContain("1w1");
    expect(result.branchKeys).toContain("1w1/2w1");
    expect(result.ptn).toContain("a1");
    expect(result.ptn).toContain("c1");
    expect(result.ptn).toContain("d1");

    const isValid = await validateGame(page);
    expect(isValid).toBe(true);
  });

  test("Branch at first ply: navigation round-trip preserves board state", async ({
    page,
  }) => {
    await loadPTN(page, PTN_BRANCH_AT_MOVE_1);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const errors = [];

      // Navigate to branch end
      const branchPly = game.branches["1w1"];
      game.board.goToPly(branchPly.id, true);
      game.board.last();
      const branchTPS = game.board.tps;

      // Navigate back to main branch end
      const mainPly = game.branches[""];
      game.board.goToPly(mainPly.id, true);
      game.board.last();
      const mainTPS = game.board.tps;

      // Navigate to branch again — should produce same TPS
      game.board.goToPly(branchPly.id, true);
      game.board.last();
      const branchTPS2 = game.board.tps;

      if (branchTPS !== branchTPS2) {
        errors.push(
          `Branch TPS changed after round-trip: "${branchTPS}" vs "${branchTPS2}"`
        );
      }

      return { ok: errors.length === 0, errors, branchTPS, mainTPS };
    });

    expect(result.ok).toBe(true);
    // Branch and main should produce different board states
    expect(result.branchTPS).not.toBe(result.mainTPS);
  });

  test("isInBranch: correct at ply index 0 boundaries", async ({ page }) => {
    await loadPTN(page, PTN_BRANCH_AT_MOVE_1);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const issues = [];
      const rootPly = game.branches[""];
      const branchPly = game.branches["1w1"];

      // Root ply (index 0, branch "") should NOT be "in" branch "1w1"
      if (rootPly.isInBranch("1w1")) {
        issues.push('Root ply incorrectly reports isInBranch("1w1") = true');
      }

      // Root ply should be in its own branch
      if (!rootPly.isInBranch("")) {
        issues.push('Root ply reports isInBranch("") = false');
      }

      // Branch ply should be in its own branch
      if (!branchPly.isInBranch("1w1")) {
        issues.push('Branch ply reports isInBranch("1w1") = false');
      }

      // Branch ply should NOT be in the main branch
      if (branchPly.isInBranch("")) {
        issues.push('Branch ply incorrectly reports isInBranch("") = true');
      }

      return { ok: issues.length === 0, issues };
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.log("Issues:", result.issues);
    }
  });

  test("getBranchesSorted: discovers branches at root ply", async ({
    page,
  }) => {
    await loadPTN(page, PTN_MULTI_BRANCH_AT_FIRST);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const sorted = game.getBranchesSorted();
      return sorted;
    });

    // Should contain main branch and both first-ply branches
    expect(result).toContain("");
    expect(result).toContain("1w1");
    expect(result).toContain("1w2");
  });

  test("getBranchesSorted: correct order (first-ply branches before later ones)", async ({
    page,
  }) => {
    // Use a PTN with branches at both the first ply and a later ply
    const ptn = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{1w1}
1. c1 b1

{3w1}
3. d1 b3`;

    await loadPTN(page, ptn);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      return game.getBranchesSorted();
    });

    // "1w1" branches at move 1, "3w1" branches at move 3
    // "1w1" should come before "3w1" in the sorted output
    const idx1w1 = result.indexOf("1w1");
    const idx3w1 = result.indexOf("3w1");
    expect(idx1w1).toBeGreaterThan(-1);
    expect(idx3w1).toBeGreaterThan(-1);
    expect(idx1w1).toBeLessThan(idx3w1);
  });

  test("removeBranch: safe when branch point is first ply", async ({
    page,
  }) => {
    await loadPTN(page, PTN_BRANCH_AT_MOVE_1);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const rootPly = game.branches[""];
      const branchPly = game.branches["1w1"];

      // Remove the branch
      rootPly.removeBranch(branchPly);

      // Root ply should have no branches now
      if (rootPly.branches.length !== 0) {
        return {
          ok: false,
          error: `Root ply still has ${rootPly.branches.length} branches after removal`,
        };
      }

      // Branch should be removed from game.branches
      if ("1w1" in game.branches) {
        return { ok: false, error: "Branch 1w1 still in game.branches" };
      }

      return { ok: true };
    });

    expect(result.ok).toBe(true);
  });
});
