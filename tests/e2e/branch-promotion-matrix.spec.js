// @ts-check
const {
  test,
  expect,
  loadPTN,
  act,
  snapshot,
  expectHealthy,
  expectInvariants,
  expectUndoRedo,
  expectUnchanged,
  branchLine,
  branchKeys,
  branchOf,
  siblings,
  goTo,
  goToBranchEnd,
  setBranchPointOverrides,
  setProtectedMainline,
} = require("./helpers");

/**
 * Branch promotion matrix
 *
 * Covers the cases the coverage audit found missing from
 * branch-promotion.spec.js (P1-P34): depth, colour, first-ply and TPS starts,
 * sibling counts, custom names, annotations, collapsed state, board position,
 * guards, non-contiguous ply ids, undo/redo and repeated promotions.
 *
 * Every edit goes through the store actions the branch context menu
 * dispatches: game/PROMOTE_BRANCH ("Promote") and game/MAKE_BRANCH_MAIN
 * ("Make Main"). After each one, expectInvariants checks that every line keeps
 * its plies and annotations, the game is healthy and round-trips, the board
 * stays put, and UNDO/REDO restore the exact PTN.
 */

const HEADER = `[Size "6"]
[Opening "swap"]
`;

// Main line plus 3w1, 3w2 and 3w3
const SIBS4 = `${HEADER}
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
`;

const SIBS5 = `${SIBS4}
{3w4}
3. f1 b3
4. f2 b4
`;

// Main line plus 3w1 and 3w2
const SIBS3 = `${HEADER}
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
`;

// A chain three deep: 3w1, 3w1/4b1, 3w1/4b1/5w1
const DEEP3 = `${HEADER}
1. a1 f6
2. a2 f5
3. a3 f4
4. a4 f3
5. a5 f2

{3w1}
3. b1 f4
4. b2 f3
5. b3 f2

{3w1/4b1}
4. -- e3
5. b4 e2

{3w1/4b1/5w1}
5. c4 e1
6. c5
`;

// Three alternatives for black's third move
const BLACK_SIBS = `${HEADER}
1. a1 f6
2. a2 f5
3. a3 b3
4. a4 b4

{3b1}
3. -- c1
4. a4 c2

{3b2}
3. -- d1
4. a4 d2

{3b3}
3. -- e1
4. a4 e2
`;

// Nested black-ply branches (the shape from the nested promotion bug)
const NESTED_PTN = `${HEADER}
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

// Nested white-ply siblings inside 3w1
const NESTED_WHITE = `${HEADER}
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

const FIRST_W = `${HEADER}
1. a1 b1
2. a2 b2

{1w1}
1. c1 b1
2. c2 b2
`;

const FIRST_B = `${HEADER}
1. a1 b1
2. a2 b2

{1b1}
1. -- c1
2. a2 c2
`;

const FIRST_MULTI = `${HEADER}
1. a1 b1
2. a2 b2

{1w1}
1. c1 b1
2. c2 b2

{1w2}
1. d1 b1
2. d2 b2
`;

// White to move from a TPS, with branches at the first ply
const TPS_WHITE = `[Size "6"]
[Komi "2.5"]
[Opening "swap"]
[TPS "1,2,1,x3/2,1,1,1221C,2,1/x2,2,x,1,x/x3,2,1,1/x3,2,x,112/2,2,x,2,x,1 1 16"]

16. f5< b6<
17. f3- d3>
18. 3f2+12

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

{16b1}
16. -- d3>
17. c6<
`;

// Black to move from a TPS, with a branch at the first ply
const TPS_BLACK = `${HEADER}[TPS "x5,1/x6/x6/x6/1,x5/2,x5 2 2"]

2. -- f5
3. a3 f4

{2b1}
2. -- e5
3. a3 e4
`;

/** Load a fixture and check it is healthy before the edit */
async function load(page, ptn, options) {
  await loadPTN(page, ptn, options);
  await expectHealthy(page, "fixture");
}

