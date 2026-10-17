// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Trim to Current Ply
 *
 * Trimming makes the current board position the game's starting position
 * (a TPS tag) and removes everything before it.
 *
 * - Done ply P: the new start is the position after P. P's continuation and
 *   every branch after P survive; P's own siblings are dropped.
 * - Undone ply P: the new start is the position before P. P and every sibling
 *   of P survive with their subtrees. P's line becomes the main line, and each
 *   sibling keeps a distinct branch name.
 *
 * Trimming at a branch point used to crash halfway through, leaving the game
 * corrupt and board animations disabled, and trimming just before a branch
 * point lost the siblings listed above the selected one.
 */

const PTN = `[Size "6"]

1. a1 f6
2. d4 c4
3. d2 d6
4. Cc3 b2
5. d5 b5

{4w1}
4. d3 a2

{4w2}
4. e3 a3

{4w3}
4. e2 a4
`;

// Each move-4 alternative and the line that follows it
const LINES = {
  Cc3: ["Cc3", "b2", "d5", "b5"],
  d3: ["d3", "a2"],
  e3: ["e3", "a3"],
  e2: ["e2", "a4"],
};

async function loadPTN(page, ptn) {
  await page.evaluate(async (ptnText) => {
    await window.app.$store.dispatch("game/ADD_GAME", {
      ptn: ptnText,
      name: "Trim Test",
    });
  }, ptn);
  await page.waitForFunction(() => {
    const game = window.app && window.app.$game;
    return game && game.board && game.plies && game.plies.length > 0;
  });
}

/** Inspect the game's integrity and shape. Runs in the page. */
const inspect = () => {
  const game = window.app.$game;
  const store = window.app.$store;

  let outputError = null;
  try {
    const plies = game.board.output.ptn.allPlies;
    game.moves.forEach((move) => move.output(plies));
  } catch (error) {
    outputError = error.message;
  }

  // Follow a branch from its first ply
  const lineOf = (ply) => {
    const line = [];
    while (ply) {
      line.push(ply.text);
      ply = ply.children.find((child) => child.branch === ply.branch);
    }
    return line;
  };

  const first = game.plies.find((ply) => ply && !ply.parent && !ply.branch);
  const roots = first ? (first.branches.length ? first.branches : [first]) : [];

  return {
    ptn: game.ptn,
    historyIndex: game.historyIndex,
    animateBoard: store.state.ui.animateBoard,
    hasNullHoles: game.moves.some(
      (move) => !move || move.plies.some((ply) => !ply)
    ),
    hasNullPlies: game.plies.some((ply) => !ply),
    outputError,
    tps: game.tags.tps ? game.tags.tps.toString() : null,
    mainLine: game.board.plies.map((ply) => ply.text),
    roots: roots.map((ply) => ({ branch: ply.branch, line: lineOf(ply) })),
    branchNames: Object.keys(game.branches),
  };
};

/**
 * Select the move-4 alternative `text` (and its branch), put the board on it,
 * then trim. Returns the state before and after, and after an undo.
 */
async function trimAt(page, text, isDone) {
  return page.evaluate(
    async ({ text, isDone, inspectSrc }) => {
      const inspect = eval(inspectSrc);
      const store = window.app.$store;
      const game = window.app.$game;
      const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

      const ply = game.plies.find(
        (p) => p && p.move.number === 4 && p.player === 1 && p.text === text
      );
      await store.dispatch("game/SET_TARGET", ply);
      await store.dispatch("game/GO_TO_PLY", { plyID: ply.id, isDone });
      await settle();

      const before = inspect();
      const position = {
        plyText: game.board.ply.text,
        isDone: game.board.plyIsDone,
        tps: game.board.tps,
      };

      await store.dispatch("game/TRIM_TO_PLY");
      await settle();
      const after = inspect();

      await store.dispatch("game/UNDO");
      await settle();
      const undone = inspect();

      return { before, position, after, undone };
    },
    { text, isDone, inspectSrc: `(${inspect.toString()})` }
  );
}

function expectHealthy(state) {
  expect(state.hasNullHoles).toBe(false);
  expect(state.hasNullPlies).toBe(false);
  expect(state.outputError).toBeNull();
  expect(state.animateBoard).toBe(true);
}

