// @ts-check
/**
 * Shared helpers for the branch promotion and trim specs.
 *
 * Everything that touches the game runs in the page against window.app (the
 * root Vue instance) and window.Game, which App.vue exposes in dev builds.
 * Edits go through the same store actions the UI dispatches.
 */
const { test: base, expect, devices } = require("@playwright/test");

// Page errors that come from the dev environment rather than the code under
// test. "Game not found" is raised by the persistence layer when the game
// list and IndexedDB disagree about a name.
const IGNORED_PAGE_ERRORS = [/Game not found/];

/** Open the app and wait until the store and a game exist */
async function openApp(page) {
  await page.goto("/");
  await page.waitForFunction(
    () => window.app && window.app.$store && window.app.$game,
    null,
    { timeout: 30000 }
  );
  await installProbe(page);
}

/**
 * A Playwright `test` whose `page` is shared by every test in a worker, so
 * each test pays for loading a game rather than for loading the app. Each
 * test still starts from a fresh game (loadPTN adds a new one). Playwright
 * replaces the worker after a failure, so a broken page never leaks into the
 * next test.
 *
 * `pageErrors` collects uncaught page errors for the test. Unless the test
 * empties it, any error fails the test.
 */
const test = base.extend({
  sharedPage: [
    async ({ browser }, use, workerInfo) => {
      const context = await browser.newContext({
        ...devices["Desktop Chrome"],
        baseURL: workerInfo.project.use.baseURL,
      });
      const page = await context.newPage();
      await openApp(page);
      await use(page);
      await context.close();
    },
    { scope: "worker" },
  ],
  page: async ({ sharedPage }, use) => {
    await use(sharedPage);
  },
  pageErrors: [
    async ({ page }, use) => {
      const errors = [];
      const onError = (error) => {
        if (!IGNORED_PAGE_ERRORS.some((re) => re.test(error.message))) {
          errors.push(error.message);
        }
      };
      page.on("pageerror", onError);
      await use(errors);
      page.off("pageerror", onError);
      expect(errors, "uncaught page errors").toEqual([]);
    },
    { auto: true },
  ],
});

/**
 * Install window.__probe, the in-page inspection functions. Idempotent; call
 * again after a reload.
 */
async function installProbe(page) {
  await page.evaluate(`(${probe.toString()})()`);
}