test.describe("Promotion by depth and colour", () => {
  for (const onBranch of [true, false]) {
    test(`P1: Make Main of a depth-3 branch from ${
      onBranch ? "the branch" : "the main line"
    }`, async ({ page }) => {
      await load(page, DEEP3);
      if (onBranch) {
        await goToBranchEnd(page, "3w1/4b1/5w1");
      } else {
        await goToBranchEnd(page, "");
      }
      const before = await snapshot(page);

      expect(
        await act(page, "game/MAKE_BRANCH_MAIN", "3w1/4b1/5w1")
      ).toBeNull();

      // The whole chain is the main line
      expect(await branchLine(page, "")).toEqual([
        "a1",
        "f6",
        "a2",
        "f5",
        "b1",
        "f4",
        "b2",
        "e3",
        "c4",
        "e1",
        "c5",
      ]);
      // The lines that forked off the chain now fork off the main line
      expect(await branchKeys(page)).toEqual(["", "3w1", "4b1", "5w1"]);
      expect(await branchLine(page, "3w1")).toEqual([
        "a3",
        "f4",
        "a4",
        "f3",
        "a5",
        "f2",
      ]);
      expect(await branchLine(page, "4b1")).toEqual(["f3", "b3", "f2"]);
      expect(await branchLine(page, "5w1")).toEqual(["b4", "e2"]);
      await expectInvariants(page, before);
    });
  }

  test("P2: Promote reorders siblings at a nested branch point", async ({
    page,
  }) => {
    await load(page, NESTED_WHITE);
    await goTo(page, { text: "c3" }, true);
    const before = await snapshot(page);

    expect(await act(page, "game/PROMOTE_BRANCH", "3w1/4w3")).toBeNull();

    expect(await siblings(page, { text: "b2" })).toEqual([
      "b2",
      "c1",
      "c3",
      "c2",
    ]);
    expect(await branchLine(page, "3w1/4w2")).toEqual(["c3", "f3"]);
    expect(await branchLine(page, "3w1/4w3")).toEqual(["c2", "f3"]);
    expect(await branchLine(page, "")).toEqual(before.branchLines[""]);
    expect(await branchLine(page, "3w1")).toEqual(before.branchLines["3w1"]);
    expect(await page.evaluate(() => window.app.$game.board.targetBranch)).toBe(
      "3w1/4w2"
    );
    await expectInvariants(page, before);
  });

  test("P3: Promote to first sibling at a nested point leaves main alone", async ({
    page,
  }) => {
    await load(page, NESTED_WHITE);
    await goToBranchEnd(page, "");
    const before = await snapshot(page);

    expect(await act(page, "game/PROMOTE_BRANCH", "3w1/4w1")).toBeNull();

    // Only the order inside 3w1 changes
    expect(await branchLine(page, "")).toEqual(before.branchLines[""]);
    expect(await siblings(page, { text: "a3" })).toEqual(["a3", "b1"]);
    expect(await siblings(page, { text: "b2" })).toEqual([
      "c1",
      "b2",
      "c2",
      "c3",
    ]);
    expect(await branchLine(page, "3w1/4w1")).toEqual(["b2", "f3", "b3", "f2"]);
    await expectInvariants(page, before);
  });

  test("P4: Promote reorders siblings at a black branch point", async ({
    page,
  }) => {
    await load(page, BLACK_SIBS);
    await goToBranchEnd(page, "3b3");
    const before = await snapshot(page);

    expect(await act(page, "game/PROMOTE_BRANCH", "3b3")).toBeNull();
    expect(await siblings(page, { text: "b3" })).toEqual([
      "b3",
      "c1",
      "e1",
      "d1",
    ]);
    const first = await expectInvariants(page, before);

    expect(await act(page, "game/PROMOTE_BRANCH", "3b2")).toBeNull();
    expect(await siblings(page, { text: "b3" })).toEqual([
      "b3",
      "e1",
      "c1",
      "d1",
    ]);
    // Every sibling still starts "3. --", and main still shows white's move
    const ptn = await page.evaluate(() => window.app.$game.ptn);
    expect(ptn).toContain("3. a3 b3");
    expect(ptn.match(/\n3\. -- [cde]1/g)).toHaveLength(3);
    await expectInvariants(page, first);
  });

  test("P5: Make Main at a black branch point among three siblings", async ({
    page,
  }) => {
    await load(page, BLACK_SIBS);
    await goToBranchEnd(page, "3b2");
    const before = await snapshot(page);

    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3b2")).toBeNull();

    expect(await branchLine(page, "")).toEqual([
      "a1",
      "f6",
      "a2",
      "f5",
      "a3",
      "d1",
      "a4",
      "d2",
    ]);
    expect(await siblings(page, { text: "d1" })).toEqual([
      "d1",
      "b3",
      "c1",
      "e1",
    ]);
    expect(await branchLine(page, "3b1")).toEqual(["b3", "a4", "b4"]);
    expect(await branchLine(page, "3b2")).toEqual(["c1", "a4", "c2"]);
    expect(await branchLine(page, "3b3")).toEqual(["e1", "a4", "e2"]);
    const ptn = await page.evaluate(() => window.app.$game.ptn);
    expect(ptn).toContain("3. a3 d1");
    await expectInvariants(page, before);
  });

  // P6: every branch of the nested black-start fixture, on a fresh load
  for (const op of ["game/MAKE_BRANCH_MAIN", "game/PROMOTE_BRANCH"]) {
    for (const branch of [
      "1b1",
      "1b1/2b1",
      "1b1/2b2",
      "1b1/2b3",
      "1b2",
      "1b2/2w1",
    ]) {
      test(`P6: ${op.slice(
        5
      )} ${branch} in nested black-start branches`, async ({ page }) => {
        await load(page, NESTED_PTN);
        // The board's line, from its end
        await goToBranchEnd(page, branch);
        const line = (await snapshot(page)).position.path.split(" | ");
        // Park the board on a ply no other line shares; see "Board position"
        await goTo(page, { text: "a1" }, false);
        const before = await snapshot(page);

        expect(await act(page, op, branch)).toBeNull();
        if (op === "game/MAKE_BRANCH_MAIN") {
          // The branch's line is now the main line
          const main = await page.evaluate(() =>
            window.__probe.pathTokens(
              window.app.$game.plies
                .filter((ply) => !ply.branch)
                .sort((a, b) => b.index - a.index)[0]
            )
          );
          expect(main).toEqual(line);
        }
        await expectInvariants(page, before);
      });
    }
  }
});

