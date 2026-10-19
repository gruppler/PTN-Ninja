// @ts-check
const {
  SEP,
  test,
  expect,
  loadPTN,
  act,
  snapshot,
  expectHealthy,
  expectUndoRedo,
  expectUnchanged,
  branchKeys,
  branchLine,
  siblings,
  goTo,
  goToBranchEnd,
  setProtectedMainline,
} = require("./helpers");

/**
 * Trim matrix
 *
 * Covers the cases the coverage audit found missing from trim-to-ply.spec.js
 * (R1-R28) for the three trim actions in the PTN tools menu:
 *
 * - game/TRIM_TO_PLY: the board position becomes the start (a TPS tag). With
 *   the board done on ply P, the game keeps the ply after P, its siblings and
 *   everything after them. With the board undone on P, it keeps P, its
 *   siblings and everything after them. The kept ply's line becomes main.
 * - game/TRIM_TO_BOARD: the board position becomes the start, with no moves.
 * - game/TRIM_BRANCHES: only the board's current line is kept.
 *
 * expectTrim checks every kept line is exactly the tail of a line from
 * before, with the same annotations and board positions, that the game is
 * healthy and round-trips, and that UNDO/REDO restore the exact PTN.
 */

// The fixture from trim-to-ply.spec.js
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

const LINEAR = `[Size "6"]

1. a1 f6
2. d4 c4
3. d2 d6
`;

// Alternatives for black's fourth move
const BLACK = `[Size "6"]

1. a1 f6
2. d4 c4
3. d2 d6
4. Cc3 b2
5. d5 b5

{4b1}
4. -- a2

{4b2}
4. -- a3
`;

// 4w1 has a branch of its own
const NESTED = `${PTN.replace("4. d3 a2\n", "4. d3 a2\n5. e1\n")}
{4w1/5w1}
5. f1 f2
`;

// Branches that split off before move 4
const EARLY = `${PTN}
{2w1}
2. e5 e4
3. e3

{2w1/3w1}
3. a6
`;

// Branch points after move 4, on the main line and inside 4w2
const LATER = `[Size "6"]

1. a1 f6
2. d4 c4
3. d2 d6
4. Cc3 b2
5. d5 b5

{5w1}
5. a5

{4w1}
4. d3 a2

{4w2}
4. e3 a3
5. f1

{4w2/5w1}
5. f5 f4

{4w3}
4. e2 a4
`;

const FIRST_W = `[Size "6"]
[Opening "swap"]

1. a1 b1
2. a2 b2

{1w1}
1. c1 b1
2. c2 b2
`;

/** Load a fixture and check it is healthy */
async function load(page, ptn) {
  await loadPTN(page, ptn);
  await expectHealthy(page, "fixture");
}

/**
 * What TRIM_TO_PLY should keep from the current position, worked out from
 * the board before the trim
 */
async function expectation(page) {
  return page.evaluate(() => {
    const probe = window.__probe;
    const board = window.app.$game.board;
    const newPly = board.plyIsDone ? board.nextPly : board.ply;
    if (!newPly) {
      return { toBoard: true, tps: board.tps };
    }
    const roots = newPly.branches.length ? newPly.branches : [newPly];
    const main = [];
    for (
      let ply = newPly;
      ply;
      ply = ply.children.find((child) => child.branch === ply.branch)
    ) {
      main.push(ply.text);
    }
    return {
      toBoard: false,
      tps: board.tps,
      prefix: newPly.parent ? probe.pathTokens(newPly.parent) : [],
      roots: roots.map(probe.tok),
      main,
    };
  });
}

