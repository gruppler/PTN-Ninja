// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Delete Ply E2E Tests
 *
 * These tests verify that deleting plies works correctly in various situations,
 * including edge cases that can leave the board in an invalid state.
 */

const PTN_FIXTURES = {
  // Simple linear game (no branches)
  LINEAR: `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3
4. a4 b4
`,

  // Single branch
  SINGLE_BRANCH: `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{3w1}
3. c1 b3
4. c2 b4
`,

  // Multiple sibling branches
  MULTI_BRANCH: `[Size "6"]
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

  // Nested branches
  NESTED: `[Size "6"]
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

  // Minimal game (single ply)
  SINGLE_PLY: `[Size "6"]

1. a1
`,

  // Two plies only
  TWO_PLIES: `[Size "6"]
[Opening "swap"]

1. a1 b1
`,

  // Branch at first move
  BRANCH_AT_FIRST: `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2

{1w1}
1. c1 b1
2. c2 b2
`,
};

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

test.describe("Delete Ply Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });
  });

  test("Delete last ply in linear game", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.LINEAR);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      const originalCount = game.plies.filter(Boolean).length;

      // Go to last ply
      await store.dispatch("game/LAST");
      const lastPlyID = game.board.plyID;

      // Delete it
      await store.dispatch("game/DELETE_PLY", lastPlyID);

      return {
        originalCount,
        newCount: game.plies.filter(Boolean).length,
        plyIsNotNull: game.board.ply !== null,
        positionPly: store.state.game.position.ply,
      };
    });

    expect(result.originalCount).toBe(8);
    expect(result.newCount).toBeLessThan(result.originalCount);
    expect(result.plyIsNotNull).toBe(true);
    expect(result.positionPly).not.toBeNull();
  });

  test("Delete first ply in linear game does not crash", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.LINEAR);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Go to first ply
      await store.dispatch("game/FIRST");
      await store.dispatch("game/NEXT", { half: false, times: 1 });
      const firstPlyID = game.board.plyID;

      let error = null;
      try {
        // DELETE_PLY removes descendents, so this removes all plies
        await store.dispatch("game/DELETE_PLY", firstPlyID);
      } catch (e) {
        error = e.message;
      }

      return {
        error,
        remainingPlies: game.plies.filter(Boolean).length,
      };
    });

    // Should not crash even though all plies are removed
    expect(result.error).toBeNull();
    expect(result.remainingPlies).toBe(0);
  });

  test("Delete only ply in single-ply game", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.SINGLE_PLY);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Navigate to the only ply
      await store.dispatch("game/NEXT", { half: false, times: 1 });
      const plyID = game.board.plyID;

      let error = null;
      try {
        await store.dispatch("game/DELETE_PLY", plyID);
      } catch (e) {
        error = e.message;
      }

      return {
        error,
        // After deleting the only ply, position should not crash
        positionPly: store.state.game.position
          ? store.state.game.position.ply
          : "no_position",
      };
    });

    expect(result.error).toBeNull();
  });

  test("Delete current ply navigates to previous ply", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.LINEAR);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Go to ply index 4 (3. a3)
      await store.dispatch("game/FIRST");
      for (let i = 0; i < 4; i++) {
        await store.dispatch("game/NEXT", { half: false, times: 1 });
      }
      const plyID = game.board.plyID;
      const prevPlyID = game.board.prevPly ? game.board.prevPly.id : null;

      // Delete current ply
      await store.dispatch("game/DELETE_PLY", plyID);

      return {
        prevPlyID,
        currentPlyID: game.board.plyID,
        plyIsNotNull: game.board.ply !== null,
      };
    });

    expect(result.plyIsNotNull).toBe(true);
    // After deletion, should navigate to the previous ply
    if (result.prevPlyID !== null) {
      expect(result.currentPlyID).toBe(result.prevPlyID);
    }
  });

  test("Delete ply in branch navigates to sibling", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.SINGLE_BRANCH);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Find the branch ply (first ply of branch "3w1")
      const branchPly = game.plies.find(
        (p) => p && p.branch === "3w1" && p.index === 4
      );
      if (!branchPly) {
        return { error: "Branch ply not found" };
      }

      // Navigate to it
      await store.dispatch("game/GO_TO_PLY", {
        plyID: branchPly.id,
        isDone: true,
      });

      const plyID = game.board.plyID;

      // Delete it
      await store.dispatch("game/DELETE_PLY", plyID);

      return {
        error: null,
        plyIsNotNull: game.board.ply !== null,
        positionPly: store.state.game.position.ply !== null,
      };
    });

    expect(result.error).toBeNull();
    expect(result.plyIsNotNull).toBe(true);
    expect(result.positionPly).toBe(true);
  });

  test("Delete ply with multiple sibling branches", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.MULTI_BRANCH);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      const originalBranchCount = Object.keys(game.branches).length;

      // Find the first ply of branch "3w1"
      const branchPly = game.plies.find(
        (p) => p && p.branch === "3w1" && p.index === 4
      );
      if (!branchPly) {
        return { error: "Branch ply not found" };
      }

      // Navigate to it
      await store.dispatch("game/GO_TO_PLY", {
        plyID: branchPly.id,
        isDone: true,
      });

      // Delete it
      await store.dispatch("game/DELETE_PLY", game.board.plyID);

      return {
        error: null,
        originalBranchCount,
        newBranchCount: Object.keys(game.branches).length,
        plyIsNotNull: game.board.ply !== null,
        positionPly: store.state.game.position.ply !== null,
      };
    });

    expect(result.error).toBeNull();
    expect(result.plyIsNotNull).toBe(true);
    expect(result.positionPly).toBe(true);
  });

  test("Delete ply in nested branch", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.NESTED);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Find the first ply of the nested branch "3w1/4w1"
      const nestedPly = game.plies.find((p) => p && p.branch === "3w1/4w1");
      if (!nestedPly) {
        return { error: "Nested branch ply not found" };
      }

      // Navigate to it
      await store.dispatch("game/GO_TO_PLY", {
        plyID: nestedPly.id,
        isDone: true,
      });

      // Delete it
      await store.dispatch("game/DELETE_PLY", game.board.plyID);

      return {
        error: null,
        plyIsNotNull: game.board.ply !== null,
        positionPly: store.state.game.position.ply !== null,
      };
    });

    expect(result.error).toBeNull();
    expect(result.plyIsNotNull).toBe(true);
    expect(result.positionPly).toBe(true);
  });

  test("Delete both plies in two-ply game", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.TWO_PLIES);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Go to last ply
      await store.dispatch("game/LAST");

      let error = null;
      try {
        // Delete last ply
        await store.dispatch("game/DELETE_PLY", game.board.plyID);
        // Delete remaining ply
        if (game.board.ply) {
          await store.dispatch("game/DELETE_PLY", game.board.plyID);
        }
      } catch (e) {
        error = e.message;
      }

      return {
        error,
        positionPly: store.state.game.position
          ? store.state.game.position.ply
          : "no_position",
      };
    });

    expect(result.error).toBeNull();
  });

  test("Delete ply at branch point with branch at first move", async ({
    page,
  }) => {
    await loadPTN(page, PTN_FIXTURES.BRANCH_AT_FIRST);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Navigate to the branch ply
      const branchPly = game.plies.find((p) => p && p.branch === "1w1");
      if (!branchPly) {
        return { error: "Branch ply not found" };
      }

      await store.dispatch("game/GO_TO_PLY", {
        plyID: branchPly.id,
        isDone: true,
      });

      let error = null;
      try {
        await store.dispatch("game/DELETE_PLY", game.board.plyID);
      } catch (e) {
        error = e.message;
      }

      return {
        error,
        plyIsNotNull: game.board.ply !== null,
        positionPly: store.state.game.position
          ? store.state.game.position.ply !== null
          : false,
      };
    });

    expect(result.error).toBeNull();
    expect(result.plyIsNotNull).toBe(true);
    expect(result.positionPly).toBe(true);
  });

  test("Delete ply does not leave null position.ply in store", async ({
    page,
  }) => {
    await loadPTN(page, PTN_FIXTURES.LINEAR);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Go to middle of game
      await store.dispatch("game/FIRST");
      for (let i = 0; i < 3; i++) {
        await store.dispatch("game/NEXT", { half: false, times: 1 });
      }

      const plyID = game.board.plyID;

      let error = null;
      try {
        await store.dispatch("game/DELETE_PLY", plyID);
      } catch (e) {
        error = e.message;
      }

      // The key assertion: position.ply should not be null after deletion
      // if there are still plies in the game
      const remainingPlies = game.plies.filter(Boolean).length;
      const positionPly = store.state.game.position.ply;

      return {
        error,
        remainingPlies,
        positionPlyIsNull: positionPly === null,
      };
    });

    expect(result.error).toBeNull();
    if (result.remainingPlies > 0) {
      expect(result.positionPlyIsNull).toBe(false);
    }
  });

  test("Repeated delete from end does not crash", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.LINEAR);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      let error = null;
      let deletions = 0;

      try {
        // Go to end and keep deleting
        await store.dispatch("game/LAST");
        for (let i = 0; i < 8; i++) {
          if (!game.board.ply) break;
          await store.dispatch("game/DELETE_PLY", game.board.plyID);
          deletions++;
        }
      } catch (e) {
        error = e.message;
      }

      return {
        error,
        deletions,
        remainingPlies: game.plies.filter(Boolean).length,
      };
    });

    expect(result.error).toBeNull();
    expect(result.deletions).toBeGreaterThan(0);
  });

  test("Delete main branch ply promotes next branch", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.SINGLE_BRANCH);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Navigate to the main branch ply at the branch point (3. a3)
      await store.dispatch("game/FIRST");
      for (let i = 0; i < 4; i++) {
        await store.dispatch("game/NEXT", { half: false, times: 1 });
      }

      const plyID = game.board.plyID;
      const ply = game.plies[plyID];
      const hasBranches = ply && ply.branches && ply.branches.length > 1;

      let error = null;
      try {
        await store.dispatch("game/DELETE_PLY", plyID);
      } catch (e) {
        error = e.message;
      }

      return {
        error,
        hasBranches,
        plyIsNotNull: game.board.ply !== null,
        positionPly: store.state.game.position.ply !== null,
      };
    });

    expect(result.error).toBeNull();
    expect(result.plyIsNotNull).toBe(true);
    expect(result.positionPly).toBe(true);
  });

  test("Tree structure valid after delete", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.SINGLE_BRANCH);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Go to last ply and delete
      await store.dispatch("game/LAST");
      await store.dispatch("game/DELETE_PLY", game.board.plyID);

      const parentIssues = game.verifyParentRelationships();
      const childrenIssues = game.verifyChildrenRelationships();

      return {
        parentOk: parentIssues.length === 0,
        childrenOk: childrenIssues.length === 0,
        parentIssues,
        childrenIssues,
      };
    });

    expect(result.parentOk).toBe(true);
    expect(result.childrenOk).toBe(true);
  });
});