test.describe("Promotion at the first ply and from a TPS", () => {
  test("P8: Make Main of a branch at the first white ply", async ({ page }) => {
    await load(page, FIRST_W);
    await goToBranchEnd(page, "1w1");
    const before = await snapshot(page);

    expect(await act(page, "game/MAKE_BRANCH_MAIN", "1w1")).toBeNull();

    expect(await branchLine(page, "")).toEqual(["c1", "b1", "c2", "b2"]);
    expect(await branchKeys(page)).toEqual(["", "1w1"]);
    expect(await branchLine(page, "1w1")).toEqual(["a1", "b1", "a2", "b2"]);
    await expectInvariants(page, before);
  });

  test("P9: Make Main of a branch at the first black ply", async ({ page }) => {
    await load(page, FIRST_B);
    await goToBranchEnd(page, "1b1");
    const before = await snapshot(page);

    expect(await act(page, "game/MAKE_BRANCH_MAIN", "1b1")).toBeNull();

    expect(await branchLine(page, "")).toEqual(["a1", "c1", "a2", "c2"]);
    expect(await branchLine(page, "1b1")).toEqual(["b1", "a2", "b2"]);
    const ptn = await page.evaluate(() => window.app.$game.ptn);
    expect(ptn).toContain("1. a1 c1");
    expect(ptn).not.toMatch(/(^|\n)1\. -- c1/);
    await expectInvariants(page, before);
  });

  test("P10: Promote reorders siblings at the first ply", async ({ page }) => {
    await load(page, FIRST_MULTI);
    await goTo(page, { text: "d2" }, false);
    const before = await snapshot(page);

    expect(await act(page, "game/PROMOTE_BRANCH", "1w2")).toBeNull();

    expect(await siblings(page, { text: "a1" })).toEqual(["a1", "d1", "c1"]);
    expect(await branchLine(page, "1w1")).toEqual(["d1", "b1", "d2", "b2"]);
    expect(await branchLine(page, "1w2")).toEqual(["c1", "b1", "c2", "b2"]);
    await expectInvariants(page, before);
  });

  for (const branch of ["16w1", "16w1/17w1/17b1/18b1", "16b1"]) {
    test(`P11: Make Main of ${branch} from a white-to-move TPS`, async ({
      page,
    }) => {
      await load(page, TPS_WHITE);
      await goToBranchEnd(page, branch);
      const before = await snapshot(page);

      expect(await act(page, "game/MAKE_BRANCH_MAIN", branch)).toBeNull();

      const start = await page.evaluate(() => {
        const game = window.app.$game;
        return {
          number: game.firstMoveNumber,
          player: game.firstPlayer,
          firstMove: game.moves[0].number,
        };
      });
      expect(start).toEqual({ number: 16, player: 1, firstMove: 16 });
      expect((await snapshot(page)).tps).toBe(before.tps);
      await expectInvariants(page, before);
    });
  }

  test("P12: Make Main of a first-ply branch from a black-to-move TPS", async ({
    page,
  }) => {
    await load(page, TPS_BLACK);
    await goToBranchEnd(page, "2b1");
    const before = await snapshot(page);

    expect(await act(page, "game/MAKE_BRANCH_MAIN", "2b1")).toBeNull();

    expect(await branchLine(page, "")).toEqual(["e5", "a3", "e4"]);
    expect(await branchLine(page, "2b1")).toEqual(["f5", "a3", "f4"]);
    // Both lines still start with black's move
    const ptn = await page.evaluate(() => window.app.$game.ptn);
    expect(ptn).toMatch(/\n2\. -- e5\r\n3\. a3 e4/);
    expect(ptn).toMatch(/\{2b1\}\n2\. -- f5/);
    await expectInvariants(page, before);
  });
});

test.describe("Promotion among many siblings", () => {
  test("P13: Make Main of the middle sibling of four", async ({ page }) => {
    await load(page, SIBS4);
    await goToBranchEnd(page, "3w2");
    const before = await snapshot(page);

    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w2")).toBeNull();

    expect(await siblings(page, { text: "a3" })).toEqual([
      "d1",
      "a3",
      "c1",
      "e1",
    ]);
    expect(await branchLine(page, "")).toEqual([
      "a1",
      "b1",
      "a2",
      "b2",
      "d1",
      "b3",
      "d2",
      "b4",
    ]);
    expect(await branchLine(page, "3w1")).toEqual(["a3", "b3", "a4", "b4"]);
    expect(await branchLine(page, "3w2")).toEqual(["c1", "b3", "c2", "b4"]);
    expect(await branchLine(page, "3w3")).toEqual(["e1", "b3", "e2", "b4"]);
    await expectInvariants(page, before);
  });

  test("P14: Make Main of the last of five siblings", async ({ page }) => {
    await load(page, SIBS5);
    await goToBranchEnd(page, "3w4");
    const before = await snapshot(page);

    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w4")).toBeNull();

    expect(await siblings(page, { text: "a3" })).toEqual([
      "f1",
      "a3",
      "c1",
      "d1",
      "e1",
    ]);
    expect(await branchLine(page, "3w1")).toEqual(["a3", "b3", "a4", "b4"]);
    expect(await branchLine(page, "3w2")).toEqual(["c1", "b3", "c2", "b4"]);
    expect(await branchLine(page, "3w3")).toEqual(["d1", "b3", "d2", "b4"]);
    expect(await branchLine(page, "3w4")).toEqual(["e1", "b3", "e2", "b4"]);
    await expectInvariants(page, before);
  });

  test("P15: Promoting step by step ends where Make Main does", async ({
    page,
  }) => {
    await load(page, SIBS5);
    await goToBranchEnd(page, "3w4");
    let before = await snapshot(page);
    for (const order of [
      ["a3", "c1", "d1", "f1", "e1"],
      ["a3", "c1", "f1", "d1", "e1"],
      ["a3", "f1", "c1", "d1", "e1"],
      ["f1", "a3", "c1", "d1", "e1"],
    ]) {
      const branch = await branchOf(page, { text: "f1" });
      expect(await act(page, "game/PROMOTE_BRANCH", branch)).toBeNull();
      expect(await siblings(page, { text: "f1" })).toEqual(order);
      before = await expectInvariants(page, before);
    }

    await load(page, SIBS5);
    await goToBranchEnd(page, "3w4");
    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w4")).toBeNull();
    expect((await snapshot(page)).ptn).toBe(before.ptn);
  });
});