const withoutTPS = (header) => header.replace(/\[TPS "[^"]*"\]\r\n/, "");

/**
 * Check a TRIM_TO_PLY (or TRIM_TO_BOARD) result against `exp`, then UNDO and
 * REDO. Returns the snapshot after the trim.
 */
async function expectTrim(page, before, exp) {
  const after = await snapshot(page);
  expect(after.historyIndex, "one history entry").toBe(
    Math.min(before.historyIndex + 1, 5)
  );
  await expectHealthy(page, "trimmed game");

  // Starts from the board position, with the other tags kept
  expect(after.tps, "TPS tag is the board position").toBe(exp.tps);
  expect(withoutTPS(after.header), "other tags are kept").toBe(
    withoutTPS(before.header)
  );

  if (exp.toBoard) {
    expect(after.plyCount).toBe(0);
    expect(after.branchKeys.filter(Boolean)).toEqual([]);
    expect(after.position.tps).toBe(exp.tps);
  } else {
    // Every kept line is the tail of a line from before, from the new first
    // ply on, with the same annotations and positions
    const tails = (key) =>
      before.leafData
        .filter(
          (leaf) =>
            leaf.plain.length > exp.prefix.length &&
            exp.prefix.every((tok, i) => leaf.plain[i] === tok) &&
            exp.roots.includes(leaf.plain[exp.prefix.length])
        )
        .map((leaf) => leaf[key].slice(exp.prefix.length).join(SEP))
        .sort();
    expect(after.lines, "kept lines").toEqual(tails("plain"));
    expect(after.annotated, "kept annotations").toEqual(tails("annot"));
    expect(after.tpsLines, "kept positions").toEqual(tails("tps"));
    expect(after.branchLines[""], "main line").toEqual(exp.main);

    // The board is at the start
    expect(after.position.isDone).toBe(false);
    expect(after.position.path.split(SEP)).toHaveLength(1);
    expect(after.position.tps).toBe(exp.tps);
    expect(after.targetBranch).toBe("");
  }

  await expectUndoRedo(page, before, after);
  return after;
}

/** Trim at the current position and check the result */
async function trimHere(page, action = "game/TRIM_TO_PLY") {
  const before = await snapshot(page);
  const exp =
    action === "game/TRIM_TO_BOARD"
      ? { toBoard: true, tps: before.position.tps }
      : await expectation(page);
  expect(await act(page, action)).toBeNull();
  return expectTrim(page, before, exp);
}

/** Put the board done on `doneWhere`, heading for the sibling `target` */
async function goToBefore(page, doneWhere, target) {
  await page.evaluate(
    async ({ doneWhere, target }) => {
      const store = window.app.$store;
      const target_ = window.__probe.findPly(target);
      const done = window.__probe.findPly(doneWhere);
      await store.dispatch("game/SET_TARGET", target_);
      await store.dispatch("game/GO_TO_PLY", { plyID: done.id, isDone: true });
    },
    { doneWhere, target }
  );
  expect(await page.evaluate(() => window.app.$game.board.nextPly.text)).toBe(
    target.text
  );
}

test.describe("TRIM_TO_PLY", () => {
  for (const text of ["Cc3", "d3", "e3", "e2"]) {
    test(`R1: done just before the branch point heading for ${text} keeps every sibling`, async ({
      page,
    }) => {
      await load(page, PTN);
      await goToBefore(page, { text: "d6" }, { number: 4, player: 1, text });
      const fromBefore = await trimHere(page);
      expect(fromBefore.branchLines[""][0]).toBe(text);

      // Same as trimming undone on the sibling itself
      await load(page, PTN);
      await goTo(page, { number: 4, player: 1, text }, false);
      const fromSibling = await trimHere(page);
      expect(fromBefore.ptn).toBe(fromSibling.ptn);
    });
  }

  test("R2: done on a ply in a linear game", async ({ page }) => {
    await load(page, LINEAR);
    await goTo(page, { text: "c4" }, true);
    const after = await trimHere(page);
    expect(after.branchLines[""]).toEqual(["d2", "d6"]);
    expect(after.ptn).toMatch(/\r\n\r\n3\. d2 d6$/);
    expect(
      await page.evaluate(() => [
        window.app.$game.firstMoveNumber,
        window.app.$game.firstPlayer,
      ])
    ).toEqual([3, 1]);
  });

  test("R3: undone on black's ply starts the game with black to move", async ({
    page,
  }) => {
    await load(page, LINEAR);
    await goTo(page, { text: "d6" }, false);
    const after = await trimHere(page);
    expect(after.tps).toMatch(/ 2 3$/);
    expect(after.ptn).toMatch(/\r\n\r\n3\. -- d6$/);
    expect(
      await page.evaluate(() => {
        const ply = window.app.$game.plies[0];
        return [ply.text, ply.player, ply.move.number];
      })
    ).toEqual(["d6", 2, 3]);
  });

  test("R4: undone on a black branch keeps every sibling", async ({ page }) => {
    await load(page, BLACK);
    await goTo(page, { text: "a3" }, false);
    const after = await trimHere(page);
    expect(after.branchLines[""]).toEqual(["a3"]);
    expect(await siblings(page, { text: "a3" })).toEqual(["a3", "b2", "a2"]);
    expect(after.ptn).toMatch(/\r\n\r\n4\. -- a3\r\n/);
    expect(after.ptn).toMatch(/\{4b1\}\n4\. -- b2\r\n5\. d5 b5/);
    expect(after.ptn).toMatch(/\{4b2\}\n4\. -- a2$/);
  });

  test("R5: done on the last ply of the main line trims to the board", async ({
    page,
  }) => {
    await load(page, PTN);
    await goTo(page, { text: "b5" }, true);
    await trimHere(page);
  });

  test("R6: done on the last ply of a branch trims to the board", async ({
    page,
  }) => {
    await load(page, PTN);
    await goTo(page, { text: "a3" }, true);
    await trimHere(page);
  });

  test("R7: undone on the first ply does nothing", async ({ page }) => {
    await load(page, PTN);
    await goTo(page, { text: "a1" }, false);
    const before = await snapshot(page);
    expect(await act(page, "game/TRIM_TO_PLY")).toBeNull();
    await expectUnchanged(page, before);
  });

  test("R8: undone on a branch at the first ply keeps both openings", async ({
    page,
  }) => {
    await load(page, FIRST_W);
    await goTo(page, { text: "c1" }, false);
    // expectTrim compares the board after every ply, so the opening swap
    // (each player places the other's stone first) must survive the TPS
    const after = await trimHere(page);
    expect(after.tps).toBe("x6/x6/x6/x6/x6/x6 1 1");
    expect(await siblings(page, { text: "c1" })).toEqual(["c1", "a1"]);
  });

  test("R9: undone on a depth-2 branch makes its whole chain main", async ({
    page,
  }) => {
    await load(page, NESTED);
    await goTo(page, { text: "f1" }, false);
    const after = await trimHere(page);
    expect(after.branchLines[""]).toEqual(["f1", "f2"]);
    expect(after.branchKeys).toEqual(["", "5w1"]);
    expect(after.branchLines["5w1"]).toEqual(["e1"]);
  });

  test("R10: done inside a depth-2 branch keeps only what follows", async ({
    page,
  }) => {
    await load(page, NESTED);
    await goTo(page, { text: "f1" }, true);
    const after = await trimHere(page);
    expect(after.branchLines[""]).toEqual(["f2"]);
    expect(after.branchKeys).toEqual([""]);
  });

  test("R11: branches that split off earlier are removed", async ({ page }) => {
    await load(page, EARLY);
    await goTo(page, { text: "Cc3" }, true);
    const after = await trimHere(page);
    expect(after.branchKeys).toEqual([""]);
    expect(after.branchLines[""]).toEqual(["b2", "d5", "b5"]);
  });

  test("R12: earlier branches go, the move-4 siblings stay", async ({
    page,
  }) => {
    await load(page, EARLY);
    await goTo(page, { number: 4, text: "e3" }, false);
    const after = await trimHere(page);
    expect(after.branchLines[""]).toEqual(["e3", "a3"]);
    expect(await siblings(page, { text: "e3" })).toEqual([
      "e3",
      "Cc3",
      "d3",
      "e2",
    ]);
  });

  test("R13: later branch points are kept and renamed", async ({ page }) => {
    await load(page, LATER);
    await goTo(page, { text: "e3" }, false);
    const after = await trimHere(page);
    expect(after.branchLines[""]).toEqual(["e3", "a3", "f1"]);
    expect(after.branchKeys).toEqual([
      "",
      "4w1",
      "4w1/5w1",
      "4w2",
      "4w3",
      "5w1",
    ]);
    expect(after.branchLines["5w1"]).toEqual(["f5", "f4"]);
    expect(after.branchLines["4w1"]).toEqual(["Cc3", "b2", "d5", "b5"]);
    expect(after.branchLines["4w1/5w1"]).toEqual(["a5"]);
  });

  test("R14: trimming a trimmed game continues the move numbers", async ({
    page,
  }) => {
    await load(page, PTN);
    const original = await snapshot(page);
    await goTo(page, { text: "Cc3" }, true);
    await trimHere(page);
    await goTo(page, { text: "d5" }, true);
    const after = await trimHere(page);
    expect(after.branchLines[""]).toEqual(["b5"]);
    expect(after.ptn).toMatch(/\r\n\r\n5\. -- b5$/);

    // Two UNDOs restore the original
    expect(await act(page, "game/UNDO")).toBeNull();
    expect(await act(page, "game/UNDO")).toBeNull();
    expect((await snapshot(page)).ptn).toBe(original.ptn);
  });

  test("R15: notes on removed plies go, notes on kept plies follow", async ({
    page,
  }) => {
    await load(
      page,
      PTN.replace("2. d4 c4", "2. d4 {removed} c4")
        .replace("4. e3 a3", "4. e3 {on e3} a3 {on a3}")
        .replace("4. d3 a2", "4. d3 {on d3} a2")
        .replace("5. d5 b5", "5. d5 {on d5} b5")
    );
    await goTo(page, { text: "e3" }, false);
    const after = await trimHere(page);
    expect(after.ptn).not.toContain("removed");
    for (const note of ["on e3", "on a3", "on d3", "on d5"]) {
      expect(after.ptn).toContain(`{${note}}`);
    }
  });

  const PRE_GAME = PTN.replace("1. a1 f6", "{before the game}\n\n1. a1 f6");

  test("R16: a comment before the first move is kept", async ({ page }) => {
    await load(page, PRE_GAME);
    expect((await snapshot(page)).preNotes).toEqual(["before the game"]);
    await goTo(page, { text: "Cc3" }, true);
    const after = await trimHere(page);
    expect(after.preNotes).toEqual(["before the game"]);
  });

  test("R16: a comment before the first move survives trimming to a branch", async ({
    page,
  }) => {
    await load(page, PRE_GAME);
    await goTo(page, { text: "e3" }, false);
    const after = await trimHere(page);
    expect(after.preNotes).toEqual(["before the game"]);
  });

  test("R17: eval and tak marks on kept plies are kept", async ({ page }) => {
    await load(
      page,
      PTN.replace("4. Cc3 b2", "4. Cc3' b2?")
        .replace("4. e3 a3", "4. e3!! a3?!")
        .replace("2. d4 c4", "2. d4! c4")
    );
    await goTo(page, { text: "e3" }, false);
    const after = await trimHere(page);
    expect(after.ptn).toContain("4. e3!! a3?!");
    expect(after.ptn).toContain("4. Cc3' b2?");
    expect(after.ptn).not.toContain("d4!");
  });

  for (const [label, where, isDone] of [
    ["kept", { text: "Cc3" }, true],
    ["removed", { text: "d3" }, true],
  ]) {
    test(`R17: the Result tag is kept when the result ply is ${label}`, async ({
      page,
    }) => {
      await load(
        page,
        PTN.replace('[Size "6"]', '[Size "6"]\n[Result "1-0"]').replace(
          "5. d5 b5",
          "5. d5 b5 1-0"
        )
      );
      await goTo(page, where, isDone);
      // Documents current behaviour: the Result tag is kept even when the
      // ply that carried the result is trimmed away
      const after = await trimHere(page);
      expect(after.header).toContain('[Result "1-0"]');
      expect(after.ptn.includes("b5 1-0")).toBe(label === "kept");
    });
  }

  test("R18: after five edits, history stays at five entries", async ({
    page,
  }) => {
    await load(page, LINEAR);
    await goTo(page, { text: "d6" }, true);
    for (const ply of ["e1", "e2", "e3", "e4", "e5"]) {
      expect(await act(page, "game/INSERT_PLY", ply)).toBeNull();
    }
    expect((await snapshot(page)).historyIndex).toBe(5);
    await goTo(page, { text: "d2" }, false);
    const after = await trimHere(page);
    expect(after.historyIndex).toBe(5);
    expect(after.historyLength).toBe(5);
  });

  test("R19: refused while a synced PlayTak main line is protected", async ({
    page,
  }) => {
    await load(page, PTN);
    await setProtectedMainline(page, 6);
    await goTo(page, { text: "e3" }, false);
    const before = await snapshot(page);
    expect(await act(page, "game/TRIM_TO_PLY")).toBeNull();
    await expectUnchanged(page, before);
    // R26: so is trimming to the board
    expect(await act(page, "game/TRIM_TO_BOARD")).toBeNull();
    await expectUnchanged(page, before);
  });

  test.fixme(
    "R19: the trim menu items are disabled once the main line is protected",
    async ({ page }) => {
      // BUG: canTrimToPly and canTrimToBoard read only Vue.prototype.$game,
      // which isn't reactive, so Vuex caches their first value and the PTN
      // tools menu keeps offering trims for a followed PlayTak game. (The
      // actions still refuse.) canEditCurrentPTN had the same bug and now
      // reads state.config first.
      await load(page, PTN);
      const getters = () =>
        page.evaluate(() => [
          window.app.$store.getters["game/canTrimToPly"],
          window.app.$store.getters["game/canTrimToBoard"],
        ]);
      expect(await getters()).toEqual([true, true]);
      await setProtectedMainline(page, 6);
      expect(await getters()).toEqual([false, false]);
    }
  );

  test("R22: double black stack opening", async ({ page }) => {
    const dbs = LINEAR.replace(
      '[Size "6"]',
      '[Size "6"]\n[Opening "double black stack"]'
    );
    await load(page, dbs);
    // Undone on the first ply: nothing to trim
    await goTo(page, { text: "a1" }, false);
    const start = await snapshot(page);
    expect(await act(page, "game/TRIM_TO_PLY")).toBeNull();
    await expectUnchanged(page, start);

    // After move 1: the TPS has the double stack, and every later position
    // matches (checked by expectTrim)
    await goTo(page, { text: "f6" }, true);
    const after = await trimHere(page);
    expect(after.branchLines[""]).toEqual(["d4", "c4", "d2", "d6"]);
  });

  test("R23: trim, undo, then trim at another sibling", async ({ page }) => {
    await load(page, PTN);
    await goTo(page, { text: "e3" }, false);
    await trimHere(page);
    expect(await act(page, "game/UNDO")).toBeNull();
    await goTo(page, { text: "e2" }, false);
    const second = await trimHere(page);

    await load(page, PTN);
    await goTo(page, { text: "e2" }, false);
    const fresh = await trimHere(page);
    expect(second.ptn).toBe(fresh.ptn);
    expect(second.branchKeys).toEqual(fresh.branchKeys);
  });

  test("R24: the embed API trims the same way", async ({ page }) => {
    await load(page, PTN);
    await goTo(page, { text: "e3" }, false);
    const fromStore = await trimHere(page);

    await load(page, PTN);
    await goTo(page, { text: "e3" }, false);
    const before = await snapshot(page);
    const exp = await expectation(page);
    await page.evaluate(() => {
      // App.vue ignores messages from its own window, as embeds post from
      // the parent page
      window.dispatchEvent(
        new MessageEvent("message", { data: { action: "TRIM_TO_PLY" } })
      );
    });
    await page.waitForFunction(
      (ptn) => window.app.$game.ptn !== ptn,
      before.ptn
    );
    await page.waitForFunction(
      () => window.app.$store.state.ui.animateBoard === true
    );
    const fromEmbed = await expectTrim(page, before, exp);
    expect(fromEmbed.ptn).toBe(fromStore.ptn);
  });
});

test.describe("TRIM_TO_BOARD", () => {
  test("R25: on the main line, done", async ({ page }) => {
    await load(page, PTN);
    await goTo(page, { text: "Cc3" }, true);
    const tps = (await snapshot(page)).position.tps;
    const after = await trimHere(page, "game/TRIM_TO_BOARD");
    expect(after.tps).toBe(tps);
    // Only the tags and an empty move for black's turn are left
    expect(after.ptn).toBe(`${after.header}4.`);
    expect(after.header).toContain(`[TPS "${tps}"]`);
  });

  test("R26: on a branch, undone", async ({ page }) => {
    await load(page, PTN);
    await goTo(page, { text: "e3" }, false);
    const tps = (await snapshot(page)).position.tps;
    const after = await trimHere(page, "game/TRIM_TO_BOARD");
    // The position before e3
    expect(after.tps).toBe(tps);
    expect(tps).toMatch(/ 1 4$/);
  });
});

test.describe("TRIM_BRANCHES", () => {
  /** Trim branches and check only the board's line is left */
  async function trimBranches(page) {
    const before = await snapshot(page);
    const line = before.leafData.find((leaf) =>
      leaf.plain.join(SEP).startsWith(before.position.path)
    );
    expect(await act(page, "game/TRIM_BRANCHES")).toBeNull();
    const after = await snapshot(page);
    expect(after.historyIndex).toBe(before.historyIndex + 1);
    await expectHealthy(page, "trimmed game");
    expect(after.branchKeys).toEqual([""]);
    expect(after.lines).toEqual([line.plain.join(SEP)]);
    expect(after.annotated).toEqual([line.annot.join(SEP)]);
    expect(after.tps).toBe(before.tps);
    expect(after.targetBranch).toBe("");
    await expectUndoRedo(page, before, after);
    return after;
  }

  test("R27: with the board on the main line", async ({ page }) => {
    await load(page, PTN.replace("4. Cc3 b2", "4. Cc3 {kept} b2"));
    await goTo(page, { text: "Cc3" }, true);
    const before = await snapshot(page);
    const after = await trimBranches(page);
    expect(after.branchLines[""]).toEqual(before.branchLines[""]);
    expect(after.position).toEqual(before.position);
    expect(after.ptn).toContain("{kept}");
  });

  test("R27: a game with no branches is left alone", async ({ page }) => {
    await load(page, LINEAR);
    const before = await snapshot(page);
    expect(await act(page, "game/TRIM_BRANCHES")).toBeNull();
    await expectUnchanged(page, before);
  });

  test("R28: with the board on a nested branch, keeps that line", async ({
    page,
  }) => {
    await load(page, NESTED.replace("5. f1 f2", "5. f1 {kept} f2"));
    await goToBranchEnd(page, "4w1/5w1");
    const before = await snapshot(page);
    // Documents current behaviour: the board's line becomes the only line
    const after = await trimBranches(page);
    expect(after.branchLines[""]).toEqual([
      "a1",
      "f6",
      "d4",
      "c4",
      "d2",
      "d6",
      "d3",
      "a2",
      "f1",
      "f2",
    ]);
    expect(after.position).toEqual(before.position);
    expect(after.ptn).toContain("{kept}");
    expect(await branchKeys(page)).toEqual([""]);
    expect(await branchLine(page, "")).toEqual(after.branchLines[""]);
  });
});
