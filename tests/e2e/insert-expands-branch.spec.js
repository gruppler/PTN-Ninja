// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Inserting a ply that lands on an existing branch (e.g. selecting an
 * analysis suggestion) should expand any collapsed branch points on the path
 * to it in inline branches mode, so the current ply stays visible in the PTN
 * panel, as it does when playing the move on the board.
 */

const PTN = `[Size "5"]

1. a1 e5
2. c3 c2
3. d3 d2

{2b1}
2. ... b2
3. b3 d2

{2b1/3b1}
3. ... e1

{2b2}
2. ... d4
3. b3 d2
`;

async function setup(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.app && window.app.$store, {
    timeout: 30000,
  });
  await page.evaluate(async (ptn) => {
    const store = window.app.$store;
    store.dispatch("ui/SET_UI", ["showPTN", true]);
    store.dispatch("ui/SET_UI", ["showAllBranches", true]);
    store.dispatch("ui/SET_UI", ["inlineBranches", true]);
    await store.dispatch("game/ADD_GAME", { ptn, name: "Test Game" });
  }, PTN);
  await page.waitForFunction(
    () => {
      const game = window.app && window.app.$game;
      return game && game.branches && game.branches["2b1/3b1"];
    },
    { timeout: 10000 }
  );
}

// Collapses every branch point, then goes to the main line's 2. c3
async function collapseAllAndGoToC3(page) {
  await page.evaluate(async () => {
    const store = window.app.$store;
    const plies = Object.values(store.state.game.ptn.allPlies);
    const overrides = {};
    plies.forEach((ply) => {
      if (
        ply.branches &&
        ply.branches.length > 1 &&
        ply.branches[0] === ply.id
      ) {
        overrides[ply.id] = false;
      }
    });
    await store.dispatch("game/SET_BRANCH_POINT_OVERRIDES", overrides);
    const c3 = plies.find((ply) => ply.text === "c3" && !ply.branch);
    await store.dispatch("game/GO_TO_PLY", { plyID: c3.id, isDone: true });
  });
}

async function currentPlyState(page) {
  return page.evaluate(() => {
    const store = window.app.$store;
    const ply = store.state.game.position.ply;
    const plies = store.state.game.ptn.allPlies;
    const overrides = store.state.game.ptnUI.branchPointOverrides;
    // Branch points on the path to the current ply
    const branchPoints = [];
    const names = ply.branch ? ply.branch.split("/") : [];
    for (let i = 1; i <= names.length; i++) {
      const root = store.state.game.ptn.branches[names.slice(0, i).join("/")];
      if (root && root.branches && root.branches[0] !== root.id) {
        branchPoints.push(plies[root.branches[0]].id);
      }
    }
    return {
      text: ply.text,
      branch: ply.branch,
      expanded: branchPoints.map((id) => overrides[id]),
    };
  });
}

test.describe("Inserting a ply expands its branch", () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
  });

  test("INSERT_PLY onto an existing sibling branch", async ({ page }) => {
    await collapseAllAndGoToC3(page);
    await page.evaluate(() =>
      window.app.$store.dispatch("game/INSERT_PLY", "d4")
    );

    await expect
      .poll(() => currentPlyState(page))
      .toMatchObject({ text: "d4", branch: "2b2", expanded: [true] });
    await expect(page.locator(".ptn.ply.selected")).not.toHaveCount(0);
  });

  test("INSERT_PLIES through nested branch points", async ({ page }) => {
    await collapseAllAndGoToC3(page);
    await page.evaluate(() =>
      window.app.$store.dispatch("game/INSERT_PLIES", {
        plies: ["b2", "b3", "e1"],
        prev: 0,
      })
    );

    await expect
      .poll(() => currentPlyState(page))
      .toMatchObject({ text: "e1", branch: "2b1/3b1", expanded: [true, true] });
  });

  test("Leaves branch points alone when inline branches are off", async ({
    page,
  }) => {
    await collapseAllAndGoToC3(page);
    await page.evaluate(async () => {
      const store = window.app.$store;
      store.dispatch("ui/SET_UI", ["inlineBranches", false]);
      await store.dispatch("game/INSERT_PLY", "d4");
    });

    await expect
      .poll(() => currentPlyState(page))
      .toMatchObject({ text: "d4", branch: "2b2", expanded: [false] });
  });
});