test.describe("Trim to current ply", () => {
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on("pageerror", (error) => {
      // Unrelated config noise from the dev environment
      if (!/Game not found/.test(error.message)) {
        pageErrors.push(error.message);
      }
    });
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store, {
      timeout: 30000,
    });
    await loadPTN(page, PTN);
  });

  for (const selected of Object.keys(LINES)) {
    test(`done on branch point ${selected} keeps only what follows it`, async ({
      page,
    }) => {
      const { before, position, after, undone } = await trimAt(
        page,
        selected,
        true
      );
      expect(position).toMatchObject({ plyText: selected, isDone: true });

      expect(pageErrors).toEqual([]);
      expect(after.historyIndex).toBe(before.historyIndex + 1);
      expectHealthy(after);

      // Starts from the position after the selected ply
      expect(after.tps).toBe(`[TPS "${position.tps}"]`);
      expect(after.mainLine).toEqual(LINES[selected].slice(1));
      // The selected ply's siblings are gone
      expect(after.roots).toEqual([
        { branch: "", line: LINES[selected].slice(1) },
      ]);
      expect(after.branchNames).toEqual([""]);

      // Undo restores the original exactly
      expect(undone.ptn).toBe(before.ptn);
      expect(undone.historyIndex).toBe(before.historyIndex);
      expectHealthy(undone);
    });

    test(`undone on branch point ${selected} keeps every sibling`, async ({
      page,
    }) => {
      const { before, position, after, undone } = await trimAt(
        page,
        selected,
        false
      );
      expect(position).toMatchObject({ plyText: selected, isDone: false });

      expect(pageErrors).toEqual([]);
      expect(after.historyIndex).toBe(before.historyIndex + 1);
      expectHealthy(after);

      // Starts from the position before the selected ply
      expect(after.tps).toBe(`[TPS "${position.tps}"]`);
      // The selected line is now the main line
      expect(after.mainLine).toEqual(LINES[selected]);
      expect(after.roots[0]).toEqual({ branch: "", line: LINES[selected] });

      // Every sibling survives with its whole line and a distinct name
      expect(after.roots.map((root) => root.line).sort()).toEqual(
        Object.values(LINES).sort()
      );
      const names = after.roots.map((root) => root.branch);
      expect(new Set(names).size).toBe(names.length);
      expect(names.filter((name) => name === "")).toHaveLength(1);

      // The other siblings keep their relative order
      const others = Object.keys(LINES).filter((text) => text !== selected);
      expect(after.roots.slice(1).map((root) => root.line[0])).toEqual(others);

      // Undo restores the original exactly
      expect(undone.ptn).toBe(before.ptn);
      expect(undone.historyIndex).toBe(before.historyIndex);
      expectHealthy(undone);
    });
  }

  test("a failed edit leaves the game unchanged and usable", async ({
    page,
  }) => {
    const result = await page.evaluate(async (inspectSrc) => {
      const inspect = eval(inspectSrc);
      const store = window.app.$store;
      const game = window.app.$game;
      const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

      const ply = game.plies.find(
        (p) => p && p.move.number === 4 && p.player === 1 && p.text === "e3"
      );
      await store.dispatch("game/SET_TARGET", ply);
      await store.dispatch("game/GO_TO_PLY", { plyID: ply.id, isDone: false });
      await settle();
      const before = inspect();
      const position = {
        plyID: game.board.plyID,
        isDone: game.board.plyIsDone,
        targetBranch: game.board.targetBranch,
      };

      // Fail once, after the trim has already started changing the game
      const updatePTN = game._updatePTN;
      game._updatePTN = function () {
        game._updatePTN = updatePTN;
        throw new Error("Injected failure");
      };

      await store.dispatch("game/TRIM_TO_PLY");
      await settle();
      const after = inspect();
      const restored = {
        plyID: window.app.$game.board.plyID,
        isDone: window.app.$game.board.plyIsDone,
        targetBranch: window.app.$game.board.targetBranch,
      };

      // The game still works
      await store.dispatch("game/LAST");
      await store.dispatch("game/FIRST");
      await settle();
      const usable = inspect();

      return { before, position, after, restored, usable };
    }, `(${inspect.toString()})`);

    expect(pageErrors).toEqual(["Injected failure"]);
    expect(result.after.ptn).toBe(result.before.ptn);
    expect(result.after.historyIndex).toBe(result.before.historyIndex);
    expect(result.restored).toEqual(result.position);
    expectHealthy(result.after);
    expectHealthy(result.usable);
  });
});
