// @ts-check
/**
 * Renaming the engine of saved results.
 *
 * Saved analysis lives in notes as name:"..." tokens. Renaming an engine's
 * saved results rewrites those tokens in the current game as one undoable
 * change, through the store action the Saved Results panel uses.
 */
const {
  test,
  expect,
  loadPTN,
  act,
  snapshot,
  expectHealthy,
  expectUndoRedo,
} = require("./helpers");

const RENAME = "game/RENAME_BOT_ANALYSIS_NOTES";

// Ply IDs: a6 = 0, f1 = 1, f4 = 2, d4 = 3
//   Tiltak: plies 0, 1, 3 (3 positions)
//   Topaz:  plies 0, 2
//   Other (unnamed analysis): plies 1, 3
// Plus a user note that mentions name:"Tiltak" and a plain comment.
const PTN = `[Size "6"]
[Komi "2"]

1. a6 {name:"Tiltak" +0.2/12 1000 nodes 10ms pv> f6 d4} {name:"Topaz" +0.1/8 2000 nodes 20ms pv> a1 d2} {*name:"Tiltak" is my favourite +0.5} f1 {name:"Tiltak" +0.3/13 1100 nodes 11ms pv> e4 d3} {+0.4/9 3000 nodes 30ms pv> e4 d3}
2. f4 {name:"Topaz" +0.01/10 2100 nodes 21ms pv> e5 f5} {A plain comment} d4 {name:"Tiltak" +0.25/13 1200 nodes 12ms pv> f3 d3} {+0.15/9 3100 nodes 31ms pv> e4 d5}
`;

/** Every note, as { plyID: [{ message, botName }] } */
async function notes(page) {
  return page.evaluate(() => {
    const out = {};
    const all = window.app.$game.notes;
    Object.keys(all).forEach((id) => {
      out[id] = all[id].map((note) => ({
        message: note.message,
        botName: note.botName,
      }));
    });
    return out;
  });
}

/** Notes from `name` (null for unnamed analysis), as { plyID: count } */
function countByPly(all, name) {
  const out = {};
  Object.keys(all).forEach((id) => {
    const n = all[id].filter((note) =>
      name === null
        ? !note.botName && /pv>/.test(note.message) && note.message[0] !== "*"
        : note.botName === name
    ).length;
    if (n) {
      out[id] = n;
    }
  });
  return out;
}

async function savedBotNames(page) {
  return page.evaluate(() =>
    window.app.$store.getters["analysis/savedBotNames"].slice()
  );
}

/** Bot names grouped from a fresh parse of the current PTN */
async function reparsedGroups(page) {
  return page.evaluate(() => {
    const game = new window.Game({ ptn: window.app.$game.ptn });
    const groups = {};
    Object.keys(game.notes).forEach((id) => {
      game.notes[id].forEach((note) => {
        if (note.evaluation === null && note.pvAfter === null) {
          return;
        }
        const key = note.botName || "(other)";
        groups[key] = (groups[key] || []).concat(Number(id));
      });
    });
    return groups;
  });
}

async function rename(page, oldName, newName) {
  return page.evaluate(
    ({ action, oldName, newName }) =>
      window.app.$store.dispatch(action, { oldName, newName }),
    { action: RENAME, oldName, newName }
  );
}

/**
 * Messages of every note except the analysis notes of the `changing` engine
 * names (null for unnamed analysis)
 */
function bystanders(all, changing) {
  const out = [];
  Object.keys(all).forEach((id) => {
    all[id].forEach((note) => {
      const isAnalysis = note.message[0] !== "*" && /pv>/.test(note.message);
      if (!isAnalysis || !changing.includes(note.botName || null)) {
        out.push(`${id}:${note.message}`);
      }
    });
  });
  return out;
}

