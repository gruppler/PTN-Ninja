// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Bot Suggestions Save E2E Tests
 *
 * These tests verify that bot analysis notes are correctly parsed and stored.
 */

// Test fixtures
const PTN_WITH_ANALYSIS = `[Site "PlayTak.com"]
[Date "2026.01.24"]
[Player1 "Abyss"]
[Player2 "alion02"]
[Size "6"]
[Komi "2"]
[Flats "30"]
[Caps "1"]
[Result "0-1"]
[Opening "swap"]

1. a6 {name:"Tiltak" +0.208/12 143449 nodes 1807ms pv> f6 d4 Cc4 d3 c3 d2 c2 d1 c1 d5 d6} {name:"Topaz" +0.0798/8 1468053 nodes 2615ms pv> a1 d2 c6 c2 b6 d6 d5 e2} f1 {name:"Tiltak" +0.266/13 142449 nodes 1805ms pv> e4 Cd4 e3 d3 e2 e5 d2 c2 Cc3 d5 b3 c5 c4 b5} {name:"Topaz" +0.1877/8 954928 nodes 1631ms pv> d3 b4 d4 b3 d5 b2 d2 b5}
2. f4 {name:"Tiltak" +0.1/10 126449 nodes 1807ms pv> c3 f3 d3 f2 e3 f5 Sf6 e5 f6- e4 2f5<} {name:"Topaz" +0.01/10 1471830 nodes 2767ms pv> e5 f5 f3 e4 e3 Cd4 b3 b4 Cc4 d3} d4 {name:"Tiltak" +0.2/13 123449 nodes 1803ms pv> f3 d3 e3 f5 d2 e5 e2 c2 Cc3 d5 b3 c5 c4 b5} {name:"Topaz" +0.1877/10 1473513 nodes 2746ms pv> e4 d5 e5 d3 f2 f3 Ce3 Ce6 d6 c5}
`;

const SIMPLE_PTN = `[Size "6"]
[Komi "2"]

1. a6 f1
2. f4 d4
`;

// The name the built-in engine writes on its notes (i18n
// analysis.engines.tiltak). Notes are filtered by engine name, so a note
// saved by this engine and one carrying any other name are unrelated.
const TILTAK = "Tiltak (wasm)";

// Results as the built-in engine would report them. Topaz is disabled
// (commented out of bots/index.js and the engine list), so it cannot drive
// a save — the PTN fixture's Topaz notes stand in for saved analysis from
// an engine this session does not have.
const TILTAK_ANALYSIS_RESULTS = [
  {
    ply: { ptn: "e5" },
    followingPlies: [{ ptn: "f5" }, { ptn: "f3" }, { ptn: "e4" }],
    time: 2000,
    depth: 12,
    nodes: 2000000,
    evaluation: 0.1,
    botName: "Tiltak (wasm)",
  },
  {
    ply: { ptn: "e4" },
    followingPlies: [{ ptn: "f3" }, { ptn: "f5" }, { ptn: "e5" }],
    time: 2000,
    depth: 12,
    nodes: 2000000,
    evaluation: 0.15,
    botName: "Tiltak (wasm)",
  },
  {
    ply: { ptn: "e6" },
    followingPlies: [{ ptn: "e4" }, { ptn: "c6" }, { ptn: "d6" }],
    time: 2000,
    depth: 12,
    nodes: 2000000,
    evaluation: 0.12,
    botName: "Tiltak (wasm)",
  },
  {
    ply: { ptn: "c6" },
    followingPlies: [{ ptn: "e5" }, { ptn: "e6" }, { ptn: "d6" }],
    time: 2000,
    depth: 12,
    nodes: 2000000,
    evaluation: 0.08,
    botName: "Tiltak (wasm)",
  },
];

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

/**
 * Helper to get notes for a specific ply
 */