/* eslint-disable no-undef */
/** Runs in the page. Defines window.__probe. */
function probe() {
  const game = () => window.app.$game;
  const store = () => window.app.$store;
  const color = (ply) => (ply.player === 1 ? "w" : "b");
  const SEP = " | ";

  // A ply's identity on its line: move number, colour and move text
  const tok = (ply) => `${ply.move.number}${color(ply)}:${ply.text}`;

  // The ply plus its annotations: eval marks, result and notes
  const annot = (ply) => {
    const notes = (game().notes[ply.id] || [])
      .map((note) => note.message)
      .join("|");
    const marks =
      (ply.evaluation ? ply.evaluation.text : "") +
      (ply.result ? " " + ply.result.text : "");
    return `${tok(ply)}${marks}${notes ? `{${notes}}` : ""}`;
  };

  // Root to `ply`, as tokens
  const pathTokens = (ply, fn = tok) => {
    const out = [];
    for (let p = ply; p; p = p.parent) {
      out.unshift(fn(p));
    }
    return out;
  };
  const path = (ply, fn = tok) => pathTokens(ply, fn).join(SEP);

  const leaves = () =>
    game().plies.filter((ply) => ply && !ply.children.length);

  // A branch point is identified by the line leading to it and its move, so
  // the key survives renames and changes of which sibling is primary
  const branchPointKey = (ply) =>
    `${ply.parent ? path(ply.parent) : ""} > ${ply.move.number}${color(ply)}`;

  const findPly = ({ branch, text, number, player }) => {
    const matches = game().plies.filter(
      (ply) =>
        ply &&
        (branch === undefined || ply.branch === branch) &&
        (text === undefined || ply.text === text) &&
        (number === undefined || ply.move.number === number) &&
        (player === undefined || ply.player === player)
    );
    if (matches.length !== 1) {
      throw new Error(
        `Expected one ply matching ${JSON.stringify({
          branch,
          text,
          number,
          player,
        })}, found ${matches.length}`
      );
    }
    return matches[0];
  };

  const branchLine = (branch) =>
    game()
      .plies.filter((ply) => ply && ply.branch === branch)
      .sort((a, b) => a.index - b.index)
      .map((ply) => ply.text);

  const snapshot = () => {
    const g = game();
    const s = store();
    const ply = g.board.ply;
    const overrides = {};
    const rawOverrides =
      (s.state.game.ptnUI && s.state.game.ptnUI.branchPointOverrides) || {};
    Object.keys(rawOverrides).forEach((id) => {
      const bp = g.plies[id];
      overrides[bp ? branchPointKey(bp) : `missing ply ${id}`] =
        rawOverrides[id];
    });
    const branchLines = {};
    Object.keys(g.branches).forEach((name) => {
      branchLines[name] = branchLine(name);
    });

    // Board position after each ply, from a scratch copy of the game so the
    // live board doesn't move
    const tpsByLine = {};
    try {
      const scratch = new window.Game({ ptn: g.ptn, state: { plyIndex: 0 } });
      scratch.plies
        .filter((ply) => ply && !ply.children.length)
        .forEach((leaf) => {
          scratch.board.goToPly(leaf.id, true);
          tpsByLine[path(leaf)] = pathTokens(
            leaf,
            (ply) => `${tok(ply)}@${ply.tpsAfter}`
          );
        });
    } catch (error) {
      // Reported by problems()
    }
    const leafData = leaves().map((leaf) => ({
      plain: pathTokens(leaf),
      annot: pathTokens(leaf, annot),
      tps: tpsByLine[path(leaf)] || null,
    }));
    const sorted = (key) =>
      leafData.map((leaf) => (leaf[key] || []).join(SEP)).sort();
    return {
      ptn: g.ptn,
      historyIndex: g.historyIndex,
      historyLength: g.history.length,
      header: g.headerText(),
      tps: g.tag("tps") || null,
      preNotes: (g.notes[-1] || []).map((note) => note.message),
      branchKeys: Object.keys(g.branches).sort(),
      branchLines,
      lines: sorted("plain"),
      annotated: sorted("annot"),
      tpsLines: sorted("tps"),
      leafData,
      plyCount: g.plies.length,
      overrides,
      position: {
        path: ply ? path(ply) : null,
        isDone: g.board.plyIsDone,
        tps: g.board.tps,
      },
      targetBranch: g.board.targetBranch,
      minState: g.minState,
    };
  };

  // Every structural problem found in the current game, as messages
  const problems = () => {
    const g = game();
    const out = [];

    // Plies and moves
    g.plies.forEach((ply, i) => {
      if (!ply) {
        out.push(`null ply at ${i}`);
      } else if (ply.id !== i) {
        out.push(`ply at ${i} has id ${ply.id}`);
      }
    });
    if (g.moves.some((move) => !move || move.plies.some((ply) => !ply))) {
      out.push("null hole in moves");
    }
    try {
      const plies = g.board.output.ptn.allPlies;
      g.moves.forEach((move) => move.output(plies));
    } catch (error) {
      out.push(`move output: ${error.message}`);
    }
    if (out.length) {
      return out;
    }

    // Branch names: unique, one line each
    const keys = Object.keys(g.branches);
    const used = new Set(g.plies.map((ply) => ply.branch));
    keys.forEach((key) => {
      const root = g.branches[key];
      if (!root || root.branch !== key) {
        out.push(`branches["${key}"] points at a ply on another branch`);
      }
    });
    used.forEach((name) => {
      if (!(name in g.branches)) {
        out.push(`branch "${name}" is missing from game.branches`);
      }
      const roots = g.plies.filter(
        (ply) =>
          ply.branch === name && (!ply.parent || ply.parent.branch !== name)
      );
      if (roots.length !== 1) {
        out.push(
          `branch "${name}" has ${roots.length} starts: ${roots
            .map((ply) => path(ply))
            .join(" ; ")}`
        );
      }
    });
    if (g.branches[""] && g.branches[""].parent) {
      out.push("main line does not start at the root");
    }

    // Branch points: well-formed siblings
    g.plies.forEach((ply) => {
      if (!(ply.branches.length > 1) || ply.branches[0] !== ply) {
        return;
      }
      const texts = new Set();
      ply.branches.forEach((sibling, i) => {
        const where = `sibling "${sibling.branch}" (${tok(sibling)}) of ${tok(
          ply
        )}`;
        if (sibling.branches !== ply.branches) {
          out.push(`${where} has a different siblings list`);
        }
        if (sibling.parent !== ply.parent) {
          out.push(`${where} has a different parent`);
        }
        if (
          sibling.move.number !== ply.move.number ||
          sibling.player !== ply.player
        ) {
          out.push(`${where} is on a different move`);
        }
        if (texts.has(sibling.text)) {
          out.push(`${where} duplicates another sibling`);
        }
        texts.add(sibling.text);
        if (i === 0) {
          return;
        }
        const name = sibling.branch;
        const slash = name.lastIndexOf("/");
        const parent = slash >= 0 ? name.slice(0, slash) : "";
        const leaf = name.slice(slash + 1);
        if (!name) {
          out.push(`${where} is unnamed`);
        } else if (parent !== ply.branch) {
          out.push(`${where} is not named under "${ply.branch}"`);
        }
        if (/^\d+[wb]\d+$/.test(leaf)) {
          const prefix = `${sibling.move.number}${color(sibling)}`;
          if (
            !leaf.startsWith(prefix) ||
            !/^\d+$/.test(leaf.slice(prefix.length))
          ) {
            out.push(`${where} has a default name for another move`);
          }
        }
        if (!g.branches[name] || g.branches[name] !== sibling) {
          out.push(`${where} is not the start of its branch`);
        }
      });
    });
    keys
      .filter((key) => key)
      .forEach((key) => {
        const root = g.branches[key];
        if (root && !(root.branches.indexOf(root) > 0)) {
          out.push(`branch "${key}" does not start at a branch point`);
        }
      });

    // Rendering: a move shows "--" for white only where white has no ply
    g.moves.forEach((move) => {
      const [ply1, ply2] = move.plies;
      if (!ply1 || !ply1.isNop || !ply2 || ply2.isNop) {
        return;
      }
      const white = ply2.parent;
      if (!white) {
        // Only a game that starts with black to move has no white ply
        if (!(g.firstPlayer === 2 && move.number === g.firstMoveNumber)) {
          out.push(`"${move.number}. -- ${ply2.text}" has no white ply`);
        }
        return;
      }
      const shown = move.ply1Original;
      if (!shown || shown.isNop || shown.text !== white.text) {
        out.push(
          `"${move.number}. -- ${ply2.text}" on "${move.branch}" renders ${
            shown ? shown.text : "--"
          } for white's ${white.text}`
        );
      }
    });

    // Board
    if (g.plies.length && !g.board.ply) {
      out.push("board has no ply");
    }
    if (!(g.board.targetBranch in g.branches) && g.board.targetBranch !== "") {
      out.push(`targetBranch "${g.board.targetBranch}" does not exist`);
    } else if (
      g.board.ply &&
      g.board.targetBranch &&
      !g.board.ply.isInBranch(g.board.targetBranch)
    ) {
      out.push(
        `targetBranch "${g.board.targetBranch}" does not lead through the board's ply`
      );
    }

    // Round trip. Game.validate swallows constructor throws, so parse
    // separately and treat any throw or warning as a failure.
    let reparsed = null;
    try {
      reparsed = new window.Game({ ptn: g.ptn });
    } catch (error) {
      out.push(`reparse threw: ${error.message}`);
    }
    if (reparsed) {
      if (reparsed.warnings.length) {
        out.push(`reparse warnings: ${reparsed.warnings.join("; ")}`);
      }
      if (reparsed.ptn !== g.ptn) {
        out.push("reparsed PTN differs");
      }
      const reparsedKeys = Object.keys(reparsed.branches).sort().join(",");
      if (reparsedKeys !== keys.concat().sort().join(",")) {
        out.push(`reparsed branch keys differ: ${reparsedKeys}`);
      }
    }
    if (g.toString({ skipCache: true }) !== g.ptn) {
      out.push("game.ptn is stale");
    }
    const valid = window.Game.validate(g.ptn, true);
    if (valid !== true) {
      out.push(`Game.validate: ${valid}`);
    }
    return out;
  };

  window.__probe = {
    SEP,
    tok,
    path,
    pathTokens,
    annot,
    findPly,
    branchLine,
    branchPointKey,
    snapshot,
    problems,
  };
}
/* eslint-enable no-undef */