test.describe("Promotion and branch names", () => {
  test("P16: Promoting a custom-named sibling keeps every name unique", async ({
    page,
  }) => {
    // BUG: promoteBranch renames the default sibling it swaps with to
    // `3w${index}` without checking that the name is free. Here that is
    // 3w2, which is already taken, so two lines share a name.
    await load(page, SIBS3);
    expect(
      await act(page, "game/RENAME_BRANCH", {
        oldName: "3w2",
        newName: "custom",
      })
    ).toBeNull();
    // Another alternative at the same point gets the free name 3w2
    await goTo(page, { branch: "", text: "b2" }, true);
    expect(await act(page, "game/INSERT_PLY", "e1")).toBeNull();
    expect(await branchOf(page, { text: "e1" })).toBe("3w2");
    expect(await siblings(page, { text: "a3" })).toEqual([
      "a3",
      "c1",
      "d1",
      "e1",
    ]);
    await expectHealthy(page, "set-up game");
    await goToBranchEnd(page, "custom");
    const before = await snapshot(page);

    expect(await act(page, "game/PROMOTE_BRANCH", "custom")).toBeNull();

    expect(await siblings(page, { text: "a3" })).toEqual([
      "a3",
      "d1",
      "c1",
      "e1",
    ]);
    expect(await branchOf(page, { text: "d1" })).toBe("custom");
    expect(await branchOf(page, { text: "e1" })).toBe("3w2");
    await expectInvariants(page, before);
  });

  test("P17: Promote a default name past a custom name", async ({ page }) => {
    await load(
      page,
      `${HEADER}
1. a1 b1
2. a2 b2
3. a3 b3

{custom}
3. c1 b3

{3w2}
3. d1 b3
`
    );
    const before = await snapshot(page);

    expect(await act(page, "game/PROMOTE_BRANCH", "3w2")).toBeNull();

    expect(await branchKeys(page)).toEqual(["", "3w1", "custom"]);
    expect(await branchLine(page, "3w1")).toEqual(["d1", "b3"]);
    expect(await branchLine(page, "custom")).toEqual(["c1", "b3"]);
    expect(await siblings(page, { text: "a3" })).toEqual(["a3", "d1", "c1"]);
    await expectInvariants(page, before);
  });

  test("P18: Promote among two custom names keeps both", async ({ page }) => {
    await load(
      page,
      `${HEADER}
1. a1 b1
2. a2 b2
3. a3 b3

{foo}
3. c1 b3

{bar}
3. d1 b3
`
    );
    const before = await snapshot(page);

    expect(await act(page, "game/PROMOTE_BRANCH", "bar")).toBeNull();

    expect(await branchKeys(page)).toEqual(["", "bar", "foo"]);
    expect(await branchLine(page, "bar")).toEqual(["d1", "b3"]);
    expect(await branchLine(page, "foo")).toEqual(["c1", "b3"]);
    expect(await siblings(page, { text: "a3" })).toEqual(["a3", "d1", "c1"]);
    await expectInvariants(page, before);
  });

  test("P19: Make Main past a custom-named intermediate sibling", async ({
    page,
  }) => {
    await load(
      page,
      `${HEADER}
1. a1 b1
2. a2 b2
3. a3 b3

{foo}
3. c1 b3

{3w2}
3. d1 b3

{3w3}
3. e1 b3
`
    );
    const before = await snapshot(page);

    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w3")).toBeNull();

    expect(await siblings(page, { text: "a3" })).toEqual([
      "e1",
      "a3",
      "c1",
      "d1",
    ]);
    expect(await branchKeys(page)).toEqual(["", "3w1", "3w3", "foo"]);
    expect(await branchLine(page, "3w1")).toEqual(["a3", "b3"]);
    expect(await branchLine(page, "foo")).toEqual(["c1", "b3"]);
    expect(await branchLine(page, "3w3")).toEqual(["d1", "b3"]);
    await expectInvariants(page, before);
  });

  test("P20: Make Main when the old main's new name is already taken", async ({
    page,
  }) => {
    // BUG: _makeBranchMain always names the old main `3w1`. When a later
    // sibling (not one of the renamed intermediates) already has that
    // name, two lines share it.
    await load(page, SIBS3);
    // Delete 3w1, then add another alternative: it reuses the name 3w1 but
    // sorts after 3w2
    expect(await act(page, "game/DELETE_BRANCH", "3w1")).toBeNull();
    await goTo(page, { branch: "", text: "b2" }, true);
    expect(await act(page, "game/INSERT_PLY", "e1")).toBeNull();
    expect(await siblings(page, { text: "a3" })).toEqual(["a3", "d1", "e1"]);
    expect(await branchOf(page, { text: "d1" })).toBe("3w2");
    expect(await branchOf(page, { text: "e1" })).toBe("3w1");
    await expectHealthy(page, "set-up game");
    await goToBranchEnd(page, "3w2");
    const before = await snapshot(page);

    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w2")).toBeNull();

    expect(await siblings(page, { text: "d1" })).toEqual(["d1", "a3", "e1"]);
    await expectInvariants(page, before);
  });

  test("P20: Make Main when siblings are not listed in name order", async ({
    page,
  }) => {
    // BUG: _makeBranchMain renames each intermediate sibling to
    // `3w${index + 1}` without checking whether a later sibling already has
    // that name. Here 3w3 becomes 3w2 while e1 is still 3w2. Real games
    // have this order (T10 in branch-promotion.spec.js lists 9w3, 9w1, 9w2).
    await load(
      page,
      `${HEADER}
1. a1 b1
2. a2 b2
3. a3 b3

{3w3}
3. c1 b3

{3w1}
3. d1 b3

{3w2}
3. e1 b3
`
    );
    expect(await siblings(page, { text: "a3" })).toEqual([
      "a3",
      "c1",
      "d1",
      "e1",
    ]);
    const before = await snapshot(page);

    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w1")).toBeNull();

    expect(await siblings(page, { text: "d1" })).toEqual([
      "d1",
      "a3",
      "c1",
      "e1",
    ]);
    await expectInvariants(page, before);
  });

  test("P21: Make Main of a custom-named branch names the old main 3w1", async ({
    page,
  }) => {
    await load(
      page,
      `${HEADER}
1. a1 b1
2. a2 b2
3. a3 b3

{analysis}
3. c1 b3
4. c2 b4
`
    );
    const before = await snapshot(page);

    expect(await act(page, "game/MAKE_BRANCH_MAIN", "analysis")).toBeNull();

    // The custom name belonged to the promoted line, which is now main
    expect(await branchKeys(page)).toEqual(["", "3w1"]);
    expect(await branchLine(page, "")).toEqual([
      "a1",
      "b1",
      "a2",
      "b2",
      "c1",
      "b3",
      "c2",
      "b4",
    ]);
    expect(await branchLine(page, "3w1")).toEqual(["a3", "b3"]);
    await expectInvariants(page, before);
  });

  test("P22: Nested children follow their parent's new name", async ({
    page,
  }) => {
    await load(
      page,
      `${SIBS3}5. d3

{3w2/5w1}
5. e3 b5
`
    );
    await goToBranchEnd(page, "3w2/5w1");
    const before = await snapshot(page);

    expect(await act(page, "game/PROMOTE_BRANCH", "3w2")).toBeNull();

    expect(await branchKeys(page)).toEqual(["", "3w1", "3w1/5w1", "3w2"]);
    expect(await branchLine(page, "3w1")).toEqual([
      "d1",
      "b3",
      "d2",
      "b4",
      "d3",
    ]);
    expect(await branchLine(page, "3w1/5w1")).toEqual(["e3", "b5"]);
    expect(await branchLine(page, "3w2")).toEqual(["c1", "b3", "c2", "b4"]);
    expect(await page.evaluate(() => window.app.$game.board.targetBranch)).toBe(
      "3w1/5w1"
    );
    await expectInvariants(page, before);
  });
});