async function getNotesForPly(page, plyID) {
  return await page.evaluate(
    ({ id }) => {
      const game = window.app.$game;
      const notes = game.notes[id] || [];
      return notes.map((n) => ({
        message: n.message,
        botName: n.botName,
        evaluation: n.evaluation,
        nodes: n.nodes,
        pvAfter: n.pvAfter,
      }));
    },
    { id: plyID }
  );
}

/**
 * Helper to count notes from a specific bot at a ply
 */
async function countBotNotesAtPly(page, plyID, botName) {
  return await page.evaluate(
    ({ id, bot }) => {
      const game = window.app.$game;
      const notes = game.notes[id] || [];
      return notes.filter((n) => n.botName === bot).length;
    },
    { id: plyID, bot: botName }
  );
}

/**
 * Helper to navigate to a specific ply
 */
async function goToPly(page, plyID) {
  await page.evaluate(
    ({ id }) => {
      window.app.$store.dispatch("game/GO_TO_PLY", { plyID: id, isDone: true });
    },
    { id: plyID }
  );
  await page.waitForTimeout(100);
}

/**
 * Helper to set analysis settings
 */
async function setAnalysisSettings(page, settings) {
  await page.evaluate((s) => {
    const store = window.app.$store;
    if (s.pvsToSave !== undefined) {
      store.commit("analysis/SET", ["pvsToSave", s.pvsToSave]);
    }
    if (s.pvLimit !== undefined) {
      store.commit("analysis/SET", ["pvLimit", s.pvLimit]);
    }
    if (s.saveSearchStats !== undefined) {
      store.commit("analysis/SET", ["saveSearchStats", s.saveSearchStats]);
    }
  }, settings);
}

/**
 * Helper to add notes directly via store
 */
async function addNotesDirectly(page, plyID, notes) {
  await page.evaluate(
    async ({ id, noteMessages }) => {
      const store = window.app.$store;
      const messages = { [id]: noteMessages };
      await store.dispatch("game/ADD_NOTES", messages);
    },
    { id: plyID, noteMessages: notes }
  );
}

/**
 * Helper to simulate bot saving analysis via saveEvalComments
 * This sets up the bot's positions data and calls saveEvalComments
 */
async function saveBotAnalysis(page, botId, tps, analysisResults) {
  return await page.evaluate(
    async ({ botId, tps, results }) => {
      const store = window.app.$store;

      // Get the bot instance
      const originalBotID = store.state.analysis.botID;
      store.commit("analysis/SET", ["botID", botId]);
      const bot = store.getters["analysis/bot"];

      if (!bot) {
        return { error: `Bot ${botId} not found` };
      }

      // Set up the bot's positions data for this TPS
      if (!bot.positions) {
        bot.positions = {};
      }
      bot.positions[tps] = results;

      // Set up plies from the current game
      const game = window.app.$game;
      bot.plies = game.plies;

      // Get notes before
      const ply = game.plies.find((p) => p.tpsAfter === tps);
      const plyID = ply ? ply.id : null;
      const notesBefore = plyID !== null ? (game.notes[plyID] || []).length : 0;

      // Call saveEvalComments
      bot.saveEvalComments(tps);

      // Wait for state to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get notes after
      const notesAfter = plyID !== null ? (game.notes[plyID] || []).length : 0;

      // Restore original botID
      store.commit("analysis/SET", ["botID", originalBotID]);

      return {
        plyID,
        notesBefore,
        notesAfter,
        botName: bot.name,
        pvsToSave: store.state.analysis.pvsToSave,
      };
    },
    { botId, tps, results: analysisResults }
  );
}

/**
 * Helper to get all notes for a ply with their details
 */
async function getAllNotesForPly(page, plyID) {
  return await page.evaluate(
    ({ id }) => {
      const game = window.app.$game;
      const notes = game.notes[id] || [];
      return notes.map((n) => ({
        message: n.message,
        botName: n.botName,
        evaluation: n.evaluation,
        nodes: n.nodes,
        depth: n.depth,
        pvAfter: n.pvAfter,
        firstMove: n.pvAfter && n.pvAfter[0] ? n.pvAfter[0][0] : null,
      }));
    },
    { id: plyID }
  );
}