test.describe("Rename saved results", () => {
  test.beforeEach(async ({ page }) => {
    await loadPTN(page, PTN);
  });

  test("renames an engine as one undoable change", async ({ page }) => {
    const before = await snapshot(page);
    const notesBefore = await notes(page);

    expect(await rename(page, "Tiltak", "Stockfish")).toBe(true);
    const after = await snapshot(page);
    const notesAfter = await notes(page);

    expect(after.historyIndex, "one history entry").toBe(
      before.historyIndex + 1
    );
    expect(countByPly(notesAfter, "Stockfish")).toEqual({ 0: 1, 1: 1, 3: 1 });
    expect(countByPly(notesAfter, "Tiltak")).toEqual({});
    expect(notesAfter[0][0].message).toBe(
      'name:"Stockfish" +0.2/12 1000 nodes 10ms pv> f6 d4'
    );

    // Other engines' notes, unnamed analysis, user notes and plain comments
    // are untouched
    expect(bystanders(notesAfter, ["Stockfish"])).toEqual(
      bystanders(notesBefore, ["Tiltak"])
    );
    expect(notesAfter[0][2].message).toBe(
      '*name:"Tiltak" is my favourite +0.5'
    );

    expect(await savedBotNames(page)).toEqual(
      expect.arrayContaining(["Stockfish", "Topaz", null])
    );
    expect(await savedBotNames(page)).not.toContain("Tiltak");
    expect(await reparsedGroups(page)).toEqual({
      Stockfish: [0, 1, 3],
      Topaz: [0, 2],
      "(other)": [1, 3],
    });
    await expectHealthy(page);

    await expectUndoRedo(page, before, after);
  });

  test("merges into an engine that already has results, keeping every note", async ({
    page,
  }) => {
    await page.evaluate(() =>
      window.app.$store.commit("analysis/SET", ["pvsToSave", 1])
    );
    const before = await snapshot(page);
    const notesBefore = await notes(page);

    expect(await rename(page, "Tiltak", "Topaz")).toBe(true);
    const after = await snapshot(page);
    const notesAfter = await notes(page);

    // Ply 0 now carries two Topaz notes despite pvsToSave = 1
    expect(countByPly(notesAfter, "Topaz")).toEqual({ 0: 2, 1: 1, 2: 1, 3: 1 });
    expect(countByPly(notesAfter, "Tiltak")).toEqual({});
    // Nothing dropped, deduplicated or replaced
    Object.keys(notesBefore).forEach((id) => {
      expect(notesAfter[id].length, `notes on ply ${id}`).toBe(
        notesBefore[id].length
      );
    });
    expect(notesAfter[0].map((note) => note.message)).toEqual([
      'name:"Topaz" +0.2/12 1000 nodes 10ms pv> f6 d4',
      'name:"Topaz" +0.1/8 2000 nodes 20ms pv> a1 d2',
      '*name:"Tiltak" is my favourite +0.5',
    ]);

    // Both show as saved results for that position
    const shown = await page.evaluate(() => {
      const game = window.app.$game;
      return window.app.$store.getters["game/suggestions"](
        game.plies[0].tpsAfter
      )
        .filter((s) => s.botName === "Topaz")
        .map((s) => s.ply && s.ply.text);
    });
    expect(shown.sort()).toEqual(["a1", "f6"]);

    expect(await reparsedGroups(page)).toEqual({
      Topaz: [0, 0, 1, 2, 3],
      "(other)": [1, 3],
    });
    await expectHealthy(page);
    await expectUndoRedo(page, before, after);
  });

  test("renaming to an empty name moves the results to Other", async ({
    page,
  }) => {
    const before = await snapshot(page);
    expect(await rename(page, "Tiltak", "")).toBe(true);
    const after = await snapshot(page);
    const notesAfter = await notes(page);

    expect(countByPly(notesAfter, "Tiltak")).toEqual({});
    expect(countByPly(notesAfter, null)).toEqual({ 0: 1, 1: 2, 3: 2 });
    expect(notesAfter[0][0].message).toBe("+0.2/12 1000 nodes 10ms pv> f6 d4");
    expect(notesAfter[0][2].message).toBe(
      '*name:"Tiltak" is my favourite +0.5'
    );
    expect(await savedBotNames(page)).toEqual(["Topaz", null]);
    expect(await reparsedGroups(page)).toEqual({
      "(other)": [0, 1, 1, 3, 3],
      Topaz: [0, 2],
    });
    await expectHealthy(page);
    await expectUndoRedo(page, before, after);
  });

  test("renames Other to a name", async ({ page }) => {
    const before = await snapshot(page);
    const notesBefore = await notes(page);
    expect(await rename(page, null, "Tiltak 2")).toBe(true);
    const after = await snapshot(page);
    const notesAfter = await notes(page);

    expect(countByPly(notesAfter, null)).toEqual({});
    expect(countByPly(notesAfter, "Tiltak 2")).toEqual({ 1: 1, 3: 1 });
    expect(notesAfter[1][1].message).toBe(
      'name:"Tiltak 2" +0.4/9 3000 nodes 30ms pv> e4 d3'
    );
    // The plain comment and user note stay unnamed and unchanged
    expect(bystanders(notesAfter, ["Tiltak 2"])).toEqual(
      bystanders(notesBefore, [null])
    );
    expect(await savedBotNames(page)).not.toContain(null);
    expect(await reparsedGroups(page)).toEqual({
      Tiltak: [0, 1, 3],
      Topaz: [0, 2],
      "Tiltak 2": [1, 3],
    });
    await expectHealthy(page);
    await expectUndoRedo(page, before, after);
  });

  test('escapes " and \\ so the PTN round trips', async ({ page }) => {
    const original = (await snapshot(page)).ptn;
    const name = 'My "best" \\engine\\';
    expect(await rename(page, "Tiltak", name)).toBe(true);
    const notesAfter = await notes(page);

    expect(notesAfter[0][0].message).toBe(
      'name:"My \\"best\\" \\\\engine\\\\" +0.2/12 1000 nodes 10ms pv> f6 d4'
    );
    // getBotName (behind note.botName) returns the exact text
    expect(notesAfter[0][0].botName).toBe(name);
    expect(countByPly(notesAfter, name)).toEqual({ 0: 1, 1: 1, 3: 1 });
    expect(await savedBotNames(page)).toContain(name);
    expect((await reparsedGroups(page))[name]).toEqual([0, 1, 3]);
    await expectHealthy(page);

    // And back again
    expect(await rename(page, name, "Tiltak")).toBe(true);
    expect((await snapshot(page)).ptn).toBe(original);
  });

  test("braces cannot break the PTN", async ({ page }) => {
    expect(await rename(page, "Tiltak", "A {b} c")).toBe(true);
    expect(await savedBotNames(page)).toContain("A b c");
    await expectHealthy(page);
  });

  test("renaming to the same name is a no-op", async ({ page }) => {
    const before = await snapshot(page);
    expect(await rename(page, "Tiltak", "Tiltak")).toBe(false);
    expect(await rename(page, "Tiltak", "  Tiltak  ")).toBe(false);
    expect(await rename(page, null, "")).toBe(false);
    expect(await rename(page, "Nonexistent", "Other")).toBe(false);
    const after = await snapshot(page);
    expect(after.ptn).toBe(before.ptn);
    expect(after.historyIndex).toBe(before.historyIndex);
    expect(after.historyLength).toBe(before.historyLength);
  });

  test("the selected saved engine follows the rename", async ({ page }) => {
    await act(page, "analysis/SELECT_SAVED_ENGINE", "Tiltak");
    expect(await rename(page, "Tiltak", "Stockfish")).toBe(true);
    expect(
      await page.evaluate(() => window.app.$store.state.analysis.savedBotName)
    ).toBe("Stockfish");
    // The per-game persisted selection follows too
    await page.waitForFunction(
      () =>
        window.app.$game.config.analysis &&
        window.app.$game.config.analysis.savedBotName === "Stockfish"
    );

    // Renaming another engine leaves the selection alone
    expect(await rename(page, "Topaz", "Other Engine")).toBe(true);
    expect(
      await page.evaluate(() => window.app.$store.state.analysis.savedBotName)
    ).toBe("Stockfish");

    // Moving the selected engine to Other selects Other
    expect(await rename(page, "Stockfish", "")).toBe(true);
    expect(
      await page.evaluate(() => window.app.$store.state.analysis.savedBotName)
    ).toBe(null);
  });
});