/**
 * Load a PTN as a new game. By default shows all branches and expands every
 * branch point, as the existing specs do. Pass showAllBranches: null to leave
 * that setting alone.
 */
async function loadPTN(
  page,
  ptn,
  { expandAll = true, showAllBranches = true, name = "Test Game", config } = {}
) {
  if (!(await page.evaluate(() => Boolean(window.__probe)))) {
    await installProbe(page);
  }
  const loaded = await page.evaluate(
    async ({ ptn, name, config }) => {
      const before = window.app.$game;
      await window.app.$store.dispatch("game/ADD_GAME", {
        ptn,
        name,
        ...(config ? { config } : {}),
      });
      return window.app.$game !== before;
    },
    { ptn, name, config }
  );
  expect(loaded, "ADD_GAME replaced the current game").toBe(true);
  await settled(page);

  await page.evaluate(
    async ({ expandAll, showAllBranches }) => {
      const store = window.app.$store;
      const game = window.app.$game;
      if (showAllBranches !== null) {
        await store.dispatch("ui/SET_UI", ["showAllBranches", showAllBranches]);
      }
      if (expandAll) {
        const overrides = {};
        game.plies
          .filter((ply) => ply && ply.branches.length > 1)
          .forEach((ply) => (overrides[ply.id] = true));
        await store.dispatch("game/SET_BRANCH_POINT_OVERRIDES", overrides);
      }
    },
    { expandAll, showAllBranches }
  );
  await settled(page);
}

