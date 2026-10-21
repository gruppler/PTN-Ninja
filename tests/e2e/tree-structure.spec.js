// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Tree Structure E2E Tests
 *
 * These tests verify that the tree structure (parent/children relationships)
 * is correctly maintained and that navigation works properly.
 */

// Test fixtures
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

  // Complex branching
  COMPLEX: `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2
3. a3 b3
4. a4 b4
5. a5 b5

{3w1}
3. c1 b3
4. c2 b4

{3w1/4w1}
4. d1 b4
5. d2 b5

{3w2}
3. e1 b3
4. e2 b4

{5w1}
5. f1 b5
6. f2 b6
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

test.describe("Tree Structure Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store);
  });

  test("Linear game: all plies have correct parent/children", async ({
    page,
  }) => {
    await loadPTN(page, PTN_FIXTURES.LINEAR);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const issues = [];

      // First ply should have no parent
      const firstPly = game.plies[0];
      if (firstPly.parent !== null) {
        issues.push(`First ply has parent: ${firstPly.parent?.id}`);
      }

      // Each ply should have exactly one child (except last)
      for (let i = 0; i < game.plies.length - 1; i++) {
        const ply = game.plies[i];
        if (ply.children.length !== 1) {
          issues.push(
            `Ply ${i} has ${ply.children.length} children, expected 1`
          );
        }
        if (ply.children[0] !== game.plies[i + 1]) {
          issues.push(`Ply ${i} child mismatch`);
        }
      }

      // Last ply should have no children
      const lastPly = game.plies[game.plies.length - 1];
      if (lastPly.children.length !== 0) {
        issues.push(`Last ply has ${lastPly.children.length} children`);
      }

      // Each ply (except first) should have correct parent
      for (let i = 1; i < game.plies.length; i++) {
        const ply = game.plies[i];
        if (ply.parent !== game.plies[i - 1]) {
          issues.push(`Ply ${i} parent mismatch`);
        }
      }

      return { ok: issues.length === 0, issues };
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.log("Issues:", result.issues);
    }
  });

  test("Single branch: branch ply has correct parent", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.SINGLE_BRANCH);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const issues = [];

      // Find the branch ply (3w1)
      const branchPly = game.branches["3w1"];
      if (!branchPly) {
        return { ok: false, issues: ["Branch 3w1 not found"] };
      }

      // Branch ply's parent should be the ply before the branch point
      // Branch starts at move 3 player 1, so parent should be move 2 player 2 (b2)
      const expectedParent = game.plies.find(
        (p) => p.move.number === 2 && p.player === 2 && p.branch === ""
      );

      if (branchPly.parent !== expectedParent) {
        issues.push(
          `Branch ply parent mismatch. Expected ply at move 2 player 2, got ${branchPly.parent?.move?.number} player ${branchPly.parent?.player}`
        );
      }

      // The main continuation (a3) should also have the same parent
      const mainPly = game.plies.find(
        (p) => p.move.number === 3 && p.player === 1 && p.branch === ""
      );
      if (mainPly.parent !== expectedParent) {
        issues.push(`Main ply parent mismatch`);
      }

      // Parent should have both as children
      if (expectedParent) {
        if (!expectedParent.children.includes(mainPly)) {
          issues.push("Parent missing main ply in children");
        }
        if (!expectedParent.children.includes(branchPly)) {
          issues.push("Parent missing branch ply in children");
        }
      }

      return { ok: issues.length === 0, issues };
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.log("Issues:", result.issues);
    }
  });

  test("Navigation: prevPly uses tree parent", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.SINGLE_BRANCH);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const issues = [];

      // Find the last ply in branch 3w1
      const branchPlies = game.plies.filter((p) => p.branch === "3w1");
      if (branchPlies.length === 0) {
        return { ok: false, issues: ["No plies in branch 3w1"] };
      }

      // Get the last ply in the branch
      const lastBranchPly = branchPlies[branchPlies.length - 1];

      // Walk back using parent references
      const visited = [];
      let current = lastBranchPly;
      while (current) {
        visited.push({
          id: current.id,
          text: current.text,
          branch: current.branch,
        });
        current = current.parent;
      }

      // Should have visited plies going back to root
      if (visited.length < 3) {
        issues.push(
          `Only visited ${visited.length} plies, expected at least 3`
        );
      }

      // Last visited should be root (no parent)
      const lastVisited = visited[visited.length - 1];
      if (lastVisited.branch !== "") {
        issues.push(
          `Did not reach main branch, ended at branch: ${lastVisited.branch}`
        );
      }

      return { ok: issues.length === 0, issues, visited };
    });

    expect(result.ok).toBe(true);
  });

  test("Navigation: nextPly uses tree children", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.SINGLE_BRANCH);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const issues = [];

      // Start at root ply
      const root = game.rootPly;
      if (!root) {
        return { ok: false, issues: ["No root ply"] };
      }

      // Walk forward using children[0] (main continuation)
      const visited = [];
      let current = root;
      let count = 0;
      while (current && count < 20) {
        visited.push({
          id: current.id,
          text: current.text,
          branch: current.branch,
        });
        // Follow main continuation (first child)
        current = current.children.length > 0 ? current.children[0] : null;
        count++;
      }

      // Should have visited all main branch plies
      const mainPlyCount = game.plies.filter((p) => p.branch === "").length;
      const visitedMainCount = visited.filter((p) => p.branch === "").length;

      if (visitedMainCount !== mainPlyCount) {
        issues.push(
          `Visited ${visitedMainCount} main plies, expected ${mainPlyCount}`
        );
      }

      return { ok: issues.length === 0, issues, visited };
    });

    expect(result.ok).toBe(true);
  });

  test("Tree traversal: getPliesFromTree returns all plies", async ({
    page,
  }) => {
    await loadPTN(page, PTN_FIXTURES.COMPLEX);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const issues = [];

      const treePlies = game.getPliesFromTree();
      const allPlies = game.plies;

      if (treePlies.length !== allPlies.length) {
        issues.push(
          `Tree has ${treePlies.length} plies, game has ${allPlies.length}`
        );
      }

      // All plies should be in tree
      for (const ply of allPlies) {
        if (!treePlies.includes(ply)) {
          issues.push(`Ply ${ply.id} not in tree`);
        }
      }

      return { ok: issues.length === 0, issues };
    });

    expect(result.ok).toBe(true);
  });

  test("Verify parent relationships", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.COMPLEX);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      return game.verifyParentRelationships();
    });

    expect(result.length).toBe(0);
  });

  test("Verify children relationships", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.COMPLEX);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      return game.verifyChildrenRelationships();
    });

    expect(result.length).toBe(0);
  });

  test("Ply.getPath returns correct path from root", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.NESTED);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const issues = [];

      // Get a ply deep in a nested branch
      const nestedBranch = game.branches["3w1/4w1"];
      if (!nestedBranch) {
        return { ok: false, issues: ["Nested branch not found"] };
      }

      // Find the last ply in this branch
      let deepPly = nestedBranch;
      while (deepPly.children.length > 0) {
        const child = deepPly.children.find((c) =>
          c.branch.startsWith("3w1/4w1")
        );
        if (child) {
          deepPly = child;
        } else {
          break;
        }
      }

      const path = deepPly.getPath();

      // Path should start with root ply
      if (path[0] !== game.rootPly) {
        issues.push("Path does not start with root ply");
      }

      // Path should end with the target ply
      if (path[path.length - 1] !== deepPly) {
        issues.push("Path does not end with target ply");
      }

      // Each ply in path should be parent of next
      for (let i = 0; i < path.length - 1; i++) {
        if (!path[i].children.includes(path[i + 1])) {
          issues.push(`Path broken at index ${i}`);
        }
      }

      return { ok: issues.length === 0, issues, pathLength: path.length };
    });

    expect(result.ok).toBe(true);
  });

  test("Ply.depth is correct", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.LINEAR);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const issues = [];

      for (let i = 0; i < game.plies.length; i++) {
        const ply = game.plies[i];
        if (ply.depth !== i) {
          issues.push(`Ply ${i} has depth ${ply.depth}, expected ${i}`);
        }
      }

      return { ok: issues.length === 0, issues };
    });

    expect(result.ok).toBe(true);
  });

  test("Serializable path survives init", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.NESTED);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Navigate to a specific position in a branch
      const branchPly = game.branches["3w1/4w1"];
      await store.dispatch("game/SET_TARGET", branchPly);
      await store.dispatch("game/LAST");

      const ply = game.board.ply;
      const path = ply.getSerializablePath();
      const originalText = ply.text;
      const originalBranch = ply.branch;

      // Force a re-init by making a trivial change
      const ptn = game.toString({ showAllBranches: true });
      game.init({ ...game.params, ptn });

      // Try to find the ply again using the path
      const foundPly = game.findPlyFromPath(path);

      if (!foundPly) {
        return { ok: false, error: "Could not find ply from path" };
      }

      if (foundPly.text !== originalText) {
        return {
          ok: false,
          error: `Text mismatch: ${foundPly.text} vs ${originalText}`,
        };
      }

      if (foundPly.branch !== originalBranch) {
        return {
          ok: false,
          error: `Branch mismatch: ${foundPly.branch} vs ${originalBranch}`,
        };
      }

      return { ok: true };
    });

    expect(result.ok).toBe(true);
  });

  test("Multiple siblings: all have same parent", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.MULTI_BRANCH);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const issues = [];

      // Get the main ply and all branch plies at move 3
      const mainPly = game.plies.find(
        (p) => p.move.number === 3 && p.player === 1 && p.branch === ""
      );
      const branch1 = game.branches["3w1"];
      const branch2 = game.branches["3w2"];
      const branch3 = game.branches["3w3"];

      if (!mainPly || !branch1 || !branch2 || !branch3) {
        return { ok: false, issues: ["Missing expected plies"] };
      }

      // All should have the same parent
      const parent = mainPly.parent;
      if (branch1.parent !== parent) {
        issues.push("Branch 3w1 has different parent");
      }
      if (branch2.parent !== parent) {
        issues.push("Branch 3w2 has different parent");
      }
      if (branch3.parent !== parent) {
        issues.push("Branch 3w3 has different parent");
      }

      // Parent should have all 4 as children
      if (parent) {
        if (parent.children.length !== 4) {
          issues.push(
            `Parent has ${parent.children.length} children, expected 4`
          );
        }
        if (!parent.children.includes(mainPly)) {
          issues.push("Parent missing main ply");
        }
        if (!parent.children.includes(branch1)) {
          issues.push("Parent missing branch1");
        }
        if (!parent.children.includes(branch2)) {
          issues.push("Parent missing branch2");
        }
        if (!parent.children.includes(branch3)) {
          issues.push("Parent missing branch3");
        }
      }

      return { ok: issues.length === 0, issues };
    });

    expect(result.ok).toBe(true);
  });

  test("rootPly getter returns first main branch ply", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.COMPLEX);

    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const root = game.rootPly;

      if (!root) {
        return { ok: false, error: "rootPly is null" };
      }

      if (root.index !== 0) {
        return {
          ok: false,
          error: `rootPly index is ${root.index}, expected 0`,
        };
      }

      if (root.branch !== "") {
        return {
          ok: false,
          error: `rootPly branch is "${root.branch}", expected ""`,
        };
      }

      if (root.parent !== null) {
        return { ok: false, error: "rootPly has a parent" };
      }

      return { ok: true };
    });

    expect(result.ok).toBe(true);
  });
});

test.describe("Branch Operations with Tree Structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store);
  });

  test("After promotion, tree structure is valid", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.SINGLE_BRANCH);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Promote the branch
      await store.dispatch("game/MAKE_BRANCH_MAIN", "3w1");

      // Verify tree structure
      const parentIssues = game.verifyParentRelationships();
      const childrenIssues = game.verifyChildrenRelationships();

      return {
        ok: parentIssues.length === 0 && childrenIssues.length === 0,
        parentIssues,
        childrenIssues,
      };
    });

    expect(result.ok).toBe(true);
  });

  test("After inserting ply, tree structure is valid", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.LINEAR);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Go to end and insert a new ply
      await store.dispatch("game/LAST");
      await store.dispatch("game/INSERT_PLY", "a5");

      // Verify tree structure
      const parentIssues = game.verifyParentRelationships();
      const childrenIssues = game.verifyChildrenRelationships();

      return {
        ok: parentIssues.length === 0 && childrenIssues.length === 0,
        parentIssues,
        childrenIssues,
        plyCount: game.plies.length,
      };
    });

    expect(result.ok).toBe(true);
    expect(result.plyCount).toBe(9); // 8 original + 1 new
  });

  test("After deleting ply, tree structure is valid", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.LINEAR);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      const originalCount = game.plies.length;

      // Go to last ply and delete it
      await store.dispatch("game/LAST");
      await store.dispatch("game/DELETE_PLY");

      // Verify tree structure
      const parentIssues = game.verifyParentRelationships();
      const childrenIssues = game.verifyChildrenRelationships();

      return {
        ok: parentIssues.length === 0 && childrenIssues.length === 0,
        parentIssues,
        childrenIssues,
        plyCount: game.plies.filter(Boolean).length,
        originalCount,
      };
    });

    expect(result.ok).toBe(true);
  });

  test("Creating a new branch maintains tree structure", async ({ page }) => {
    await loadPTN(page, PTN_FIXTURES.LINEAR);

    const result = await page.evaluate(async () => {
      const game = window.app.$game;
      const store = window.app.$store;

      // Go to move 3 and create a branch by inserting alternative
      await store.dispatch("game/FIRST");
      // Navigate to ply 4 (move 3, player 1)
      for (let i = 0; i < 4; i++) {
        await store.dispatch("game/NEXT", { half: false, times: 1 });
      }

      // Insert an alternative ply (creates a branch)
      await store.dispatch("game/INSERT_PLY", "c1");

      // Verify tree structure
      const parentIssues = game.verifyParentRelationships();
      const childrenIssues = game.verifyChildrenRelationships();

      // Check that we have a branch now
      const branchCount = Object.keys(game.branches).length;

      return {
        ok: parentIssues.length === 0 && childrenIssues.length === 0,
        parentIssues,
        childrenIssues,
        branchCount,
      };
    });

    expect(result.ok).toBe(true);
  });
});
