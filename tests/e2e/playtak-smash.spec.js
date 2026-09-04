// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Test for PlayTak smash move handling.
 * 
 * Bug: When a PlayTak move that smashes a wall comes in (e.g., "3a1+111" 
 * which is a capstone moving from a1 to a4 crushing a wall at a4), 
 * the move was recorded without the smash notation (*) and navigating 
 * back would restore the wall as a flat instead of a wall.
 * 
 * Uses the actual game from the session (PlayTak ID 869820) up to move 25w.
 * Move 25w is 3a1+111* which smashes the wall at a4.
 * Expected: Move recorded as 3a1+111*, wall at a4 stays wall after prev()
 */

const PTN_UP_TO_25W = `[Site "PlayTak.com"]
[Event "Online Play"]
[Date "2026.09.03"]
[Time "15:02:40"]
[Player1 "Taket"]
[Rating1 "2099"]
[Player2 "Sn0oT"]
[Rating2 "1864"]
[Clock "20:0 +15 @35 +10:0"]
[Size "6"]
[Komi "2"]
[Flats "30"]
[Caps "1"]
[Opening "swap"]
[PlayTakID "869820"]
[Result "R-0"]

1. a1 f6
2. d4 c3
3. c4 d3
4. b4 Ce4
5. b3 e3
6. b2 b1
7. c2 c1
8. Cd2 d1
9. e1 e2
10. b5 b6
11. c5 Sc6
12. a6 b6-
13. a4 f3
14. e1<' c1>
15. a5' 2b5<
16. d2- e5
17. d2 e6'
18. f6< c6-
19. a4+' b1+
20. 3a5-12' 2c5-
21. 4d1<112' 3c4<12
22. b5' 2b2+
23. 2b4-11' Sb4
24. 3b3>12 e3<
25. 3a1+111*"`;

test.describe("PlayTak smash move handling", () => {
  test("PlayTak smash move records wallSmash and restores wall on prev", async ({ page }) => {
    await page.goto("http://localhost:8081/");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });

    // Load the game from PTN up to move 25w (before the smash move)
    const evalResult = await page.evaluate(async ({ ptn }) => {
      const store = window.app.$store;
      const Game = window.Game;
      
      console.log("Creating game from PTN...");
      // Create game from PTN up to move 25w (before the smash)
      const game = new Game({
        ptn: ptn,
        config: { playtakID: "test-smash", playtakLive: false, playtakSyncedMainline: 0 },
      });
      
      console.log("Game created, plies:", game.plies.length);
      // Navigate to the end of main branch (before the smash move)
      game.board.goToEndOfMainBranch();
      console.log("Navigated to end of main branch, ply:", game.board.ply ? game.board.ply.text : "none");
      
      try {
        console.log("Dispatching ADD_GAME...");
        await store.dispatch("game/ADD_GAME", game);
        console.log("Game added successfully");
      } catch (e) {
        console.error("Failed to add game:", e);
        throw e;
      }
      
      // Verify the game was set
      console.log("Current game:", window.app.$game ? "set" : "not set");
      console.log("Game plies:", window.app.$game ? window.app.$game.plies.length : 0);
      
      return { success: true, plies: game.plies.length };
    }, { ptn: PTN_UP_TO_25W });
    
    console.log("Eval result:", evalResult);

    // Navigate to the position BEFORE the smash move (before 25w 3a1+111*)
    // The current ply is the smash move, so we need to go back one ply
    await page.evaluate(() => {
      const game = window.app.$game;
      game.board.prev();
    });

    // Verify the game was loaded and has the correct board position (wall at a4)
    await page.waitForFunction(() => {
      const game = window.app.$game;
      return game && game.board && game.board.getSquare("a4").isStanding === true;
    }, { timeout: 10000 });

    // Verify initial wall at a4
    const initialWallState = await page.evaluate(() => {
      const game = window.app.$game;
      const square = game.board.getSquare("a4");
      return {
        isStanding: square.isStanding,
        topPiece: square.piece ? { id: square.piece.id, isStanding: square.piece.isStanding } : null,
        stackHeight: square.pieces.length,
      };
    });

    console.log("Initial a4 state:", initialWallState);
    expect(initialWallState.isStanding).toBe(true); // Should be a wall (standing)

    // Append the smash move directly (simulating PlayTak move coming in)
    // The move 25w is 3a1+111* which smashes the wall at a4
    await page.evaluate(async () => {
      const store = window.app.$store;
      
      console.log("Appending smash move 3a1+111...");
      // Append the move directly using the game's insertPly method
      await store.dispatch("game/APPEND_PLY", {
        ply: "3a1+111",
      });
      console.log("Move appended");
    });

    // Wait for the move to be processed
    await page.waitForFunction(() => {
      const game = window.app.$game;
      const lastPly = game.plies[game.plies.length - 1];
      return lastPly && lastPly.text.includes("3a1+111");
    }, { timeout: 10000 });

    // Navigate to the new position (the move we just appended)
    await page.evaluate(() => {
      const game = window.app.$game;
      game.board.last();
    });

    // Verify the move was recorded with wallSmash (*)
    const moveRecorded = await page.evaluate(() => {
      const game = window.app.$game;
      const lastPly = game.plies[game.plies.length - 1];
      return {
        text: lastPly.text,
        wallSmash: lastPly.wallSmash,
        tpsAfter: lastPly.tpsAfter,
      };
    });

    console.log("Move recorded:", moveRecorded);
    expect(moveRecorded.text).toContain("3a1+111*");
    expect(moveRecorded.wallSmash).toBe("*");

    // Verify the wall at a4 is now flattened (capstone on top)
    const afterMoveState = await page.evaluate(() => {
      const game = window.app.$game;
      const square = game.board.getSquare("a4");
      return {
        isStanding: square.isStanding,
        topPiece: square.piece ? { id: square.piece.id, isStanding: square.piece.isStanding } : null,
        stackHeight: square.pieces.length,
      };
    });

    console.log("After move a4 state:", afterMoveState);
    expect(afterMoveState.isStanding).toBe(false); // Should be flattened (capstone on top)

    // Now navigate back (prev) - this should restore the wall
    await page.evaluate(() => {
      const game = window.app.$game;
      game.board.prev();
    });

    // Wait for navigation
    await page.waitForFunction(() => {
      const game = window.app.$game;
      return game.board.ply && game.board.ply.text.includes("e3<"); // previous move
    }, { timeout: 5000 });

    // Verify the wall at a4 is restored as a wall (standing)
    const afterPrevState = await page.evaluate(() => {
      const game = window.app.$game;
      const square = game.board.getSquare("a4");
      return {
        isStanding: square.isStanding,
        topPiece: square.piece ? { id: square.piece.id, isStanding: square.piece.isStanding } : null,
        stackHeight: square.pieces.length,
      };
    });

    console.log("After prev a4 state:", afterPrevState);
    expect(afterPrevState.isStanding).toBe(true); // Should be restored as wall (standing)
  });
});