test.describe("Promotion keeps annotations", () => {
  const NOTES = `${HEADER}
1. a1 b1
2. a2 b2
3. a3 {main 1} b3 {main 2}
4. a4 b4

{3w1}
3. c1 {c 1} b3 {c 2}
4. c2 b4

{3w2}
3. d1 {d 1} b3 {d 2}
4. d2 b4

{3w3}
3. e1 {e 1} b3 {e 2}
4. e2 b4
`;

  for (const [op, branch] of [
    ["game/PROMOTE_BRANCH", "3w3"],
    ["game/PROMOTE_BRANCH", "3w1"],
    ["game/MAKE_BRANCH_MAIN", "3w2"],
  ]) {
    test(`P23: Notes follow their plies on ${op.slice(5)} ${branch}`, async ({
      page,
    }) => {
      await load(page, NOTES);
      const before = await snapshot(page);

      expect(await act(page, op, branch)).toBeNull();

      const notes = await page.evaluate(() => {
        const game = window.app.$game;
        const out = {};
        game.plies.forEach((ply) => {
          (game.notes[ply.id] || []).forEach((note) => {
            out[note.message] = window.__probe.tok(ply) + " " + ply.branch;
          });
        });
        return out;
      });
      const texts = { main: "a3", c: "c1", d: "d1", e: "e1" };
      for (const [prefix, first] of Object.entries(texts)) {
        const name = await branchOf(page, { text: first });
        expect(notes[`${prefix} 1`]).toBe(`3w:${first} ${name}`);
        expect(notes[`${prefix} 2`]).toBe(`3b:b3 ${name}`);
      }
      await expectInvariants(page, before);
    });
  }

  for (const [op, branch] of [
    ["game/PROMOTE_BRANCH", "3w2"],
    ["game/MAKE_BRANCH_MAIN", "3w1"],
    ["game/MAKE_BRANCH_MAIN", "3w2"],
  ]) {
    test(`P24: Eval marks, tak marks and results stay put on ${op.slice(
      5
    )} ${branch}`, async ({ page }) => {
      await load(
        page,
        `${HEADER}[Result "1-0"]

1. a1 b1
2. a2 b2
3. a3? b3
4. a4 b4

{3w1}
3. c1' b3!
4. c2!? b4 1-0

{3w2}
3. d1?? b3
4. d2 b4 0-1
`
      );
      const before = await snapshot(page);

      expect(await act(page, op, branch)).toBeNull();

      // expectInvariants compares annotated lines and the header, so the
      // marks stay on their plies and the Result tag is unchanged
      const after = await expectInvariants(page, before);
      expect(after.header).toContain('[Result "1-0"]');
    });
  }

  test("P25: A comment on the branch point is kept", async ({ page }) => {
    await load(
      page,
      `${HEADER}
1. a1 b1
2. a2 {on a2} b2
3. a3 {on the branch point} b3

{3w1}
3. c1 b3

{3w2}
3. d1 {on d1} b3
`
    );
    const before = await snapshot(page);

    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w2")).toBeNull();
    const made = await expectInvariants(page, before);

    expect(await act(page, "game/PROMOTE_BRANCH", "3w2")).toBeNull();
    await expectInvariants(page, made);
  });

  for (const [op, branch] of [
    ["game/MAKE_BRANCH_MAIN", "3w2"],
    ["game/PROMOTE_BRANCH", "3w2"],
  ]) {
    test(`P25: A comment before the first move survives ${op.slice(
      5
    )} ${branch}`, async ({ page }) => {
      await load(
        page,
        `${HEADER}
{before the game}

1. a1 b1
2. a2 b2
3. a3 b3

{3w1}
3. c1 b3

{3w2}
3. d1 b3
`
      );
      const before = await snapshot(page);
      expect(before.preNotes).toEqual(["before the game"]);
      expect(await act(page, op, branch)).toBeNull();
      await expectInvariants(page, before);
    });
  }
});

