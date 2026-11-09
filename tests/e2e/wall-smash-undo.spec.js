// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * A lone capstone leaving a flat must leave it flat.
 *
 * A heuristic in Board._doMoveset restored a wall whenever a lone capstone
 * was popped off a flat, meant for undoing a smash during the trial do/undo
 * in _insertPly. It fired on every such pop, forwards and backwards, so:
 *  - stepping back over `18... d3+` (Cd3 onto white's d4 flat) turned d4
 *    into a wall, and going forward again rewrote the ply as `d3+*`;
 *  - `23. e2>*` (the cap leaving the flat it had smashed at e2) left a wall
 *    behind, so the next move onto e2 threw "Cannot move onto wall at e2"
 *    and the PTN wouldn't load.
 */

const MAIN = `[Size "6"]
[Komi "2"]
[Opening "swap"]

1. a1 f6
2. d4 c3
3. e5 b3
4. e4 Cd3
5. f5 a3
6. Ce3 Se2
7. f2 f3
8. f1 f3-
9. f3 b5
10. f4 b4
11. b6 a2
12. Sc5 a6
13. c5< a5
14. Sa4 c5
15. c6 d6
16. e1 c4
17. 2b5-11 Se6
18. d5 d3+
19. e3-* e6>
20. e3 e6
21. c6> R-0
`;

const BRANCH_4B = `
{4b1}
4. -- a2
`;

const BRANCH_15W = `
{15w1}
15. e1 c4
16. 2b5-11 2b4>
17. d4< c3+
18. Sd4 5c4+23
19. Sd5 3c6>111
20. f1+ d6>
21. d6 Sf1
22. e3-* f1+
23. e2>* Sf1
24. 4f2< f1+
25. d5< d5
26. e3 d3>
27. f1 d1
28. c3 b4
29. d2
`;

async function load(page, ptn) {
  return page.evaluate(async (ptn) => {
    const errors = [];
    const onError = (event) => errors.push(String(event.message || event));
    window.addEventListener("error", onError);
    try {
      await window.app.$store.dispatch("game/ADD_GAME", {
        ptn,
        name: "Wall Smash Undo",
      });
    } catch (e) {
      errors.push(e.message);
    }
    window.removeEventListener("error", onError);
    const game = window.app.$game;
    return {
      errors: errors.concat((game.errors || []).map((e) => e.message || e)),
      plyCount: game.plies.filter(Boolean).length,
    };
  }, ptn);
}

test.describe("Lone capstone leaving a flat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });
  });

  test("stepping back over a cap move onto a flat leaves it flat", async ({
    page,
  }) => {
    await load(page, MAIN);
    const result = await page.evaluate(async () => {
      const store = window.app.$store;
      const game = window.app.$game;
      const capMove = game.plies.find(
        (p) => p && !p.branch && p.text === "d3+"
      );
      await store.dispatch("game/LAST");
      await store.dispatch("game/GO_TO_PLY", {
        plyID: capMove.id,
        isDone: false,
      });
      const d4 = game.board.getSquare("d4").piece;
      const atStep = { standing: d4.isStanding, tps: game.board.tps };
      await store.dispatch("game/LAST");
      return {
        atStep,
        expectedTPS: capMove.tpsBefore,
        ptnHasSmash: game.ptn.includes("d3+*"),
      };
    });
    expect(result.atStep.standing).toBe(false);
    expect(result.atStep.tps).toBe(result.expectedTPS);
    expect(result.ptnHasSmash).toBe(false);
  });

  test("deleting the NOP branch ply doesn't turn d4 into a wall", async ({
    page,
  }) => {
    await load(page, MAIN + BRANCH_4B);
    const result = await page.evaluate(async () => {
      const store = window.app.$store;
      const game = window.app.$game;
      const branchPly = game.plies.find(
        (p) => p && p.branch && p.text === "a2"
      );
      await store.dispatch("game/GO_TO_PLY", {
        plyID: branchPly.id,
        isDone: true,
      });
      await store.dispatch("game/DELETE_PLY", branchPly.id);
      const afterDelete = game.board.getSquare("d4").pieces[0].isStanding;
      await store.dispatch("game/LAST");
      return {
        afterDelete,
        afterLast: game.board.getSquare("d4").pieces[0].isStanding,
        ptnHasSmash: game.ptn.includes("d3+*"),
      };
    });
    expect(result.afterDelete).toBe(false);
    expect(result.afterLast).toBe(false);
    expect(result.ptnHasSmash).toBe(false);
  });

  test("the reported PTN loads with every branch", async ({ page }) => {
    const result = await load(page, MAIN + BRANCH_4B + BRANCH_15W);
    expect(result.errors).toEqual([]);
    const branch = await page.evaluate(async () => {
      const store = window.app.$store;
      const game = window.app.$game;
      const capOff = game.plies.find((p) => p && p.branch && p.text === "e2>*");
      await store.dispatch("game/GO_TO_PLY", {
        plyID: capOff.id,
        isDone: true,
      });
      const e2After = game.board
        .getSquare("e2")
        .pieces.map((p) => (p.isStanding ? "S" : "F"));
      const last = game.plies.filter((p) => p && p.branch).pop();
      await store.dispatch("game/GO_TO_PLY", { plyID: last.id, isDone: true });
      return {
        e2After,
        lastText: game.board.ply && game.board.ply.text,
      };
    });
    expect(branch.e2After).toEqual(["F"]);
    expect(branch.lastText).toBe("d2");
  });
});
