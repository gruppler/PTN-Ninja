// @ts-check
const {
  test,
  expect,
  loadPTN,
  act,
  goTo,
  expectHealthy,
} = require("./helpers");

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
 * then trim. Returns the state before and after, and after an undo. Checks the
 * trimmed game is healthy, which includes the round trip through its PTN.
 */
async function trimAt(page, text, isDone) {
  await goTo(page, { number: 4, player: 1, text }, isDone);
  const before = await page.evaluate(inspect);
  const position = await page.evaluate(() => {
    const game = window.app.$game;
    return {
      plyText: game.board.ply.text,
      isDone: game.board.plyIsDone,
      tps: game.board.tps,
    };
  });

  expect(await act(page, "game/TRIM_TO_PLY")).toBeNull();
  const after = await page.evaluate(inspect);
  await expectHealthy(page, "trimmed game");

  expect(await act(page, "game/UNDO")).toBeNull();
  const undone = await page.evaluate(inspect);

  return { before, position, after, undone };
}

function expectSound(state) {
  expect(state.hasNullHoles).toBe(false);
  expect(state.hasNullPlies).toBe(false);
  expect(state.outputError).toBeNull();
  expect(state.animateBoard).toBe(true);
}

test.describe("Trim to current ply", () => {
  test.beforeEach(async ({ page }) => {
    await loadPTN(page, PTN, { expandAll: false, showAllBranches: null });
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

      expect(after.historyIndex).toBe(before.historyIndex + 1);
      expectSound(after);

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
      expectSound(undone);
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

      expect(after.historyIndex).toBe(before.historyIndex + 1);
      expectSound(after);

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
      expectSound(undone);
    });
  }

  test("a failed edit leaves the game unchanged and usable", async ({
    page,
    pageErrors,
  }) => {
    await goTo(page, { number: 4, player: 1, text: "e3" }, false);
    const before = await page.evaluate(inspect);
    const boardState = () =>
      page.evaluate(() => ({
        plyID: window.app.$game.board.plyID,
        isDone: window.app.$game.board.plyIsDone,
        targetBranch: window.app.$game.board.targetBranch,
      }));
    const position = await boardState();

    // Fail once, after the trim has already started changing the game
    await page.evaluate(() => {
      const game = window.app.$game;
      const updatePTN = game._updatePTN;
      game._updatePTN = function () {
        game._updatePTN = updatePTN;
        throw new Error("Injected failure");
      };
    });
    expect(await act(page, "game/TRIM_TO_PLY")).toBeNull();
    // The error escapes from the deferred commit as an uncaught page error
    await expect.poll(() => pageErrors).toEqual(["Injected failure"]);
    pageErrors.length = 0;

    const after = await page.evaluate(inspect);
    const restored = await boardState();

    // The game still works
    expect(await act(page, "game/LAST")).toBeNull();
    expect(await act(page, "game/FIRST")).toBeNull();
    const usable = await page.evaluate(inspect);

    expect(after.ptn).toBe(before.ptn);
    expect(after.historyIndex).toBe(before.historyIndex);
    expect(restored).toEqual(position);
    expectSound(after);
    expectSound(usable);
    await expectHealthy(page);
  });
});