test.describe("Promotion keeps chat messages on their plies", () => {
  // Chat messages are stored by ply id like notes, so moving plies must move
  // them too. Each ply here is unique, so text identifies it.
  const CHAT = `${HEADER}
{@1:before the game}

1. a1 b1
2. a2 {@2:on a2} b2
3. a3 {@1:on a3} b3 {@2:on b3}

{3w1}
3. c1 {@1:on c1} b3

{3w2}
3. d1 {@2:on d1} b3 {@1:on d1 b3}
`;

  const chatByPly = (page) =>
    page.evaluate(() => {
      const game = window.app.$game;
      const out = [];
      Object.keys(game.chatlog).forEach((id) => {
        const ply = game.plies[id];
        const where =
          Number(id) === -1
            ? "start"
            : `${ply.branch}:${ply.text}:${ply.index}`;
        game.chatlog[id].forEach((c) => out.push(`${where} ${c.message}`));
      });
      return out.sort();
    });

  for (const [op, branch] of [
    ["game/MAKE_BRANCH_MAIN", "3w2"],
    ["game/PROMOTE_BRANCH", "3w2"],
    ["game/PROMOTE_BRANCH", "3w1"],
  ]) {
    test(`chat stays put after ${op.slice(5)} ${branch}`, async ({ page }) => {
      await load(page, CHAT);
      const before = await snapshot(page);
      const messages = (list) =>
        list.map((s) => s.split(" ").slice(1).join(" "));
      const chatBefore = await chatByPly(page);
      // Ply text plus message identifies each one; branch names and ids may
      // change with the promotion, so compare on what the ply is.
      const byMove = (list) =>
        list
          .map((s) => {
            const [where, ...rest] = s.split(" ");
            const text = where === "start" ? "start" : where.split(":")[1];
            return `${text} ${rest.join(" ")}`;
          })
          .sort();

      expect(await act(page, op, branch)).toBeNull();
      await expectInvariants(page, before);
      const chatAfter = await chatByPly(page);
      expect(messages(chatAfter).sort()).toEqual(messages(chatBefore).sort());
      expect(byMove(chatAfter)).toEqual(byMove(chatBefore));

      // And through a PTN round trip
      const reparsed = await page.evaluate(() => {
        const game = new window.Game({ ptn: window.app.$game.ptn });
        const out = [];
        Object.keys(game.chatlog).forEach((id) => {
          const text = Number(id) === -1 ? "start" : game.plies[id].text;
          game.chatlog[id].forEach((c) => out.push(`${text} ${c.message}`));
        });
        return out.sort();
      });
      expect(reparsed).toEqual(byMove(chatBefore));
    });
  }
});

test.describe("Promotion keeps collapsed state", () => {
  const POINTS = `${HEADER}
1. a1 f6
2. a2 f5
3. a3 f4
4. a4 f3
5. a5 f2

{5w1}
5. b5 f2

{3w1}
3. b1 f4
4. b2 f3
5. b3 f2

{3w1/5w1}
5. c3 f2

{3w2}
3. c1 f4
4. c2 f3
5. c4 f2

{3w2/5w1}
5. d4 f2
`;

  /** Expand the main line's points, collapse the nested ones */
  async function setUp(page) {
    await load(page, POINTS, { expandAll: false });
    await setBranchPointOverrides(page, [
      { where: { text: "a3" }, value: true },
      { where: { text: "a5" }, value: false },
      { where: { text: "b3" }, value: true },
      { where: { text: "c4" }, value: false },
    ]);
    const before = await snapshot(page);
    expect(Object.values(before.overrides)).toEqual([true, false, true, false]);
    return before;
  }

  for (const [op, branch] of [
    ["game/MAKE_BRANCH_MAIN", "3w1"],
    ["game/PROMOTE_BRANCH", "3w2"],
  ]) {
    test(`P26: Each branch point keeps its state after ${op.slice(
      5
    )} ${branch}`, async ({ page }) => {
      const before = await setUp(page);
      expect(await act(page, op, branch)).toBeNull();
      expect((await snapshot(page)).overrides).toEqual(before.overrides);
    });
  }

  test("P26: The top-level branch point keeps its state", async ({ page }) => {
    const before = await setUp(page);
    const key = Object.keys(before.overrides).find((key) =>
      key.endsWith("2b:f5 > 3w")
    );
    expect(await act(page, "game/PROMOTE_BRANCH", "3w2")).toBeNull();
    expect((await snapshot(page)).overrides[key]).toBe(true);
    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w2")).toBeNull();
    expect((await snapshot(page)).overrides[key]).toBe(true);
  });

  for (const [op, branch] of [
    ["game/MAKE_BRANCH_MAIN", "3w1"],
    ["game/PROMOTE_BRANCH", "3w2"],
  ]) {
    test(`P27: UNDO restores every branch point's state after ${op.slice(
      5
    )} ${branch}`, async ({ page }) => {
      const before = await setUp(page);
      expect(await act(page, op, branch)).toBeNull();
      const after = await snapshot(page);
      await expectUndoRedo(page, before, after, { overrides: true });
    });
  }
});

test.describe("Promotion keeps the board position", () => {
  const POSITIONS = `${SIBS4}
{3w2/4w1}
4. f2 b4
`;

  const positions = {
    "I3 an unrelated sibling": async (page) => goToBranchEnd(page, "3w3"),
    "I4 a sub-branch of the promoted line": async (page) =>
      goToBranchEnd(page, "3w2/4w1"),
    "I5 undone on the promoted line's first ply": async (page) =>
      goTo(page, { text: "d1" }, false),
    "I6 done on the branch point": async (page) =>
      goTo(page, { text: "a3" }, true),
    "I6 undone on the branch point": async (page) =>
      goTo(page, { text: "a3" }, false),
    "I7 at the start": async (page) => goTo(page, { text: "a1" }, false),
  };

  for (const op of ["game/MAKE_BRANCH_MAIN", "game/PROMOTE_BRANCH"]) {
    for (const [label, go] of Object.entries(positions)) {
      test(`P28: ${op.slice(5)} 3w2 with the board on ${label}`, async ({
        page,
      }) => {
        await load(page, POSITIONS);
        await go(page);
        const before = await snapshot(page);

        expect(await act(page, op, "3w2")).toBeNull();

        // expectInvariants checks the board is on the same ply of the same
        // line, in the same state, and that targetBranch exists
        await expectInvariants(page, before);
      });
    }
  }
});