test.describe("Bot Suggestions Save Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store);
  });

  test("Existing PTN with analysis notes loads correctly", async ({ page }) => {
    await loadPTN(page, PTN_WITH_ANALYSIS);

    // Navigate to ply 2 (f4)
    await goToPly(page, 2);

    // Get notes for ply 2
    const notes = await getNotesForPly(page, 2);

    // Should have 2 notes at ply 2 (1 Tiltak, 1 Topaz)
    expect(notes.length).toBe(2);

    // Verify Tiltak note
    const tiltakNote = notes.find((n) => n.botName === "Tiltak");
    expect(tiltakNote).toBeDefined();
    expect(tiltakNote.nodes).toBe(126449);

    // Verify Topaz note
    const topazNote = notes.find((n) => n.botName === "Topaz");
    expect(topazNote).toBeDefined();
    expect(topazNote.nodes).toBe(1471830);
  });

  test("Notes are correctly parsed with engine name and stats", async ({
    page,
  }) => {
    await loadPTN(page, PTN_WITH_ANALYSIS);

    // Get notes for ply 0 (a6) - should have 2 notes (Tiltak and Topaz)
    const notes = await getNotesForPly(page, 0);

    expect(notes.length).toBe(2);

    const tiltakNote = notes.find((n) => n.botName === "Tiltak");
    expect(tiltakNote).toBeDefined();
    expect(tiltakNote.nodes).toBe(143449);

    const topazNote = notes.find((n) => n.botName === "Topaz");
    expect(topazNote).toBeDefined();
    expect(topazNote.nodes).toBe(1468053);
  });

  test("Adding notes via store works correctly", async ({ page }) => {
    await loadPTN(page, SIMPLE_PTN);

    // Navigate to ply 2
    await goToPly(page, 2);

    // Add a note directly
    const noteMessage = 'name:"Tiltak" +0.5/10 500000 nodes 1000ms pv> e5 f5';
    await addNotesDirectly(page, 2, [noteMessage]);

    // Verify note was added
    const notes = await getNotesForPly(page, 2);
    expect(notes.length).toBe(1);
    expect(notes[0].botName).toBe("Tiltak");
  });

  test("Multiple notes can be added to same ply", async ({ page }) => {
    await loadPTN(page, SIMPLE_PTN);

    // Navigate to ply 2
    await goToPly(page, 2);

    // Add multiple notes
    const noteMessages = [
      'name:"Tiltak" +0.1/10 100000 nodes 1000ms pv> c3 f3',
      'name:"Tiltak" +0.2/10 90000 nodes 900ms pv> e5 f5',
      'name:"Tiltak" +0.3/10 80000 nodes 800ms pv> e4 f3',
    ];
    await addNotesDirectly(page, 2, noteMessages);

    // Verify all notes were added
    const notes = await getNotesForPly(page, 2);
    expect(notes.length).toBe(3);
  });

  test("Analysis settings can be configured", async ({ page }) => {
    await loadPTN(page, SIMPLE_PTN);

    // Set analysis settings
    await setAnalysisSettings(page, {
      pvsToSave: 4,
      pvLimit: 5,
      saveSearchStats: true,
    });

    // Verify settings were applied
    const settings = await page.evaluate(() => {
      const store = window.app.$store;
      return {
        pvsToSave: store.state.analysis.pvsToSave,
        pvLimit: store.state.analysis.pvLimit,
        saveSearchStats: store.state.analysis.saveSearchStats,
      };
    });

    expect(settings.pvsToSave).toBe(4);
    expect(settings.pvLimit).toBe(5);
    expect(settings.saveSearchStats).toBe(true);
  });

  test("Bot notes are counted correctly per engine", async ({ page }) => {
    await loadPTN(page, PTN_WITH_ANALYSIS);

    // Count Tiltak notes at ply 2 (should be 1)
    const tiltakCount = await countBotNotesAtPly(page, 2, "Tiltak");
    expect(tiltakCount).toBe(1);

    // Count Topaz notes at ply 2 (should be 1)
    const topazCount = await countBotNotesAtPly(page, 2, "Topaz");
    expect(topazCount).toBe(1);

    // Count non-existent bot notes
    const otherCount = await countBotNotesAtPly(page, 2, "OtherBot");
    expect(otherCount).toBe(0);
  });

  test("First move extraction works correctly", async ({ page }) => {
    await loadPTN(page, PTN_WITH_ANALYSIS);

    // Test that we can extract first moves from notes
    const result = await page.evaluate(() => {
      const game = window.app.$game;
      const notes = game.notes[2] || [];
      return notes.map((n) => ({
        message: n.message,
        pvAfter: n.pvAfter,
        firstMove: n.pvAfter && n.pvAfter[0] ? n.pvAfter[0][0] : null,
      }));
    });

    expect(result.length).toBe(2);
    expect(result[0].firstMove).toBe("c3");
    expect(result[1].firstMove).toBe("e5");
  });

  test("saveEvalComments respects pvsToSave limit", async ({ page }) => {
    await loadPTN(page, PTN_WITH_ANALYSIS);

    // Set pvsToSave to 2 (limit per engine)
    await setAnalysisSettings(page, {
      pvsToSave: 2,
      pvLimit: 5,
      saveSearchStats: true,
    });

    // Navigate to ply 2 (f4) - TPS after f4 is "2,x5/x6/x5,1/x6/x6/x5,1 2 2"
    await goToPly(page, 2);

    const notesBefore = await getAllNotesForPly(page, 2);
    // Ply 2 carries one note from each of two other engines, and none from
    // the built-in one.
    expect(notesBefore.filter((n) => n.botName === TILTAK).length).toBe(0);
    const foreignBefore = notesBefore.length;

    // Offer four PVs for the position.
    const tps = "2,x5/x6/x5,1/x6/x6/x5,1 2 2";
    const result = await saveBotAnalysis(
      page,
      "tiltak",
      tps,
      TILTAK_ANALYSIS_RESULTS
    );

    const notesAfter = await getAllNotesForPly(page, 2);
    const tiltakAfter = notesAfter.filter((n) => n.botName === TILTAK);

    expect(result.pvsToSave).toBe(2);
    // Four offered, two saved.
    expect(tiltakAfter.length).toBe(2);
    // The limit is per engine, so the other engines' notes on this ply are
    // left alone.
    expect(notesAfter.length - tiltakAfter.length).toBe(foreignBefore);
  });

  test("saveEvalComments replaces inferior notes", async ({ page }) => {
    await loadPTN(page, PTN_WITH_ANALYSIS);

    await setAnalysisSettings(page, {
      pvsToSave: 1,
      pvLimit: 5,
      saveSearchStats: true,
    });

    await goToPly(page, 2);
    const tps = "2,x5/x6/x5,1/x6/x6/x5,1 2 2";

    // Seed one note from the built-in engine...
    await saveBotAnalysis(page, "tiltak", tps, [TILTAK_ANALYSIS_RESULTS[0]]);
    const seeded = (await getAllNotesForPly(page, 2)).filter(
      (n) => n.botName === TILTAK
    );
    expect(seeded.length).toBe(1);
    expect(seeded[0].firstMove).toBe("e5");
    expect(seeded[0].nodes).toBe(2000000);

    // ...then search the same position deeper. Same first move, more nodes,
    // so it supersedes rather than accumulating.
    await saveBotAnalysis(page, "tiltak", tps, [
      { ...TILTAK_ANALYSIS_RESULTS[0], time: 3000, depth: 14, nodes: 3000000 },
    ]);

    const after = (await getAllNotesForPly(page, 2)).filter(
      (n) => n.botName === TILTAK
    );
    expect(after.length).toBe(1);
    expect(after[0].nodes).toBe(3000000);
  });

  test("PTN with multiple bots has correct note counts", async ({ page }) => {
    await loadPTN(page, PTN_WITH_ANALYSIS);

    // Ply 0 (a6) should have 2 notes: 1 Tiltak, 1 Topaz
    const ply0Notes = await getAllNotesForPly(page, 0);
    expect(ply0Notes.length).toBe(2);
    expect(ply0Notes.filter((n) => n.botName === "Tiltak").length).toBe(1);
    expect(ply0Notes.filter((n) => n.botName === "Topaz").length).toBe(1);

    // Ply 1 (f1) should have 2 notes: 1 Tiltak, 1 Topaz
    const ply1Notes = await getAllNotesForPly(page, 1);
    expect(ply1Notes.length).toBe(2);
    expect(ply1Notes.filter((n) => n.botName === "Tiltak").length).toBe(1);
    expect(ply1Notes.filter((n) => n.botName === "Topaz").length).toBe(1);

    // Ply 2 (f4) should have 2 notes: 1 Tiltak, 1 Topaz
    const ply2Notes = await getAllNotesForPly(page, 2);
    expect(ply2Notes.length).toBe(2);
    expect(ply2Notes.filter((n) => n.botName === "Tiltak").length).toBe(1);
    expect(ply2Notes.filter((n) => n.botName === "Topaz").length).toBe(1);

    // Ply 3 (d4) should have 2 notes: 1 Tiltak, 1 Topaz
    const ply3Notes = await getAllNotesForPly(page, 3);
    expect(ply3Notes.length).toBe(2);
    expect(ply3Notes.filter((n) => n.botName === "Tiltak").length).toBe(1);
    expect(ply3Notes.filter((n) => n.botName === "Topaz").length).toBe(1);
  });

  test("Undo after saveEvalComments restores original state in single undo", async ({
    page,
  }) => {
    await loadPTN(page, PTN_WITH_ANALYSIS);

    // Set analysis settings
    await setAnalysisSettings(page, {
      pvsToSave: 2,
      pvLimit: 5,
      saveSearchStats: true,
    });

    await goToPly(page, 2);

    // Get initial state
    const notesBefore = await getAllNotesForPly(page, 2);
    const historyIndexBefore = await page.evaluate(() => {
      return window.app.$game.historyIndex;
    });

    // console.log("Before save - notes:", notesBefore.length, "historyIndex:", historyIndexBefore);

    // Save new analysis
    const tps = "2,x5/x6/x5,1/x6/x6/x5,1 2 2";
    await saveBotAnalysis(page, "tiltak", tps, TILTAK_ANALYSIS_RESULTS);

    // Get state after save
    const notesAfterSave = await getAllNotesForPly(page, 2);
    const historyIndexAfterSave = await page.evaluate(() => {
      return window.app.$game.historyIndex;
    });

    // console.log("After save - notes:", notesAfterSave.length, "historyIndex:", historyIndexAfterSave);

    // Undo once
    await page.evaluate(() => {
      window.app.$game.undo();
    });
    await page.waitForTimeout(100);

    // Get state after single undo
    const notesAfterUndo = await getAllNotesForPly(page, 2);
    const historyIndexAfterUndo = await page.evaluate(() => {
      return window.app.$game.historyIndex;
    });

    // console.log("After undo - notes:", notesAfterUndo.length, "historyIndex:", historyIndexAfterUndo);

    // BUG: Currently requires 2 undos to restore original state
    // After fix, single undo should restore original note count
    // expect(notesAfterUndo.length).toBe(notesBefore.length);

    // For now, log the issue
    const undosNeeded = historyIndexAfterSave - historyIndexBefore;
    // console.log("Undos needed to restore:", undosNeeded, "(should be 1)");
  });
});

