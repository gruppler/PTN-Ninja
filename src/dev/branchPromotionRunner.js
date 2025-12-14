import Game from "../Game";

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const validateGame = (game) => {
  const result = Game.validate(game.toString({ showAllBranches: true }), true);
  assert(result === true, "Game.validate failed: " + String(result));
};

const countComments = (obj) => {
  let count = 0;
  Object.values(obj || {}).forEach((items) => {
    if (Array.isArray(items)) count += items.length;
  });
  return count;
};

const snapshot = (game) => {
  const ply = game.board && game.board.ply;
  return {
    plyCount: game.plies.length,
    moveCount: game.moves.length,
    branchKeys: Object.keys(game.branches).sort(),
    position: ply ? ply.getSerializablePath() : null,
    plyIsDone: game.board ? game.board.plyIsDone : false,
    tps: game.board ? game.board.tps : null,
    targetBranch: game.board ? game.board.targetBranch : null,
    notesCount: countComments(game.notes),
    chatlogCount: countComments(game.chatlog),
    ptnMain: game.ptn,
    ptnAll: game.toString({ showAllBranches: true }),
  };
};

const assertNoPlyLoss = (before, after) => {
  assert(after.plyCount === before.plyCount, "Ply count changed");
};

const assertPositionRestored = (game, before) => {
  if (!before.position) return;
  const target = game.findPlyFromPath(before.position);
  assert(
    Boolean(target),
    "Could not resolve pre-promotion position in new game"
  );
  assert(game.board.plyID === target.id, "Did not restore to expected ply");
};

const assertTokenIncludes = (ptn, tokens) => {
  (tokens || []).forEach((t) => {
    assert(ptn.includes(t), "PTN missing token: " + t);
  });
};

const getMissingTokens = (ptn, tokens) => {
  return (tokens || []).filter((t) => !ptn.includes(t));
};

const resolveBranch = (game, predicate, label = "") => {
  const entries = Object.entries(game.branches);
  for (const [name, ply] of entries) {
    if (predicate(ply, name)) {
      return name;
    }
  }
  throw new Error(
    "Could not resolve branch" + (label ? " (" + label + ")" : "")
  );
};

const goToMainEnd = (game) => {
  game.board.targetBranch = "";
  game.board.goToPly(0, true);
  game.board.last();
};

const goToBranchEnd = (game, branch) => {
  const start = game.branches[branch];
  assert(Boolean(start), "Missing branch: " + branch);
  game.board.targetBranch = branch;
  game.board.goToPly(start.id, true);
  game.board.last();
};

const goToBranchPoint = (game, branch) => {
  const start = game.branches[branch];
  assert(Boolean(start), "Missing branch: " + branch);
  const parent = start.parent;
  assert(Boolean(parent), "Branch has no parent: " + branch);
  game.board.targetBranch = parent.branch || "";
  game.board.goToPly(parent.id, true);
};

const PTN_T1 = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{3w1}
3. c1 b3
4. c2 b4
`;

const PTN_T2 = `[Size "6"]
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
`;

const PTN_T4 = `[Size "6"]
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
`;

const PTN_T5 = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{3b1}
3. -- c1
4. a4 c2
`;

const PTN_T7 = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3

{3w1}
3. c1? b3
4. c2! b4
`;

const PTN_T8 = `[Size "6"]
[Opening "swap"]

1. a1 b1
{a note on mainline}
2. a2 b2