test.describe("Undoing a rename", () => {
  test.beforeEach(async ({ page }) => {
    await loadPTN(page, PTN);
  });

  const selected = (page) =>
    page.evaluate(() => window.app.$store.state.analysis.savedBotName);

  /** Wait until the game's persisted selection is `name` */
  const persisted = (page, name) =>
    page.waitForFunction(
      (name) =>
        window.app.$game.config.analysis &&
        window.app.$game.config.analysis.savedBotName === name,
      name
    );

  test("UNDO and REDO move the selection with the rename", async ({ page }) => {
    await act(page, "analysis/SELECT_SAVED_ENGINE", "Tiltak");
    expect(await rename(page, "Tiltak", "Stockfish")).toBe(true);
    await persisted(page, "Stockfish");

    expect(await act(page, "game/UNDO")).toBeNull();
    expect(await selected(page)).toBe("Tiltak");
    await persisted(page, "Tiltak");

    expect(await act(page, "game/REDO")).toBeNull();
    expect(await selected(page)).toBe("Stockfish");
    await persisted(page, "Stockfish");
  });

  test("UNDO of a merge restores the old selection", async ({ page }) => {
    await act(page, "analysis/SELECT_SAVED_ENGINE", "Tiltak");
    expect(await rename(page, "Tiltak", "Topaz")).toBe(true);
    expect(await selected(page)).toBe("Topaz");

    expect(await act(page, "game/UNDO")).toBeNull();
    expect(await selected(page)).toBe("Tiltak");
    await persisted(page, "Tiltak");

    expect(await act(page, "game/REDO")).toBeNull();
    expect(await selected(page)).toBe("Topaz");
  });

  test("UNDO of a move to Other restores the old selection", async ({
    page,
  }) => {
    await act(page, "analysis/SELECT_SAVED_ENGINE", "Tiltak");
    expect(await rename(page, "Tiltak", "")).toBe(true);
    expect(await selected(page)).toBe(null);

    expect(await act(page, "game/UNDO")).toBeNull();
    expect(await selected(page)).toBe("Tiltak");
    expect(await act(page, "game/REDO")).toBeNull();
    expect(await selected(page)).toBe(null);
  });

  test("leaves another engine's selection alone", async ({ page }) => {
    await act(page, "analysis/SELECT_SAVED_ENGINE", "Topaz");
    expect(await rename(page, "Tiltak", "Stockfish")).toBe(true);
    expect(await selected(page)).toBe("Topaz");

    expect(await act(page, "game/UNDO")).toBeNull();
    expect(await selected(page)).toBe("Topaz");
    expect(await act(page, "game/REDO")).toBeNull();
    expect(await selected(page)).toBe("Topaz");
  });

  test("leaves the selection alone if it changed after the rename", async ({
    page,
  }) => {
    await act(page, "analysis/SELECT_SAVED_ENGINE", "Tiltak");
    expect(await rename(page, "Tiltak", "Stockfish")).toBe(true);
    await act(page, "analysis/SELECT_SAVED_ENGINE", "Topaz");

    expect(await act(page, "game/UNDO")).toBeNull();
    expect(await selected(page)).toBe("Topaz");
  });
});

