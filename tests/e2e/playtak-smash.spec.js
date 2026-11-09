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
  test("PlayTak smash move records wallSmash and restores wall on prev", async ({
    page,
  }) => {
    await page.goto("http://localhost:8081/");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });

    // Load the game from PTN up to move 25w (before the smash move)
    const evalResult = await page.evaluate(
      async ({ ptn }) => {
        const store = window.app.$store;
        const Game = window.Game;

        console.log("Creating game from PTN...");
        // Create game from PTN up to move 25w (before the smash)
        const game = new Game({
          ptn: ptn,
          config: {
            playtakID: "test-smash",
            playtakLive: false,
            playtakSyncedMainline: 0,
          },
        });

        console.log("Game created, plies:", game.plies.length);
        // Navigate to the end of main branch (before the smash move)
        game.board.goToEndOfMainBranch();
        console.log(
          "Navigated to end of main branch, ply:",
          game.board.ply ? game.board.ply.text : "none"
        );

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
        console.log(
          "Game plies:",
          window.app.$game ? window.app.$game.plies.length : 0
        );

        return { success: true, plies: game.plies.length };
      },
      { ptn: PTN_UP_TO_25W }
    );

    console.log("Eval result:", evalResult);

    // Navigate to the position BEFORE the smash move (before 25w 3a1+111*)
    // The current ply is the smash move, so we need to go back one ply
    await page.evaluate(() => {
      const game = window.app.$game;
      game.board.prev();
    });

    // Verify the game was loaded and has the correct board position (wall at a4)
    await page.waitForFunction(
      () => {
        const game = window.app.$game;
        return (
          game && game.board && game.board.getSquare("a4").isStanding === true
        );
      },
      { timeout: 10000 }
    );

    // Verify initial wall at a4
    const initialWallState = await page.evaluate(() => {
      const game = window.app.$game;
      const square = game.board.getSquare("a4");
      return {
        isStanding: square.isStanding,
        topPiece: square.piece
          ? { id: square.piece.id, isStanding: square.piece.isStanding }
          : null,
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
    await page.waitForFunction(
      () => {
        const game = window.app.$game;
        const lastPly = game.plies[game.plies.length - 1];
        return lastPly && lastPly.text.includes("3a1+111");
      },
      { timeout: 10000 }
    );

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
        topPiece: square.piece
          ? { id: square.piece.id, isStanding: square.piece.isStanding }
          : null,
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
    await page.waitForFunction(
      () => {
        const game = window.app.$game;
        return game.board.ply && game.board.ply.text.includes("e3<"); // previous move
      },
      { timeout: 5000 }
    );

    // Verify the wall at a4 is restored as a wall (standing)
    const afterPrevState = await page.evaluate(() => {
      const game = window.app.$game;
      const square = game.board.getSquare("a4");
      return {
        isStanding: square.isStanding,
        topPiece: square.piece
          ? { id: square.piece.id, isStanding: square.piece.isStanding }
          : null,
        stackHeight: square.pieces.length,
      };
    });

    console.log("After prev a4 state:", afterPrevState);
    expect(afterPrevState.isStanding).toBe(true); // Should be restored as wall (standing)
  });
});
/**
 * Following a live game, the tak pre-check tries the incoming move on the
 * board before inserting it. The trial infers the smash, so undoing it has to
 * put the wall back, or the real move sees a flat and the wall stays flattened
 * after navigating back.
 */
const PTN_BEFORE_SMASH = `[Site "PlayTak.com"]
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
24. 3b3>12 e3<`;

test.describe("Live PlayTak smash with tak annotation", () => {
  for (const autoAnnotateTak of [false, true]) {
    test(`prev restores the wall (autoAnnotateTak ${autoAnnotateTak})`, async ({
      page,
    }) => {
      await page.goto("http://localhost:8081/");
      await page.waitForFunction(() => window.app && window.app.$store, {
        timeout: 30000,
      });

      const result = await page.evaluate(
        async ({ ptn, autoAnnotateTak }) => {
          const store = window.app.$store;
          await store.dispatch("ui/SET_UI", [
            "autoAnnotateTak",
            autoAnnotateTak,
          ]);
          const game = new window.Game({
            ptn,
            config: {
              playtakID: "869820",
              playtakLive: true,
              playtakSyncedMainline: 0,
            },
          });
          game.board.goToEndOfMainBranch();
          await store.dispatch("game/ADD_GAME", game);
          const live = () => window.app.$game;
          await store.dispatch("game/APPEND_PLY", {
            ply: "3a1+111",
            playtakLive: {
              playtakID: "869820",
              syncedMainlineCount: live().plies.length,
            },
          });
          const smash = live().plies[live().plies.length - 1].text;
          live().board.prev();
          return {
            smash,
            prevPly: live().board.ply && live().board.ply.text,
            isStanding: live().board.getSquare("a4").isStanding,
          };
        },
        { ptn: PTN_BEFORE_SMASH, autoAnnotateTak }
      );

      expect(result.smash).toBe("3a1+111*");
      expect(result.prevPly).toBe("e3<");
      expect(result.isStanding).toBe(true);
    });
  }
});