/**
 * Wait for edits wrapped in ui/WITHOUT_BOARD_ANIM (trim, undo, redo, load) to
 * finish. They commit on the next tick and turn board animation back on once
 * done, so wait for that rather than a fixed time.
 */
async function settled(page) {
  await page.waitForFunction(
    () => window.app.$store.state.ui.animateBoard === true
  );
}

/**
 * Dispatch a store action as the UI does and wait for it to settle. Returns
 * the error message if the dispatch threw synchronously, or null.
 */
async function act(page, action, payload) {
  const error = await page.evaluate(
    async ({ action, payload }) => {
      try {
        await window.app.$store.dispatch(action, payload);
        return null;
      } catch (error) {
        return String((error && error.message) || error);
      }
    },
    { action, payload }
  );
  await settled(page);
  return error;
}

/** See probe().snapshot */
async function snapshot(page) {
  return page.evaluate(() => window.__probe.snapshot());
}

/** Every structural problem in the current game; see probe().problems */
async function problems(page) {
  return page.evaluate(() => window.__probe.problems());
}

async function expectHealthy(page, label = "game") {
  expect(await problems(page), `${label} is healthy`).toEqual([]);
  expect(
    await page.evaluate(() => window.app.$store.state.ui.animateBoard),
    "board animation restored"
  ).toBe(true);
}

/** Text of a branch's own plies, in order */
async function branchLine(page, branch) {
  return page.evaluate((branch) => window.__probe.branchLine(branch), branch);
}

async function branchKeys(page) {
  return page.evaluate(() => Object.keys(window.app.$game.branches).sort());
}

/** The branch name of the ply matching `where` */
async function branchOf(page, where) {
  return page.evaluate((where) => window.__probe.findPly(where).branch, where);
}

/** Move text of each sibling at the branch point of the ply matching `where` */
async function siblings(page, where) {
  return page.evaluate((where) => {
    const ply = window.__probe.findPly(where);
    return (ply.branches.length ? ply.branches : [ply]).map((p) => p.text);
  }, where);
}

/**
 * Put the board on the ply matching `where` ({branch, text, number,
 * player}), following its branch, done or undone
 */
async function goTo(page, where, isDone = true) {
  await page.evaluate(
    async ({ where, isDone }) => {
      const store = window.app.$store;
      const ply = window.__probe.findPly(where);
      await store.dispatch("game/SET_TARGET", ply);
      await store.dispatch("game/GO_TO_PLY", { plyID: ply.id, isDone });
    },
    { where, isDone }
  );
  await settled(page);
}

/** Put the board at the end of a branch */
async function goToBranchEnd(page, branch) {
  await page.evaluate(async (branch) => {
    const store = window.app.$store;
    const start = window.app.$game.branches[branch];
    if (!start) {
      throw new Error("Missing branch: " + branch);
    }
    await store.dispatch("game/SET_TARGET", start);
    await store.dispatch("game/LAST");
  }, branch);
  await settled(page);
}