test.describe("Rename saved results UI", () => {
  test.beforeEach(async ({ page }) => {
    await loadPTN(page, PTN);
    await page.evaluate(async () => {
      const store = window.app.$store;
      await store.dispatch("ui/SET_UI", ["showText", true]);
      await store.dispatch("ui/SET_UI", ["textTab", "notes"]);
    });
  });

  /** Open the Rename dialog from the menu of `label`'s section */
  async function openRename(page, label) {
    const section = page
      .locator(".saved-bot-results")
      .filter({ has: page.locator(".q-item__label", { hasText: label }) });
    await section.locator(".saved-bot-results-menu").first().click();
    await page
      .locator(".q-menu .q-item", { hasText: "Rename" })
      .first()
      .click();
    const dialog = page.locator(".rename-saved-results");
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test("renames from the section menu", async ({ page }) => {
    const dialog = await openRename(page, "Tiltak");
    const input = dialog.locator("input");
    await expect(input).toHaveValue("Tiltak");
    // Autocomplete offers configured engines too
    await input.fill("wasm");
    await expect(
      page.getByRole("option", { name: "Tiltak (wasm)" })
    ).toBeVisible();
    await input.fill("Stockfish");
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(dialog).toBeHidden();
    expect(await savedBotNames(page)).toContain("Stockfish");
    expect(await savedBotNames(page)).not.toContain("Tiltak");

    // Other starts empty
    const other = await openRename(page, "Other");
    await expect(other.locator("input")).toHaveValue("");
    await other.getByRole("button", { name: "Cancel" }).click();
    await expect(other).toBeHidden();
  });

  test("asks before merging, and Cancel changes nothing", async ({ page }) => {
    const before = await snapshot(page);
    const dialog = await openRename(page, "Tiltak");
    // Autocomplete offers the engines that have saved results
    await dialog.locator("input").fill("top");
    await page.getByRole("option", { name: "Topaz" }).click();
    await expect(dialog.locator("input")).toHaveValue("Topaz");
    await dialog.getByRole("button", { name: "OK" }).click();

    const confirm = page.locator(".q-dialog .q-card", {
      hasText: "3 positions",
    });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText("Tiltak");
    await expect(confirm).toContainText("Topaz");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    expect((await snapshot(page)).ptn).toBe(before.ptn);

    // The rename dialog stays open, so OK asks again
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "OK" }).click();
    await expect(confirm).toBeHidden();
    await expect(dialog).toBeHidden();
    expect(countByPly(await notes(page), "Topaz")).toEqual({
      0: 2,
      1: 1,
      2: 1,
      3: 1,
    });
  });
});