test.describe("Promotion guards", () => {
  const PROTECTED = `${HEADER}
1. a1 f6
2. a2 f5
3. a3 f4
4. a4 f3

{4w1}
4. b4 f3

{3w1}
3. b1 f4
4. b2 f3

{3w1/4w1}
4. c2 f3

{3w2}
3. c1 f4
`;

  /** Protect the first six main-line plies, as a followed PlayTak game */
  async function setUp(page) {
    await load(page, PROTECTED);
    await setProtectedMainline(page, 6);
    expect(
      await page.evaluate(() => window.app.$game.getProtectedMainlinePlyIDs())
    ).toHaveLength(6);
    return snapshot(page);
  }

  test("P29: Make Main of a branch inside the synced main line is refused", async ({
    page,
  }) => {
    const before = await setUp(page);
    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w1")).toBeNull();
    await expectUnchanged(page, before);
    expect(await act(page, "game/PROMOTE_BRANCH", "3w1")).toBeNull();
    await expectUnchanged(page, before);
  });

  test("P29: Make Main of a nested branch inside the synced main line is refused", async ({
    page,
  }) => {
    const before = await setUp(page);
    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w1/4w1")).toBeNull();
    await expectUnchanged(page, before);
  });

  test("P29: Promote among side branches is allowed", async ({ page }) => {
    const before = await setUp(page);
    await goToBranchEnd(page, "3w2");
    const atBranch = await snapshot(page);
    expect(atBranch.ptn).toBe(before.ptn);

    expect(await act(page, "game/PROMOTE_BRANCH", "3w2")).toBeNull();

    expect(await siblings(page, { text: "a3" })).toEqual(["a3", "c1", "b1"]);
    expect(await branchLine(page, "")).toEqual(before.branchLines[""]);
    await expectInvariants(page, atBranch);
  });

  test("P29: Make Main of a branch after the synced main line is allowed", async ({
    page,
  }) => {
    const before = await setUp(page);
    expect(await act(page, "game/MAKE_BRANCH_MAIN", "4w1")).toBeNull();
    expect(await branchLine(page, "")).toEqual([
      "a1",
      "f6",
      "a2",
      "f5",
      "a3",
      "f4",
      "b4",
      "f3",
    ]);
    await expectInvariants(page, before);
  });

  for (const [op, branch] of [
    ["game/PROMOTE_BRANCH", ""],
    ["game/PROMOTE_BRANCH", "nope"],
    ["game/MAKE_BRANCH_MAIN", "nope"],
  ]) {
    test(`P30: ${op.slice(5)} "${branch}" leaves the game unchanged`, async ({
      page,
    }) => {
      await load(page, SIBS3);
      const before = await snapshot(page);
      await act(page, op, branch);
      await expectUnchanged(page, before);
    });

    test(`P30: ${op.slice(5)} "${branch}" does not throw`, async ({ page }) => {
      await load(page, SIBS3);
      expect(await act(page, op, branch)).toBeNull();
    });
  }
});

test.describe("Promotion with non-contiguous ply ids", () => {
  /** Add two plies to the end of `branch`; they get the highest ids */
  async function extend(page, branch, plies) {
    await goToBranchEnd(page, branch);
    for (const ply of plies) {
      expect(await act(page, "game/INSERT_PLY", ply)).toBeNull();
    }
    const ids = await page.evaluate(
      (branch) =>
        window.app.$game.plies
          .filter((ply) => ply.branch === branch)
          .map((ply) => ply.id),
      branch
    );
    // The branch's plies are no longer consecutive
    expect(ids[ids.length - 1] - ids[0] + 1).toBeGreaterThan(ids.length);
    await expectHealthy(page, "extended game");
  }

  test("P31: Promote a branch whose plies are not consecutive", async ({
    page,
  }) => {
    await load(page, SIBS4);
    await extend(page, "3w2", ["d3", "b5"]);
    const before = await snapshot(page);

    expect(await act(page, "game/PROMOTE_BRANCH", "3w2")).toBeNull();

    expect(await branchLine(page, "3w1")).toEqual([
      "d1",
      "b3",
      "d2",
      "b4",
      "d3",
      "b5",
    ]);
    await expectInvariants(page, before);
  });

  test("P31: Promote past a sibling whose plies are not consecutive", async ({
    page,
  }) => {
    await load(page, SIBS3);
    await extend(page, "3w1", ["c3", "b5"]);
    const before = await snapshot(page);

    expect(await act(page, "game/PROMOTE_BRANCH", "3w2")).toBeNull();

    expect(await branchLine(page, "3w2")).toEqual([
      "c1",
      "b3",
      "c2",
      "b4",
      "c3",
      "b5",
    ]);
    await expectInvariants(page, before);
  });

  test("P31: Make Main of a branch whose plies are not consecutive", async ({
    page,
  }) => {
    await load(page, SIBS3);
    await extend(page, "3w1", ["c3", "b5"]);
    const before = await snapshot(page);

    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w1")).toBeNull();

    expect(await branchLine(page, "")).toEqual([
      "a1",
      "b1",
      "a2",
      "b2",
      "c1",
      "b3",
      "c2",
      "b4",
      "c3",
      "b5",
    ]);
    await expectInvariants(page, before);
  });
});