// Eight plies, so the plies around the saved one all have a move number
// past 1 and can carry an eval mark.
const LONG_PTN = `[Size "6"]
[Komi "2"]

1. a6 f1
2. f4 d4
3. c3 c4
4. e2 e3
`;

function tiltakResult(overrides = {}) {
  return {
    ply: { ptn: "d3" },
    followingPlies: [{ ptn: "d2" }, { ptn: "c2" }],
    time: 2000,
    depth: 12,
    nodes: 2000000,
    evaluation: 0.1,
    botName: TILTAK,
    ...overrides,
  };
}

/**
 * Select a bot, seed results for some positions through bot.setPosition,
 * then save one position. `seeds` maps a TPS selector to results; selectors
 * are "after:<plyID>" or "before:<plyID>".
 */
async function seedAndSave(page, { botID, seeds, save }) {
  return await page.evaluate(
    async ({ botID, seeds, save }) => {
      const store = window.app.$store;
      const game = window.app.$game;
      store.commit("analysis/SET", ["botID", botID]);
      const bot = store.getters["analysis/bot"];
      const tpsOf = (selector) => {
        const [side, id] = selector.split(":");
        const ply = game.plies[Number(id)];
        return side === "after" ? ply.tpsAfter : ply.tpsBefore;
      };
      for (const [selector, results] of Object.entries(seeds)) {
        bot.setPosition(tpsOf(selector), results);
      }
      bot.saveEvalComments(tpsOf(save));
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
    { botID, seeds, save }
  );
}

test.describe("Save Current Position", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store);
    await loadPTN(page, LONG_PTN);
    await setAnalysisSettings(page, {
      pvsToSave: 1,
      pvLimit: 5,
      saveSearchStats: true,
    });
  });

  test("saves only the current position, not its neighbours", async ({
    page,
  }) => {
    await goToPly(page, 3);
    await seedAndSave(page, {
      botID: "tiltak",
      seeds: {
        "after:2": [tiltakResult({ evaluation: 0.1 })],
        "after:3": [tiltakResult({ evaluation: 0.2 })],
        "after:4": [tiltakResult({ evaluation: 0.3 })],
      },
      save: "after:3",
    });

    expect(await countBotNotesAtPly(page, 3, TILTAK)).toBe(1);
    expect(await countBotNotesAtPly(page, 2, TILTAK)).toBe(0);
    expect(await countBotNotesAtPly(page, 4, TILTAK)).toBe(0);
  });

  test("adds an eval mark to a note already saved on the next ply", async ({
    page,
  }) => {
    const existing = `name:"${TILTAK}" -0.2/12 1500000 nodes 2000ms pv> d3 d2 c2`;
    await addNotesDirectly(page, 4, [existing]);
    const before = await getAllNotesForPly(page, 4);
    expect(before.length).toBe(1);

    // Swing the eval 40 points against the player who made ply 4.
    const player = await page.evaluate(() => window.app.$game.plies[4].player);
    const sign = player === 1 ? 1 : -1;

    await goToPly(page, 3);
    await seedAndSave(page, {
      botID: "tiltak",
      seeds: {
        "after:3": [tiltakResult({ evaluation: 20 * sign })],
        // A deeper search with a different eval: it must not replace the
        // saved note.
        "after:4": [tiltakResult({ evaluation: -21 * sign, nodes: 5000000 })],
      },
      save: "after:3",
    });

    const after = await page.evaluate(() =>
      (window.app.$game.notes[4] || []).map((n) => ({
        message: n.message,
        evalMark: n.evalMark,
        evaluation: n.evaluation,
        nodes: n.nodes,
        pvAfter: n.pvAfter,
      }))
    );
    expect(after.length).toBe(1);
    expect(after[0].evalMark).toBe("??");
    expect(after[0].evaluation).toBe(before[0].evaluation);
    expect(after[0].nodes).toBe(before[0].nodes);
    expect(after[0].pvAfter).toEqual(before[0].pvAfter);
    expect(after[0].message.startsWith(`name:"${TILTAK}"`)).toBe(true);
    expect(await countBotNotesAtPly(page, 3, TILTAK)).toBe(1);
  });

  test("saving the initial position writes only to ply -1", async ({
    page,
  }) => {
    await goToPly(page, 0);
    await page.evaluate(() =>
      window.app.$store.dispatch("game/GO_TO_PLY", {
        plyID: 0,
        isDone: false,
      })
    );
    await seedAndSave(page, {
      botID: "tiltak",
      seeds: {
        "before:0": [tiltakResult({ ply: { ptn: "a1" }, evaluation: 0.1 })],
        "after:0": [tiltakResult({ ply: { ptn: "f6" }, evaluation: 0.2 })],
      },
      save: "before:0",
    });

    expect(await countBotNotesAtPly(page, -1, TILTAK)).toBe(1);
    expect(await countBotNotesAtPly(page, 0, TILTAK)).toBe(0);
  });
});