/**
 * With tak annotation on, a move an engine has as a forced road win is marked
 * tinue rather than tak. Here white has a1 to d1 and wins by road with e1,
 * while a forced win on flats must not be marked.
 */
const ROAD_PTN = `[Size "5"]
[TPS "x5/x5/2,2,x3/x5/1,1,1,1,x 2 4"]

4. -- e5`;

test.describe("Auto-marking a forced road win as tinue", () => {
  const cases = [
    {
      name: "a solved win that is a road win",
      move: "a2",
      suggestion: {
        scoreText: "R3",
        evaluation: 100,
        followingPlies: ["c5", "e1"],
      },
    },
    {
      name: "a solved win the engine hasn't labelled",
      move: "a2",
      suggestion: {
        scoreText: "W3",
        evaluation: 100,
        followingPlies: ["c5", "e1"],
      },
    },
    {
      name: "the road win itself, which ends the game",
      move: "e1",
      suggestion: { scoreText: "R1", evaluation: 100 },
      notTinue: true,
    },
    {
      name: "a road win at the end of a longer line",
      move: "a2",
      suggestion: {
        scoreText: "R3",
        evaluation: 100,
        followingPlies: ["c5", "e1"],
      },
    },
    {
      name: "a win that ends the game, whatever the line goes on to play",
      move: "e1",
      suggestion: {
        scoreText: "R3",
        evaluation: 100,
        followingPlies: ["c5", "e1"],
      },
      notTinue: true,
    },
    {
      name: "a saved road win",
      move: "a2",
      saved: "+1/10 score:R3",
      pv: "a2 c5 e1",
    },
    {
      name: "a win share of 100, which isn't a solved win",
      move: "e1",
      suggestion: { evaluation: 100 },
      notTinue: true,
    },
    {
      name: "a win on flats, even with a line that ends in a road",
      move: "a2",
      suggestion: {
        scoreText: "F3",
        evaluation: 100,
        followingPlies: ["c5", "e1"],
      },
      notTinue: true,
    },
    {
      name: "a forced win that ends without a road",
      move: "a2",
      suggestion: { scoreText: "R3", evaluation: 100, followingPlies: ["c5"] },
      notTinue: true,
    },
    {
      name: "a forced win with no line to check",
      move: "a2",
      suggestion: { scoreText: "R3", evaluation: 100 },
      notTinue: true,
    },
    {
      name: "a saved forced win that ends without a road",
      move: "a2",
      saved: "+1/10 score:R3",
      notTinue: true,
    },
    {
      name: "a loss for the mover",
      move: "e1",
      suggestion: { scoreText: "L1", evaluation: -100 },
      notTinue: true,
    },
    {
      name: "a merely good move",
      move: "e1",
      suggestion: { evaluation: 40 },
      notTinue: true,
    },
  ];
  for (const { name, move, suggestion, saved, pv, notTinue = false } of cases) {
    test(`marks ${name}`, async ({ page }) => {
      await page.goto("http://localhost:8081/");
      await page.waitForFunction(() => window.app && window.app.$store, {
        timeout: 30000,
      });

      const mark = await page.evaluate(
        async ({ ptn, move, suggestion, saved, pv }) => {
          const store = window.app.$store;
          await store.dispatch("ui/SET_UI", ["autoAnnotateTak", true]);
          if (saved) {
            ptn += ` {name:"Tiltak" ${saved} pv> ${pv || move}}`;
          }
          await store.dispatch("game/ADD_GAME", { ptn, name: "Forced win" });
          const game = window.app.$game;
          game.board.goToEndOfMainBranch();
          if (suggestion) {
            const Ply = new window.Game({ ptn: '[Size "5"]\n\n1. a1 b1' })
              .plies[0].constructor;
            const { followingPlies = [], ...rest } = suggestion;
            store.commit("analysis/SET_BOT_POSITION", {
              botID: "tiltak",
              tps: game.board.tps,
              suggestions: [
                {
                  ply: new Ply(move),
                  followingPlies: followingPlies.map((text) => new Ply(text)),
                  ...rest,
                },
              ],
            });
          }
          await store.dispatch("game/APPEND_PLY", move);
          const last = game.plies[game.plies.length - 1];
          return last.evaluation ? last.evaluation.text : null;
        },
        { ptn: ROAD_PTN, move, suggestion, saved, pv }
      );

      if (notTinue) {
        // It may still be tak, which depends on the solver answering in time
        expect(mark).not.toBe('"');
      } else {
        expect(mark).toBe('"');
      }
    });
  }
});