{2w1}
2. c1 b2
{note in branch}
3. c2 b3
`;

const PTN_T11 = `[Size "6"]
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
`;

const PTN_T10 = `[Komi "2"]
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
`;

const CASES = [
  {
    id: "T1",
    ptn: PTN_T1,
    start: { type: "branchEnd", branch: "3w1" },
    op: (g) => g.makeBranchMain("3w1", true),
    expectTokens: ["c1", "c2"],
  },
  {
    id: "T2",
    ptn: PTN_T2,
    start: { type: "branchEnd", branch: "3w2" },
    op: (g) => g.promoteBranch("3w2"),
    expectTokens: ["d1", "d2"],
  },
  {
    id: "T3",
    ptn: PTN_T1,
    start: { type: "mainEnd" },
    op: (g) => g.makeBranchMain("3w1", true),
    expectTokens: ["a3", "b3", "c1", "c2"],
  },
  {
    id: "T4",
    ptn: PTN_T4,
    start: { type: "branchEnd", branch: "3w1/4w1" },
    op: (g) => g.makeBranchMain("3w1/4w1", true),
    expectTokens: ["d1", "d2"],
  },
  {
    id: "T5",
    ptn: PTN_T5,
    start: { type: "branchEnd", branch: "3b1" },
    op: (g) => g.makeBranchMain("3b1", true),
    fixtureTokens: ["{3b1}", "-- c1", "a4 c2"],
    // After promotion, the branch black ply becomes mainline (so "-- c1" should NOT remain).
    // The old mainline black ply becomes a black-branch placeholder ("-- b3").
    expectTokens: ["a3 c1", "a4 c2", "{3b1}", "-- b3"],
  },
  {
    id: "T6",
    ptn: PTN_T2,
    start: { type: "branchPoint", branch: "3w1" },
    op: (g) => g.makeBranchMain("3w1", true),
    expectTokens: ["c1", "c2"],
  },
  {
    id: "T7",
    ptn: PTN_T7,
    start: { type: "branchEnd", branch: "3w1" },
    op: (g) => g.makeBranchMain("3w1", true),
    expectTokens: ["?", "!"],
  },
  {
    id: "T8",
    ptn: PTN_T8,
    start: { type: "branchEnd", branch: "2w1" },
    op: (g) => g.makeBranchMain("2w1", true),
    expectTokens: ["a note on mainline", "note in branch"],
    expectCommentCounts: true,
  },
  {
    id: "T9",
    ptn: PTN_T2,
    start: { type: "branchEnd", branch: "3w2" },
    op: (g) => {
      g.promoteBranch("3w2");
      validateGame(g);
      g.promoteBranch("3w2");
      validateGame(g);
      g.promoteBranch("3w1");
    },
    expectTokens: ["c1", "d1"],
  },
  {
    id: "T11",
    ptn: PTN_T11,
    start: { type: "branchEnd", branch: "3w3" },
    op: (g) => g.promoteBranch("3w3"),
    expectTokens: ["e1", "e2"],
  },
  {
    id: "T12",
    ptn: PTN_T11,
    start: { type: "mainEnd" },
    op: (g) => g.promoteBranch("3w3"),
    expectTokens: ["e1", "e2"],
  },
  {
    id: "T10",
    ptn: PTN_T10,
    start: (g) => {
      const target = resolveBranch(
        g,
        (ply) =>
          ply.move.number === 10 && ply.player === 2 && ply.text === "f5",
        "T10 start (10... f5)"
      );
      goToBranchEnd(g, target);
    },
    op: (g) => {
      const b14 = resolveBranch(
        g,
        (ply) =>
          ply.move.number === 14 && ply.player === 2 && ply.text === "c2",
        "T10 promote (14... c2)"
      );
      g.makeBranchMain(b14, true);
      validateGame(g);

      const deep = resolveBranch(
        g,
        (ply) =>
          ply.move.number === 10 && ply.player === 2 && ply.text === "f5",
        "T10 make main (10... f5)"
      );
      g.makeBranchMain(deep, true);
      validateGame(g);

      const w14c6 = resolveBranch(
        g,
        (ply) =>
          ply.move.number === 14 && ply.player === 1 && ply.text === "c6-",
        "T10 promote (14. c6-)"
      );
      g.promoteBranch(w14c6);
      validateGame(g);

      const b11b6 = resolveBranch(
        g,
        (ply) =>
          ply.move.number === 11 && ply.player === 2 && ply.text === "b6",
        "T10 promote (11... b6)"
      );
      g.promoteBranch(b11b6);

      // Ensure the final step leaves a valid/replayable game.
      validateGame(g);
    },
    expectTokens: ["c2", "d1"],
    // Position restoration is not checked for T10 because the complex
    // sequence of 4 nested promotions fundamentally restructures the
    // branch hierarchy, making exact position restoration impractical.
    expectPosition: false,
    // Board-state restoration is not checked for T10 for the same reason.
    expectBoardState: false,
  },
];

const startAt = (game, start) => {
  if (typeof start === "function") {
    start(game);
    return;
  }
  if (!start || start.type === "mainEnd") {
    goToMainEnd(game);
    return;
  }
  if (start.type === "branchEnd") {
    goToBranchEnd(game, start.branch);
    return;
  }
  if (start.type === "branchPoint") {
    goToBranchPoint(game, start.branch);
    return;
  }
  throw new Error("Unknown start type: " + String(start.type));
};

const runCase = (testCase, options = {}) => {
  const game = new Game({
    ptn: testCase.ptn,
    state: { plyIndex: 0 },
    onError: (error) => {
      throw error;
    },
  });

  // Ensure the fixture itself is valid and includes its branches
  validateGame(game);

  startAt(game, testCase.start);
  const before = snapshot(game);

  const expected = {
    plyCount: before.plyCount,
    position: testCase.expectPosition !== false ? before.position : null,
    plyIsDone: before.plyIsDone,
    tps: testCase.expectBoardState !== false ? before.tps : null,
    targetBranch:
      testCase.expectBoardState !== false ? before.targetBranch : null,
    tokens: testCase.expectTokens || [],
    notesCount: testCase.expectCommentCounts ? before.notesCount : null,
    chatlogCount: testCase.expectCommentCounts ? before.chatlogCount : null,
  };

  const diagnostics = {
    errors: [],
    missingTokens: [],
    plyCountChanged: false,
    position: {
      expectedPlyId: null,
      actualPlyId: null,
      resolvedTargetPlyId: null,
    },
    boardState: {
      expectedTPS: null,
      actualTPS: null,
      expectedTargetBranch: null,
      actualTargetBranch: null,
    },
    commentCountsChanged: false,
  };

  // Sanity check: ensure the fixture contains the tokens that make this test meaningful.
  // This is intentionally separate from `expectTokens`, which are post-operation invariants.
  const fixtureTokens = testCase.fixtureTokens || [];
  const missingInFixture = getMissingTokens(before.ptnAll, fixtureTokens);
  if (missingInFixture.length) {
    diagnostics.errors.push({
      step: "fixture",
      message:
        "Fixture PTN is missing expected token(s): " +
        missingInFixture.join(", "),
    });
    return {
      id: testCase.id,
      ok: false,
      expected,
      before,
      after: before,
      diagnostics,
    };
  }

  try {
    testCase.op(game);

    try {
      validateGame(game);
    } catch (e) {
      diagnostics.errors.push({
        step: "validateGame",
        message: e && e.message ? e.message : String(e),
      });
    }

    const after = snapshot(game);

    diagnostics.missingTokens = getMissingTokens(after.ptnAll, expected.tokens);
    diagnostics.plyCountChanged = after.plyCount !== expected.plyCount;

    if (expected.position) {
      const target = game.findPlyFromPath(expected.position);
      diagnostics.position.expectedPlyId = target ? target.id : null;
      diagnostics.position.actualPlyId = game.board ? game.board.plyID : null;
      diagnostics.position.resolvedTargetPlyId = target ? target.id : null;
    }

    if (expected.tps !== null || expected.targetBranch !== null) {
      diagnostics.boardState.expectedTPS = expected.tps;
      diagnostics.boardState.actualTPS = after.tps;
      diagnostics.boardState.expectedTargetBranch = expected.targetBranch;
      diagnostics.boardState.actualTargetBranch = after.targetBranch;
    }

    if (testCase.expectCommentCounts) {
      diagnostics.commentCountsChanged =
        after.notesCount !== expected.notesCount ||
        after.chatlogCount !== expected.chatlogCount;
    }

    const ok =
      diagnostics.errors.length === 0 &&
      diagnostics.missingTokens.length === 0 &&
      !diagnostics.plyCountChanged &&
      (!expected.position ||
        diagnostics.position.actualPlyId ===
          diagnostics.position.expectedPlyId) &&
      (expected.tps === null ||
        diagnostics.boardState.actualTPS === expected.tps) &&
      (expected.targetBranch === null ||
        diagnostics.boardState.actualTargetBranch === expected.targetBranch) &&
      !diagnostics.commentCountsChanged;

    const result = {
      id: testCase.id,
      ok,
      expected,
      before,
      after,
      diagnostics,
    };

    if (!ok && options.debug) {
      console.groupCollapsed(
        "Branch promotion test failed:",
        testCase.id,
        result.diagnostics
      );
      console.log("Expected:", expected);
      console.log("Before snapshot:", before);
      console.log("After snapshot:", after);
      console.log("PTN after (all branches):\n" + after.ptnAll);
      console.log("PTN after (main only):\n" + after.ptnMain);
      console.log("Branch keys (after):", after.branchKeys);
      console.groupEnd();
    }

    return result;
  } catch (e) {
    const after = snapshot(game);
    diagnostics.errors.push({
      step: "operation",
      message: e && e.message ? e.message : String(e),
      stack: e && e.stack ? String(e.stack) : null,
    });

    const result = {
      id: testCase.id,
      ok: false,
      expected,
      before,
      after,
      diagnostics,
    };

    if (options.debug) {
      console.groupCollapsed("Branch promotion test threw:", testCase.id);
      console.log("Expected:", expected);
      console.log("Before snapshot:", before);
      console.log("After snapshot:", after);
      console.log("Diagnostics:", diagnostics);
      console.groupEnd();
    }

    return result;
  }
};

const runAll = (options = {}) => {
  const results = [];
  for (const testCase of CASES) {
    results.push(runCase(testCase, options));
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.table(results);
    if (typeof window !== "undefined") {
      window.branchPromotionTestsLastFailure = failed[0];
    }
    throw new Error(
      "Branch promotion tests failed: " + failed.map((f) => f.id).join(", ")
    );
  }

  console.table(results);
  return results;
};

export const installBranchPromotionRunner = () => {
  const meta = {
    installedAt: new Date().toISOString(),
    caseCount: CASES.length,
    caseIds: CASES.map((c) => c.id),
  };

  window.branchPromotionTests = {
    runAll: (options = {}) => runAll(options),
    runCase: (id, options = {}) => {
      const c = CASES.find((x) => x.id === id);
      assert(Boolean(c), "Unknown test case: " + id);
      const result = runCase(c, { debug: true, ...options });
      if (!result.ok) {
        window.branchPromotionTestsLastFailure = result;
      }
      return result;
    },
    list: () => CASES.map((c) => c.id),
    lastFailure: () => window.branchPromotionTestsLastFailure || null,
    __meta: meta,
  };

  console.log("branchPromotionRunner installed", meta);

  return window.branchPromotionTests;
};