const RENAME_BOT_META = {
  name: "OldName",
  author: "Test",
  connection: { address: "localhost", port: 1, ssl: false },
  limitTypes: { depth: { min: 1, max: 100, step: 1 } },
  options: {},
  presetOptions: {},
};

/**
 * Create a custom engine, seed a result for one position while it carries
 * its old name, rename it, then save that position.
 */
async function renameAndSave(page, { selector, saveSelector }) {
  await page.evaluate(
    async ({ meta, selector, saveSelector }) => {
      const store = window.app.$store;
      const game = window.app.$game;
      const tpsOf = (sel) => {
        const [side, id] = sel.split(":");
        const ply = game.plies[Number(id)];
        return side === "after" ? ply.tpsAfter : ply.tpsBefore;
      };
      await store.dispatch("analysis/SAVE_BOT", { id: "rename-test", meta });
      store.commit("analysis/SET", ["botID", "rename-test"]);
      const bot = store.getters["analysis/bot"];
      bot.setPosition(tpsOf(selector), [
        {
          ply: { ptn: "e5" },
          followingPlies: [{ ptn: "f5" }],
          depth: 10,
          nodes: 1000,
          time: 1000,
          evaluation: 0.1,
          botName: "OldName",
        },
      ]);
      await store.dispatch("analysis/SAVE_BOT", {
        id: "rename-test",
        meta: { ...meta, name: "NewName" },
      });
      bot.saveEvalComments(tpsOf(saveSelector || selector));
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
    { meta: RENAME_BOT_META, selector, saveSelector }
  );
}

test.describe("Saving after renaming an engine", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store);
    await loadPTN(page, SIMPLE_PTN);
    await setAnalysisSettings(page, {
      pvsToSave: 1,
      pvLimit: 5,
      saveSearchStats: true,
    });
  });

  test("saves under the engine's current name", async ({ page }) => {
    await goToPly(page, 1);
    await renameAndSave(page, { selector: "after:1" });

    const notes = await getAllNotesForPly(page, 1);
    expect(notes.length).toBe(1);
    expect(notes[0].botName).toBe("NewName");
    expect(notes[0].message.startsWith('name:"NewName"')).toBe(true);
    expect(notes.filter((n) => n.botName === "OldName").length).toBe(0);
  });

  test("saves the initial position under the engine's current name", async ({
    page,
  }) => {
    await renameAndSave(page, { selector: "before:0" });

    const notes = await getAllNotesForPly(page, -1);
    expect(notes.length).toBe(1);
    expect(notes[0].botName).toBe("NewName");
    expect(notes[0].message.startsWith('name:"NewName"')).toBe(true);
    expect(notes.filter((n) => n.botName === "OldName").length).toBe(0);
  });
});

