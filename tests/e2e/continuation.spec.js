// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Continuation E2E Tests
 *
 * These tests verify that the `...` continuation placeholder works correctly.
 * Continuations appear at the end of branches without results and can have
 * comments and branches attached to them.
 */

// Test fixtures - PTN strings for various test scenarios
const PTN_FIXTURES = {
  // Simple game without continuation (should have ... added)
  SIMPLE_GAME: `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3
`,

  // Game with result (should NOT have ... added) - real road win game
  GAME_WITH_RESULT: `[Size "6"]
[Result "0-R"]

1. a6 b6 2. c4 b4 3. c3 Cd4 4. d3 b3 5. c2 b5
6. b2 d2 7. e3 a5 8. e4 d4- 9. e2 2d3< 10. e5 d3
11. c4< f3 12. e6 f3< 13. f3 a3 14. e1 d2> 15. e1+ f4
16. 2e2+ d3> 17. f3< 3c3>12 18. d2 6e3<15 19. e4- e4 20. 2e3+ f4<
21. e5- Sd4 22. f3 5c3- 23. Ce5 6c2>33 24. f2 3e2+12 25. f4 6e4-15
26. f1 e4> 27. a4 c3 28. b2+ c4 29. c5 c4< 30. a4> b5-
31. 2b3+ b3 32. 5b4-23 6e2<114 33. f3< b1 34. b6< b6 35. Sb5 a4
36. e4 5b2+221 0-R`,

  // Game with branches (each branch should have ...)
  GAME_WITH_BRANCHES: `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{3w1}
3. c1 b3
4. c2 b4
`,

  // Game with explicit continuation
  GAME_WITH_CONTINUATION: `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 ...
`,

  // Empty game (should have ... at start)
  EMPTY_GAME: `[Size "6"]
[Opening "swap"]
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
      return game && game.board;
    },
    { timeout: 10000 }
  );
}

/**
 * Helper to get the current game state
 */
async function getGameState(page) {
  return await page.evaluate(() => {
    const game = window.app.$game;
    if (!game) return null;
    return {
      plyCount: game.plies.length,
      moveCount: game.moves.length,
      branchKeys: Object.keys(game.branches).sort(),
      ptn: game.toString({ showAllBranches: true }),
      plyID: game.board.plyID,
      plyIsDone: game.board.plyIsDone,
      tps: game.board.tps,
      hasContinuation: game.plies.some((p) => p && p.isContinuation),
      continuationCount: game.plies.filter((p) => p && p.isContinuation).length,
    };
  });
}

/**
 * Helper to play a move
 */
async function playMove(page, move) {
  await page.evaluate(async (moveText) => {
    const store = window.app.$store;
    await store.dispatch("game/INSERT_PLY", moveText);
  }, move);
}

/**
 * Helper to navigate to end
 */
async function goToEnd(page) {
  await page.evaluate(async () => {
    await window.app.$store.dispatch("game/LAST");
  });
}

/**
 * Helper to navigate to start
 */
async function goToStart(page) {
  await page.evaluate(async () => {
    await window.app.$store.dispatch("game/FIRST");
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

test.describe("Continuation Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store);
  });

  test.describe("Continuation Display", () => {
    test("Simple game without explicit continuation gets continuation auto-added", async ({
      page,
    }) => {
      await loadPTN(page, PTN_FIXTURES.SIMPLE_GAME);
      const state = await getGameState(page);

      // Continuations are auto-added at the end of branches
      expect(state.hasContinuation).toBe(true);
    });

    test("Game with result does NOT have continuation", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_RESULT);
      const state = await getGameState(page);

      expect(state.hasContinuation).toBe(false);
    });

    test("Explicit continuation in PTN is parsed correctly", async ({
      page,
    }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);
      const state = await getGameState(page);

      expect(state.hasContinuation).toBe(true);
      expect(state.ptn).toContain("...");
    });

    test("Continuation cannot be done - always shows as undone", async ({
      page,
    }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      // Navigate to the continuation
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation) {
          // Try to go to continuation with isDone=true
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.id,
            isDone: true,
          });
        }
      });

      // Verify continuation is NOT done
      const state = await page.evaluate(() => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        return {
          plyID: game.board.plyID,
          plyIsDone: game.board.plyIsDone,
          isContinuation: continuation && game.board.plyID === continuation.id,
        };
      });

      expect(state.isContinuation).toBe(true);
      expect(state.plyIsDone).toBe(false);
    });

    test("Continuation cannot be deleted", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      const before = await getGameState(page);
      expect(before.hasContinuation).toBe(true);

      // Try to delete the continuation
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.id,
            isDone: false,
          });
          await window.app.$store.dispatch("game/DELETE_PLY");
        }
      });

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      // Continuation should still exist
      expect(after.hasContinuation).toBe(true);
    });

    test("Continuation has correct color for Player 2", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      const contInfo = await page.evaluate(() => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation) {
          return {
            player: continuation.player,
            color: continuation.color,
          };
        }
        return null;
      });

      expect(contInfo).not.toBeNull();
      expect(contInfo.player).toBe(2);
      // Without swap opening on move 3+, player 2 should have color 2
      expect(contInfo.color).toBe(2);
    });
  });

  test.describe("Playing Moves", () => {
    test("Can play move from scratch (new game)", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.EMPTY_GAME);

      await playMove(page, "a1");

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.ptn).toContain("a1");
    });

    test("Can play moves on existing game without continuation in PTN", async ({
      page,
    }) => {
      // Load PTN without explicit continuation
      const ptnWithoutContinuation = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2`;

      await loadPTN(page, ptnWithoutContinuation);
      await goToEnd(page);

      const before = await getGameState(page);

      await playMove(page, "a3");

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.ptn).toContain("a3");
      expect(after.plyCount).toBeGreaterThan(before.plyCount - 1); // Account for continuation
    });

    test("Playing move when continuation is selected adds it as a branch", async ({
      page,
    }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      // Navigate to the continuation (select it, not done)
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.id,
            isDone: false,
          });
        }
      });

      const before = await getGameState(page);

      await playMove(page, "b3");

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.ptn).toContain("b3");
      // Should have created a branch
      expect(after.branchKeys.length).toBeGreaterThan(before.branchKeys.length);
    });

    test("Playing move when ply before continuation is selected replaces it", async ({
      page,
    }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      // Navigate to the ply BEFORE the continuation (a3, done)
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation && continuation.parent) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.parent.id,
            isDone: true,
          });
        }
      });

      await playMove(page, "b3");

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.ptn).toContain("b3");
      // Should still have a continuation after the new move
      expect(after.hasContinuation).toBe(true);
    });

    test("Can play full game from scratch", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.EMPTY_GAME);

      const moves = ["a1", "b1", "a2", "b2", "a3", "b3"];
      for (const move of moves) {
        await playMove(page, move);
      }

      const state = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(state.ptn).toContain("a1");
      expect(state.ptn).toContain("b3");
    });

    test("Playing move from Player 1 continuation creates valid branch", async ({
      page,
    }) => {
      // Create a game where continuation is in Player 1's slot (after move 3 player 2)
      const ptnWithP1Continuation = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3`;

      await loadPTN(page, ptnWithP1Continuation);

      // Navigate to the continuation (which should be auto-generated)
      const navResult = await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.id,
            isDone: false,
          });
          return {
            found: true,
            player: continuation.player,
            moveNumber: continuation.move?.number,
          };
        }
        return { found: false };
      });

      expect(navResult.found).toBe(true);
      expect(navResult.player).toBe(1); // Player 1's turn after b3

      await playMove(page, "a4");

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.ptn).toContain("a4");
      // Should have valid PTN structure
      expect(after.branchKeys.length).toBeGreaterThan(0);
    });

    test("PTN remains valid after replacing continuation and playing more moves", async ({
      page,
    }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      // Navigate to ply before continuation
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation && continuation.parent) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.parent.id,
            isDone: true,
          });
        }
      });

      // Play multiple moves
      await playMove(page, "b3");
      await playMove(page, "a4");
      await playMove(page, "b4");

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.ptn).toContain("b3");
      expect(after.ptn).toContain("a4");
      expect(after.ptn).toContain("b4");
    });
  });

  test.describe("Creating Branches", () => {
    test("Can create branch from existing position", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.SIMPLE_GAME);

      // Go to move 2
      await page.evaluate(async () => {
        const game = window.app.$game;
        const ply = game.plies.find(
          (p) => p && !p.isContinuation && p.move.number === 2 && p.player === 2
        );
        if (ply) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: ply.id,
            isDone: true,
          });
        }
      });

      // Play a different move to create branch
      await playMove(page, "c3");

      const state = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(state.branchKeys.length).toBeGreaterThan(1);
      expect(state.ptn).toContain("c3");
    });

    test("New branch ends with continuation", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.SIMPLE_GAME);

      // Go to move 2 player 2
      await page.evaluate(async () => {
        const game = window.app.$game;
        const ply = game.plies.find(
          (p) => p && !p.isContinuation && p.move.number === 2 && p.player === 2
        );
        if (ply) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: ply.id,
            isDone: true,
          });
        }
      });

      // Play a different move to create branch
      await playMove(page, "c3");

      // Check that the new branch has a continuation at its end
      const result = await page.evaluate(() => {
        const game = window.app.$game;
        // Find all branches
        const branches = Object.keys(game.branches);
        // Find the new branch (not the main branch)
        const newBranch = branches.find((b) => b !== "");
        if (!newBranch) return { hasBranch: false };

        // Find continuation in the new branch
        const branchContinuation = game.plies.find(
          (p) => p && p.isContinuation && p.branch === newBranch
        );

        return {
          hasBranch: true,
          branchName: newBranch,
          hasContinuation: !!branchContinuation,
          continuationPlayer: branchContinuation?.player,
        };
      });

      expect(result.hasBranch).toBe(true);
      expect(result.hasContinuation).toBe(true);
    });

    test("Can create multiple branches", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.SIMPLE_GAME);

      // Go to move 2
      await page.evaluate(async () => {
        const game = window.app.$game;
        const ply = game.plies.find(
          (p) => p && !p.isContinuation && p.move.number === 2 && p.player === 2
        );
        if (ply) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: ply.id,
            isDone: true,
          });
        }
      });

      // Play a different move to create branch
      await playMove(page, "c3");

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.branchKeys.length).toBeGreaterThan(1);
    });
  });

  test.describe("Trimming", () => {
    test("Trim to ply produces valid game", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.SIMPLE_GAME);

      // Go to move 2
      await page.evaluate(async () => {
        const game = window.app.$game;
        const ply = game.plies.find(
          (p) => p && !p.isContinuation && p.move.number === 2 && p.player === 2
        );
        if (ply) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: ply.id,
            isDone: true,
          });
        }
      });

      // Trim to current position
      await page.evaluate(async () => {
        await window.app.$store.dispatch("game/TRIM_TO_PLY");
      });

      const state = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
    });

    test("Trim to board works correctly", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.SIMPLE_GAME);

      // Go to move 2
      await page.evaluate(async () => {
        const game = window.app.$game;
        const ply = game.plies.find(
          (p) => p && !p.isContinuation && p.move.number === 2 && p.player === 2
        );
        if (ply) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: ply.id,
            isDone: true,
          });
        }
      });

      // Trim to board (creates new game from current position)
      await page.evaluate(async () => {
        await window.app.$store.dispatch("game/TRIM_TO_BOARD");
      });

      const state = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
    });
  });

  test.describe("Comments on Continuation", () => {
    test("Can add note to continuation", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      // Navigate to continuation
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.id,
            isDone: false,
          });
        }
      });

      // Add a note
      await page.evaluate(async () => {
        const game = window.app.$game;
        game.addNote("This is a note on continuation");
      });

      const state = await getGameState(page);

      expect(state.ptn).toContain("This is a note on continuation");
    });
  });

  test.describe("Undo and Redo", () => {
    test("Undo after playing move restores original state", async ({
      page,
    }) => {
      await loadPTN(page, PTN_FIXTURES.SIMPLE_GAME);

      const before = await getGameState(page);
      const beforePtn = before.ptn;

      // Play a move
      await goToEnd(page);
      await playMove(page, "a4");

      const afterMove = await getGameState(page);
      expect(afterMove.ptn).toContain("a4");

      // Undo
      await page.evaluate(async () => {
        await window.app.$store.dispatch("game/UNDO");
      });

      const afterUndo = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      // PTN should be back to original
      expect(afterUndo.ptn).toBe(beforePtn);
    });

    test("Redo after undo restores the move", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.SIMPLE_GAME);

      // Play a move
      await goToEnd(page);
      await playMove(page, "a4");

      const afterMove = await getGameState(page);
      const movePtn = afterMove.ptn;

      // Undo
      await page.evaluate(async () => {
        await window.app.$store.dispatch("game/UNDO");
      });

      // Redo
      await page.evaluate(async () => {
        await window.app.$store.dispatch("game/REDO");
      });

      const afterRedo = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(afterRedo.ptn).toBe(movePtn);
    });

    test("Multiple undo/redo cycles work correctly", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.SIMPLE_GAME);

      const initial = await getGameState(page);

      // Play multiple moves
      await goToEnd(page);
      await playMove(page, "a4");
      await playMove(page, "b4");
      await playMove(page, "a5");

      // Undo all
      await page.evaluate(async () => {
        await window.app.$store.dispatch("game/UNDO");
        await window.app.$store.dispatch("game/UNDO");
        await window.app.$store.dispatch("game/UNDO");
      });

      const afterUndoAll = await getGameState(page);
      let isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(afterUndoAll.ptn).toBe(initial.ptn);

      // Redo all
      await page.evaluate(async () => {
        await window.app.$store.dispatch("game/REDO");
        await window.app.$store.dispatch("game/REDO");
        await window.app.$store.dispatch("game/REDO");
      });

      const afterRedoAll = await getGameState(page);
      isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(afterRedoAll.ptn).toContain("a4");
      expect(afterRedoAll.ptn).toContain("b4");
      expect(afterRedoAll.ptn).toContain("a5");
    });

    test("Undo after playing on empty game works", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.EMPTY_GAME);

      const before = await getGameState(page);

      // Play a move
      await playMove(page, "a1");

      // Undo
      await page.evaluate(async () => {
        await window.app.$store.dispatch("game/UNDO");
      });

      const afterUndo = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(afterUndo.ptn).toBe(before.ptn);
    });

    test("Continuation is preserved through undo after replacing it", async ({
      page,
    }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      const before = await getGameState(page);
      expect(before.hasContinuation).toBe(true);
      expect(before.ptn).toContain("...");

      // Navigate to ply before continuation and play a move (replaces it)
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation && continuation.parent) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.parent.id,
            isDone: true,
          });
        }
      });

      await playMove(page, "b3");

      const afterMove = await getGameState(page);
      expect(afterMove.ptn).toContain("b3");

      // Undo - should restore the original continuation
      await page.evaluate(async () => {
        await window.app.$store.dispatch("game/UNDO");
      });

      const afterUndo = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(afterUndo.ptn).toContain("...");
      expect(afterUndo.hasContinuation).toBe(true);
    });

    test("Continuation persists when game is reloaded from PTN", async ({
      page,
    }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      const before = await getGameState(page);
      expect(before.hasContinuation).toBe(true);
      expect(before.ptn).toContain("...");

      // Get the PTN and reload it
      const ptn = await page.evaluate(() => window.app.$game.ptn);

      await loadPTN(page, ptn);

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.hasContinuation).toBe(true);
      expect(after.ptn).toContain("...");
    });
  });

  test.describe("Ply Deletion", () => {
    test("Deleting a ply preserves game validity", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      // Play some moves first
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation && continuation.parent) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.parent.id,
            isDone: true,
          });
        }
      });
      await playMove(page, "b3");
      await playMove(page, "a4");

      const before = await getGameState(page);
      expect(before.ptn).toContain("b3");
      expect(before.ptn).toContain("a4");

      // Delete the last ply (a4)
      await page.evaluate(async () => {
        const game = window.app.$game;
        const lastPly = game.plies.filter((p) => p && !p.isContinuation).pop();
        if (lastPly) {
          await window.app.$store.dispatch("game/DELETE_PLY", lastPly.id);
        }
      });

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.ptn).toContain("b3");
      expect(after.ptn).not.toContain("a4");
      expect(after.hasContinuation).toBe(true);
    });

    test("Deleting a ply from a branch preserves other branches", async ({
      page,
    }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_BRANCHES);

      const before = await getGameState(page);
      const branchCountBefore = before.branchKeys.length;

      // Delete a ply from a branch
      await page.evaluate(async () => {
        const game = window.app.$game;
        // Find a ply in a non-main branch
        const branchPly = game.plies.find(
          (p) => p && p.branch && p.branch !== "" && !p.isContinuation
        );
        if (branchPly) {
          await window.app.$store.dispatch("game/DELETE_PLY", branchPly.id);
        }
      });

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      // Should have fewer branches after deletion
      expect(after.branchKeys.length).toBeLessThan(branchCountBefore);
    });

    test("Continuation cannot be deleted", async ({ page }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      const before = await getGameState(page);
      expect(before.hasContinuation).toBe(true);

      // Try to delete the continuation
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation) {
          try {
            await window.app.$store.dispatch(
              "game/DELETE_PLY",
              continuation.id
            );
          } catch (e) {
            // Expected to fail
          }
        }
      });

      const after = await getGameState(page);

      // Continuation should still exist
      expect(after.hasContinuation).toBe(true);
      expect(after.continuationCount).toBe(before.continuationCount);
    });

    test("Deleting ply2 deletes descendants and moves continuation", async ({
      page,
    }) => {
      // Game: 1. a1 b1  2. a2 b2  3. a3 ...
      // After deleting b2 (with removeDescendents): 1. a1 b1  2. a2 ...
      // (a3 is also deleted as a descendant)
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      const before = await page.evaluate(() => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        return {
          continuationPlayer: continuation?.player,
          continuationMoveNumber: continuation?.move?.number,
          ptn: game.ptn,
        };
      });

      // Continuation should be player 2 on move 3 (after a3)
      expect(before.continuationPlayer).toBe(2);
      expect(before.continuationMoveNumber).toBe(3);

      // Delete b2 (with removeDescendents=true, this also deletes a3)
      await page.evaluate(async () => {
        const game = window.app.$game;
        const b2Ply = game.plies.find(
          (p) => p && !p.isContinuation && p.toString() === "b2"
        );
        if (b2Ply) {
          // Navigate to b2 first
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: b2Ply.id,
            isDone: true,
          });
          await window.app.$store.dispatch("game/DELETE_PLY", b2Ply.id);
        }
      });

      const after = await page.evaluate(() => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        return {
          continuationPlayer: continuation?.player,
          continuationMoveNumber: continuation?.move?.number,
          ptn: game.ptn,
          hasContinuation: !!continuation,
        };
      });
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.hasContinuation).toBe(true);
      // After deleting b2 and its descendants, continuation should be after a2
      expect(after.ptn).not.toContain("b2");
      expect(after.ptn).not.toContain("a3");
      // Continuation should now be player 2 on move 2 (after a2, as ply2 of same move)
      expect(after.continuationPlayer).toBe(2);
      expect(after.continuationMoveNumber).toBe(2);
    });

    test("Deleting ply1 moves continuation appropriately", async ({ page }) => {
      // Create a game where we can delete ply1 and see continuation move
      const ptn = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 ...`;

      await loadPTN(page, ptn);

      const before = await page.evaluate(() => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        return {
          continuationPlayer: continuation?.player,
          continuationMoveNumber: continuation?.move?.number,
          ptn: game.ptn,
        };
      });

      // Continuation should be player 2 on move 2 (after a2)
      expect(before.continuationPlayer).toBe(2);
      expect(before.continuationMoveNumber).toBe(2);

      // Delete a2
      await page.evaluate(async () => {
        const game = window.app.$game;
        const a2Ply = game.plies.find(
          (p) => p && !p.isContinuation && p.toString() === "a2"
        );
        if (a2Ply) {
          // Navigate to a2 first
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: a2Ply.id,
            isDone: true,
          });
          await window.app.$store.dispatch("game/DELETE_PLY", a2Ply.id);
        }
      });

      const after = await page.evaluate(() => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        return {
          continuationPlayer: continuation?.player,
          continuationMoveNumber: continuation?.move?.number,
          ptn: game.ptn,
          hasContinuation: !!continuation,
        };
      });
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.hasContinuation).toBe(true);
      // After deleting a2, continuation should be after b1
      // b1 is ply2 of move 1, so continuation should be player 1 on move 2
      expect(after.ptn).not.toContain("a2");
      expect(after.continuationPlayer).toBe(1);
      expect(after.continuationMoveNumber).toBe(2);
    });

    test("Deleting last ply before continuation updates continuation parent", async ({
      page,
    }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      // Play a move to replace continuation, then delete it
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation && continuation.parent) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.parent.id,
            isDone: true,
          });
        }
      });
      await playMove(page, "b3");

      const afterPlay = await page.evaluate(() => {
        const game = window.app.$game;
        return {
          ptn: game.ptn,
          hasContinuation: game.plies.some((p) => p && p.isContinuation),
        };
      });
      expect(afterPlay.ptn).toContain("b3");
      expect(afterPlay.hasContinuation).toBe(true);

      // Now delete b3
      await page.evaluate(async () => {
        const game = window.app.$game;
        const b3Ply = game.plies.find(
          (p) => p && !p.isContinuation && p.toString() === "b3"
        );
        if (b3Ply) {
          // Navigate to b3 first
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: b3Ply.id,
            isDone: true,
          });
          await window.app.$store.dispatch("game/DELETE_PLY", b3Ply.id);
        }
      });

      const after = await page.evaluate(() => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        return {
          ptn: game.ptn,
          hasContinuation: !!continuation,
          continuationParentPtn: continuation?.parent?.toString(),
        };
      });
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.hasContinuation).toBe(true);
      expect(after.ptn).not.toContain("b3");
      // Continuation should now be after a3 again
      expect(after.continuationParentPtn).toBe("a3");
    });

    test("Deleting mainline ply with branches before continuation does not hang", async ({
      page,
    }) => {
      // Create a game with mainline ply that has branches, followed by continuation
      const ptn = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 ...

{2b1}
2. -- c2`;

      await loadPTN(page, ptn);

      const before = await page.evaluate(() => {
        const game = window.app.$game;
        return {
          ptn: game.ptn,
          branchCount: Object.keys(game.branches).length,
        };
      });
      expect(before.branchCount).toBeGreaterThan(1);

      // Delete a3 (mainline ply with branches, just before continuation)
      // This should not cause an infinite loop
      const deleteResult = await page.evaluate(async () => {
        const game = window.app.$game;
        const a3Ply = game.plies.find(
          (p) => p && !p.isContinuation && p.toString() === "a3"
        );
        if (a3Ply) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: a3Ply.id,
            isDone: true,
          });
          await window.app.$store.dispatch("game/DELETE_PLY", a3Ply.id);
          return { deleted: true };
        }
        return { deleted: false };
      });

      expect(deleteResult.deleted).toBe(true);

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.ptn).not.toContain("a3");
      expect(after.hasContinuation).toBe(true);
    });

    test("Deleting player 1 ply from branch updates continuation to player 2", async ({
      page,
    }) => {
      // Create a game with a branch that has multiple plies
      // Branch after a2: c3 (p2), d3 (p1), then continuation
      const ptn = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2

{2w1}
2. -- c3
3. d3`;

      await loadPTN(page, ptn);

      const before = await page.evaluate(() => {
        const game = window.app.$game;
        const continuation = game.plies.find(
          (p) => p && p.isContinuation && p.branch !== ""
        );
        return {
          ptn: game.ptn,
          continuationPlayer: continuation?.player,
          continuationMoveNumber: continuation?.move?.number,
        };
      });

      // Continuation should be player 2 on move 3 (after d3)
      expect(before.continuationPlayer).toBe(2);
      expect(before.continuationMoveNumber).toBe(3);

      // Delete d3 (player 1's ply in the branch)
      await page.evaluate(async () => {
        const game = window.app.$game;
        const d3Ply = game.plies.find(
          (p) => p && !p.isContinuation && p.toString() === "d3"
        );
        if (d3Ply) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: d3Ply.id,
            isDone: true,
          });
          await window.app.$store.dispatch("game/DELETE_PLY", d3Ply.id);
        }
      });

      const after = await page.evaluate(() => {
        const game = window.app.$game;
        // Find continuation in the branch
        const continuation = game.plies.find(
          (p) => p && p.isContinuation && p.branch !== ""
        );
        return {
          ptn: game.ptn,
          continuationPlayer: continuation?.player,
          continuationMoveNumber: continuation?.move?.number,
          hasBranchContinuation: !!continuation,
        };
      });
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.ptn).not.toContain("d3");
      expect(after.hasBranchContinuation).toBe(true);
      // After deleting d3, continuation should be player 1 on move 3 (taking d3's place)
      expect(after.continuationPlayer).toBe(1);
      expect(after.continuationMoveNumber).toBe(3);
    });

    test("Deleting player 2 ply moves continuation to player 2 position", async ({
      page,
    }) => {
      // Create a game where player 2's ply is the last ply before continuation
      // After deleting it, continuation should take player 2's position
      const ptn = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3`;

      await loadPTN(page, ptn);

      const before = await page.evaluate(() => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        return {
          ptn: game.ptn,
          continuationPlayer: continuation?.player,
          continuationMoveNumber: continuation?.move?.number,
        };
      });

      // Continuation should be player 1 on move 4 (after b3)
      expect(before.continuationPlayer).toBe(1);
      expect(before.continuationMoveNumber).toBe(4);

      // Delete b3 (player 2's ply) with timeout to catch infinite loops
      const deleteResult = await Promise.race([
        page.evaluate(async () => {
          const game = window.app.$game;
          const b3Ply = game.plies.find(
            (p) => p && !p.isContinuation && p.toString() === "b3"
          );
          if (b3Ply) {
            await window.app.$store.dispatch("game/GO_TO_PLY", {
              plyID: b3Ply.id,
              isDone: true,
            });
            await window.app.$store.dispatch("game/DELETE_PLY", b3Ply.id);
            return { success: true };
          }
          return { success: false, error: "b3 not found" };
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Delete timed out - possible infinite loop")), 5000)
        ),
      ]);

      expect(deleteResult.success).toBe(true);

      const after = await page.evaluate(() => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        const lastNonContPly = game.plies
          .filter((p) => p && !p.isContinuation)
          .pop();
        return {
          ptn: game.ptn,
          continuationPlayer: continuation?.player,
          continuationMoveNumber: continuation?.move?.number,
          hasContinuation: !!continuation,
          lastPlyPlayer: lastNonContPly?.player,
          lastPlyMoveNumber: lastNonContPly?.move?.number,
          lastPlyText: lastNonContPly?.toString(),
        };
      });
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.ptn).not.toContain("b3");
      expect(after.hasContinuation).toBe(true);
      // After deleting b3, continuation should be player 2 on move 3 (taking b3's place)
      expect(after.continuationPlayer).toBe(2);
      expect(after.continuationMoveNumber).toBe(3);
    });
  });

  test.describe("Branch from Continuation", () => {
    test("Playing move from continuation creates branch with continuation", async ({
      page,
    }) => {
      await loadPTN(page, PTN_FIXTURES.GAME_WITH_CONTINUATION);

      // Navigate to continuation
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.id,
            isDone: false,
          });
        }
      });

      // Play a move from the continuation
      await playMove(page, "c3");

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.ptn).toContain("c3");
      // Should have created a branch
      expect(after.branchKeys.length).toBeGreaterThan(1);
      // The new branch should have a continuation after it
      expect(after.hasContinuation).toBe(true);
    });

    test("Branch inherits continuation's branches when replacing it", async ({
      page,
    }) => {
      // Load a game with continuation that has branches
      const ptnWithBranchedContinuation = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 ...

{2b1}
2. -- c2`;

      await loadPTN(page, ptnWithBranchedContinuation);

      const before = await getGameState(page);
      expect(before.branchKeys.length).toBeGreaterThan(1);

      // Navigate to ply before continuation
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find(
          (p) => p && p.isContinuation && p.branch === ""
        );
        if (continuation && continuation.parent) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.parent.id,
            isDone: true,
          });
        }
      });

      // Play a move to replace the continuation
      await playMove(page, "b3");

      const after = await getGameState(page);
      const isValid = await validateGame(page);

      expect(isValid).toBe(true);
      expect(after.ptn).toContain("b3");
      // Should still have the branch
      expect(after.branchKeys.length).toBeGreaterThanOrEqual(
        before.branchKeys.length
      );
    });

    test("Replacing continuation inherits its comments", async ({ page }) => {
      // Load a game with continuation that has comments
      const ptnWithCommentedContinuation = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 ... {This is analysis for the next move}`;

      await loadPTN(page, ptnWithCommentedContinuation);

      // Verify continuation has the comment
      const before = await page.evaluate(() => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        return {
          continuationId: continuation?.id,
          hasNotes: continuation ? !!game.notes[continuation.id] : false,
          noteCount: continuation
            ? game.notes[continuation.id]?.length || 0
            : 0,
        };
      });
      expect(before.hasNotes).toBe(true);
      expect(before.noteCount).toBe(1);

      // Navigate to ply before continuation
      await page.evaluate(async () => {
        const game = window.app.$game;
        const continuation = game.plies.find((p) => p && p.isContinuation);
        if (continuation && continuation.parent) {
          await window.app.$store.dispatch("game/GO_TO_PLY", {
            plyID: continuation.parent.id,
            isDone: true,
          });
        }
      });

      // Play a move to replace the continuation
      await playMove(page, "b3");

      // Verify the new ply inherited the comment
      const after = await page.evaluate(() => {
        const game = window.app.$game;
        // Find the b3 ply
        const b3Ply = game.plies.find(
          (p) => p && !p.isContinuation && p.toString() === "b3"
        );
        return {
          b3PlyId: b3Ply?.id,
          hasNotes: b3Ply ? !!game.notes[b3Ply.id] : false,
          noteCount: b3Ply ? game.notes[b3Ply.id]?.length || 0 : 0,
          ptn: game.ptn,
        };
      });

      expect(after.hasNotes).toBe(true);
      expect(after.noteCount).toBe(1);
      expect(after.ptn).toContain("b3");
      expect(after.ptn).toContain("This is analysis");
    });
  });
});