test.describe("Repeated promotion", () => {
  test("P34: Promoting 3w2 twice restores the original PTN", async ({
    page,
  }) => {
    await load(page, SIBS3);
    const original = await snapshot(page);
    expect(await act(page, "game/PROMOTE_BRANCH", "3w2")).toBeNull();
    const once = await expectInvariants(page, original);
    expect(await act(page, "game/PROMOTE_BRANCH", "3w2")).toBeNull();
    const twice = await expectInvariants(page, once);
    expect(twice.ptn).toBe(original.ptn);
  });

  test("P34: Make Main of 3w1 twice restores the original PTN", async ({
    page,
  }) => {
    await load(page, SIBS3);
    const original = await snapshot(page);
    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w1")).toBeNull();
    const once = await expectInvariants(page, original);
    expect(await act(page, "game/MAKE_BRANCH_MAIN", "3w1")).toBeNull();
    const twice = await expectInvariants(page, once);
    expect(twice.ptn).toBe(original.ptn);
  });

  /**
   * Run a sequence of [action, first ply text of the branch, expected
   * sibling order] steps, checking the invariants after each
   */
  async function runSteps(page, steps, where) {
    let before = await snapshot(page);
    for (const [op, text, order] of steps) {
      const branch = await branchOf(page, { ...where, text });
      expect(await act(page, op, branch), `${op} ${branch}`).toBeNull();
      if (order) {
        expect(await siblings(page, { ...where, text })).toEqual(order);
      }
      before = await expectInvariants(page, before);
    }
    return before;
  }

  test("Top level: make B main, A back, then C, then promote D", async ({
    page,
  }) => {
    await load(page, SIBS4);
    await goTo(page, { text: "e2" }, true);
    const after = await runSteps(
      page,
      [
        ["game/MAKE_BRANCH_MAIN", "d1", ["d1", "a3", "c1", "e1"]],
        ["game/MAKE_BRANCH_MAIN", "a3", ["a3", "d1", "c1", "e1"]],
        ["game/MAKE_BRANCH_MAIN", "e1", ["e1", "a3", "d1", "c1"]],
        ["game/PROMOTE_BRANCH", "c1", ["e1", "a3", "c1", "d1"]],
        ["game/PROMOTE_BRANCH", "c1", ["e1", "c1", "a3", "d1"]],
        ["game/PROMOTE_BRANCH", "c1", ["c1", "e1", "a3", "d1"]],
        ["game/MAKE_BRANCH_MAIN", "a3", ["a3", "c1", "e1", "d1"]],
      ],
      { number: 3, player: 1 }
    );
    expect(after.branchKeys).toEqual(["", "3w1", "3w2", "3w3"]);
  });

  test("Top level: promote B, A back, then C", async ({ page }) => {
    await load(page, SIBS4);
    await runSteps(
      page,
      [
        ["game/PROMOTE_BRANCH", "d1", ["a3", "d1", "c1", "e1"]],
        ["game/PROMOTE_BRANCH", "d1", ["d1", "a3", "c1", "e1"]],
        ["game/PROMOTE_BRANCH", "a3", ["a3", "d1", "c1", "e1"]],
        ["game/PROMOTE_BRANCH", "e1", ["a3", "d1", "e1", "c1"]],
        ["game/PROMOTE_BRANCH", "e1", ["a3", "e1", "d1", "c1"]],
        ["game/PROMOTE_BRANCH", "e1", ["e1", "a3", "d1", "c1"]],
      ],
      { number: 3, player: 1 }
    );
  });

  test("Nested: promote B, A back, then C, then make them main", async ({
    page,
  }) => {
    await load(page, NESTED_WHITE);
    await goTo(page, { text: "c3" }, true);
    await runSteps(page, [
      ["game/PROMOTE_BRANCH", "c2", ["b2", "c2", "c1", "c3"]],
      ["game/PROMOTE_BRANCH", "c2", ["c2", "b2", "c1", "c3"]],
      ["game/PROMOTE_BRANCH", "b2", ["b2", "c2", "c1", "c3"]],
      ["game/PROMOTE_BRANCH", "c3", ["b2", "c2", "c3", "c1"]],
      ["game/PROMOTE_BRANCH", "c3", ["b2", "c3", "c2", "c1"]],
      ["game/PROMOTE_BRANCH", "c3", ["c3", "b2", "c2", "c1"]],
      ["game/MAKE_BRANCH_MAIN", "c1", null],
      ["game/MAKE_BRANCH_MAIN", "a3", null],
      ["game/MAKE_BRANCH_MAIN", "c2", null],
    ]);
  });

  test("Nested black start: make one main, the old main back, then another", async ({
    page,
  }) => {
    await load(page, NESTED_PTN);
    await goTo(page, { text: "d5" }, true);
    let before = await snapshot(page);
    for (const where of [
      { text: "Cd3", number: 2 },
      { text: "f6" },
      { text: "b3" },
      { text: "a3" },
      { text: "f6" },
    ]) {
      const branch = await branchOf(page, where);
      expect(
        await act(page, "game/MAKE_BRANCH_MAIN", branch),
        branch
      ).toBeNull();
      expect(await branchOf(page, where)).toBe("");
      before = await expectInvariants(page, before);
    }
  });
});

/**
 * Promotion restores the board with findPlyFromPath, which matches the
 * board's ply by move number, colour and text, then checks the branch points
 * on the way to it. A candidate whose ancestry doesn't contain those branch
 * points is accepted anyway, and a branch point at the first ply is never
 * checked, so the board lands on the first ply with the same text: usually
 * the main line.
 */
test.describe("Board position when its ply text repeats on other lines", () => {
  for (const [label, ptn, go, op, branch] of [
    [
      "a reorder at the first ply",
      FIRST_MULTI,
      (page) => goToBranchEnd(page, "1w2"),
      "game/PROMOTE_BRANCH",
      "1w2",
    ],
    [
      "a reorder of a nested black branch",
      NESTED_PTN,
      (page) => goToBranchEnd(page, "1b1/2b3"),
      "game/PROMOTE_BRANCH",
      "1b1/2b3",
    ],
    [
      "a reorder of a nested white branch",
      NESTED_WHITE,
      (page) => goToBranchEnd(page, "3w1/4w3"),
      "game/PROMOTE_BRANCH",
      "3w1/4w3",
    ],
  ]) {
    test(`The board stays on its line after ${label}`, async ({ page }) => {
      await load(page, ptn);
      await go(page);
      const before = await snapshot(page);
      expect(await act(page, op, branch)).toBeNull();
      await expectInvariants(page, before);
    });
  }
});