/** Set an explicit expanded (true) or collapsed (false) state */
async function setBranchPointOverrides(page, entries) {
  await page.evaluate(async (entries) => {
    const store = window.app.$store;
    const overrides = {};
    entries.forEach(({ where, value }) => {
      overrides[window.__probe.findPly(where).branches[0].id] = value;
    });
    await store.dispatch("game/SET_BRANCH_POINT_OVERRIDES", overrides);
  }, entries);
}

/**
 * Make the first `count` main-line plies a synced PlayTak main line, as a
 * followed live game does
 */
async function setProtectedMainline(page, count, playtakID = "123456") {
  await page.evaluate(
    ({ count, playtakID }) => {
      window.app.$store.commit("game/SET_PLAYTAK_LIVE_CONFIG", {
        playtakID,
        syncedMainlineCount: count,
      });
    },
    { count, playtakID }
  );
}

/**
 * UNDO restores `before` exactly (PTN, position, branch point overrides),
 * then REDO restores `after` exactly. Leaves the game in the `after` state.
 */
async function expectUndoRedo(page, before, after, { overrides = false } = {}) {
  expect(await act(page, "game/UNDO")).toBeNull();
  const undone = await snapshot(page);
  expect(undone.ptn, "UNDO restores the PTN").toBe(before.ptn);
  // History keeps 5 entries, so undoing from a full history lands one lower
  expect(undone.historyIndex, "UNDO steps back one history entry").toBe(
    after.historyIndex - 1
  );
  expect(undone.position, "UNDO restores the position").toEqual(
    before.position
  );
  if (overrides) {
    expect(undone.overrides, "UNDO restores branch point overrides").toEqual(
      before.overrides
    );
  }
  await expectHealthy(page, "undone game");

  expect(await act(page, "game/REDO")).toBeNull();
  const redone = await snapshot(page);
  expect(redone.ptn, "REDO restores the PTN").toBe(after.ptn);
  expect(redone.historyIndex, "REDO restores the history index").toBe(
    after.historyIndex
  );
  await expectHealthy(page, "redone game");
}

/**
 * Invariants for an edit that only reorders lines (promotion, make-main):
 * - it made one history entry
 * - every root-to-leaf line has the same plies, with the same eval marks,
 *   results and notes
 * - the game is healthy (see probe().problems)
 * - the board is on the same ply of the same line, in the same state
 * - UNDO and REDO restore the exact PTN
 * Returns the snapshot taken after the edit.
 */
async function expectInvariants(
  page,
  before,
  { position = true, overrides = false } = {}
) {
  const after = await snapshot(page);
  expect(after.ptn, "the edit changed the PTN").not.toBe(before.ptn);
  expect(after.historyIndex, "one history entry").toBe(
    Math.min(before.historyIndex + 1, 5)
  );
  expect(after.lines, "every line keeps its plies").toEqual(before.lines);
  expect(after.annotated, "annotations stay on their plies").toEqual(
    before.annotated
  );
  expect(after.preNotes, "comments before the first move are kept").toEqual(
    before.preNotes
  );
  expect(after.header, "tags are unchanged").toBe(before.header);
  await expectHealthy(page, "edited game");
  if (position) {
    expect(after.position, "the board stays on the same ply").toEqual(
      before.position
    );
  }
  await expectUndoRedo(page, before, after, { overrides });
  return after;
}

/** The edit was refused or was a no-op: nothing changed, no history entry */
async function expectUnchanged(page, before) {
  const after = await snapshot(page);
  expect(after.ptn).toBe(before.ptn);
  expect(after.historyIndex).toBe(before.historyIndex);
  expect(after.historyLength).toBe(before.historyLength);
  expect(after.position).toEqual(before.position);
  await expectHealthy(page);
}

// Separates the plies in snapshot lines
const SEP = " | ";

module.exports = {
  SEP,
  test,
  expect,
  openApp,
  installProbe,
  loadPTN,
  settled,
  act,
  snapshot,
  problems,
  expectHealthy,
  branchLine,
  branchKeys,
  branchOf,
  siblings,
  goTo,
  goToBranchEnd,
  setBranchPointOverrides,
  setProtectedMainline,
  expectUndoRedo,
  expectInvariants,
  expectUnchanged,
  IGNORED_PAGE_ERRORS,
};