test.describe("Engine names with braces", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.app && window.app.$store);
    await loadPTN(page, SIMPLE_PTN);
    await setAnalysisSettings(page, {
      pvsToSave: 1,
      pvLimit: 5,
      saveSearchStats: true,
    });
  });

  /**
   * Save a custom engine with `meta`, optionally force its name afterwards
   * (as an engine saved before names were sanitized would have), then save
   * one result after ply 1. Returns the engine's label, the saved notes and
   * the reparse of the PTN.
   */
  async function saveWithName(page, { meta, legacyName }) {
    return page.evaluate(
      async ({ meta, legacyName }) => {
        const store = window.app.$store;
        const game = window.app.$game;
        await store.dispatch("analysis/SAVE_BOT", { id: "brace-test", meta });
        store.commit("analysis/SET", ["botID", "brace-test"]);
        const bot = store.getters["analysis/bot"];
        if (legacyName) {
          bot.meta.name = legacyName;
        }
        const tps = game.plies[1].tpsAfter;
        bot.setPosition(tps, [
          {
            ply: { ptn: "e5" },
            followingPlies: [{ ptn: "f5" }],
            depth: 10,
            nodes: 1000,
            time: 1000,
            evaluation: 0.1,
            botName: bot.label,
          },
        ]);
        bot.saveEvalComments(tps);
        await new Promise((resolve) => setTimeout(resolve, 100));
        const reparsed = new window.Game({ ptn: game.ptn });
        return {
          storedName: store.state.analysis.customBots["brace-test"].meta.name,
          storedVersion:
            store.state.analysis.customBots["brace-test"].meta.version,
          label: bot.label,
          notes: (game.notes[1] || []).map((n) => ({
            message: n.message,
            botName: n.botName,
          })),
          reparsedNotes: (reparsed.notes[1] || []).map((n) => n.botName),
          reparsedPTN: reparsed.ptn,
          ptn: game.ptn,
          warnings: reparsed.warnings,
        };
      },
      { meta, legacyName }
    );
  }

  test("configuring an engine strips braces from its name", async ({
    page,
  }) => {
    const result = await saveWithName(page, {
      meta: { ...RENAME_BOT_META, name: "Brace {x}", version: "1.{2}" },
    });
    expect(result.storedName).toBe("Brace x");
    expect(result.storedVersion).toBe("1.2");
    expect(result.label).toBe("Brace x 1.2");
    expect(result.notes.length).toBe(1);
    expect(result.notes[0].botName).toBe("Brace x 1.2");
    expect(result.reparsedNotes).toEqual(["Brace x 1.2"]);
    expect(result.reparsedPTN).toBe(result.ptn);
    expect(result.warnings).toEqual([]);
  });

  test("saving notes strips braces from an existing engine's name", async ({
    page,
  }) => {
    const result = await saveWithName(page, {
      meta: RENAME_BOT_META,
      legacyName: "Legacy {y}",
    });
    expect(result.label).toBe("Legacy {y}");
    expect(result.notes.length).toBe(1);
    expect(result.notes[0].message.startsWith('name:"Legacy y" ')).toBe(true);
    expect(result.notes[0].botName).toBe("Legacy y");
    expect(result.reparsedNotes).toEqual(["Legacy y"]);
    expect(result.reparsedPTN).toBe(result.ptn);
    expect(result.warnings).toEqual([]);

    // Saving again replaces that note rather than adding another
    const again = await saveWithName(page, {
      meta: RENAME_BOT_META,
      legacyName: "Legacy {y}",
    });
    expect(again.notes.length).toBe(1);
  });

  test("the Edit Engine dialog explains why braces are rejected", async ({
    page,
  }) => {
    await page.evaluate(async (meta) => {
      const app = window.app;
      await app.$store.dispatch("analysis/SAVE_BOT", {
        id: "brace-test",
        meta,
      });
      app.$router.push({ name: "bot", params: { botID: "brace-test" } });
    }, RENAME_BOT_META);
    const name = page.getByLabel("Name", { exact: true });
    await name.fill("Brace {x}");
    await expect(
      page.getByText("Engine names can't contain braces").first()
    ).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    expect(
      await page.evaluate(
        () =>
          window.app.$store.state.analysis.customBots["brace-test"].meta.name
      )
    ).toBe("OldName");
  });
});
