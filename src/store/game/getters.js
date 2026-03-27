import Vue from "vue";
import { parseURLparams } from "../../router/routes";
import router from "../../router";
import { parsePV } from "../../utilities";
import { bothPlayersHaveFlats } from "../../Game/PTN/TPS";

export const uniqueName =
  (state) =>
  (name, ignoreFirst = false, additionalNames = []) => {
    const names = state.list.slice(1 * ignoreFirst).map((game) => game.name);
    if (additionalNames.length) {
      names.push(...additionalNames);
    }
    while (names.includes(name)) {
      if (/\(\d+\)$/.test(name)) {
        name = name.replace(/\((\d+)\)$/, (match, number) => {
          number = parseInt(number, 10) + 1;
          return `(${number})`;
        });
      } else {
        name += " (1)";
      }
    }
    return name;
  };

export const disabledOptions = () => {
  const game = Vue.prototype.$game;
  const disabled = Object.keys(parseURLparams(router.currentRoute).state);
  if (game && game.config.disableFlatCounts) {
    disabled.push("flatCounts");
  }
  if (game && game.config.disableShowRoads) {
    disabled.push("showRoads");
  }
  if (!navigator.canShare) {
    disabled.push("nativeSharing");
  }
  return disabled;
};

export const precedingPlies =
  (state) =>
  (plyID, isDone = false) => {
    const game = Vue.prototype.$game;
    if (!game) {
      return [];
    }
    const ply = game.plies[plyID];
    if (!ply) {
      return [];
    }
    const branch = ply.branch;
    // Precompute ancestor branch map for O(1) per-ply filtering
    const ancestorMaxIndex = {};
    if (branch in game.branches) {
      const visited = new Set();
      let curBranch = branch;
      while (curBranch in game.branches && !visited.has(curBranch)) {
        visited.add(curBranch);
        const firstPly = game.branches[curBranch];
        if (!firstPly || !firstPly.branches || !firstPly.branches[0]) break;
        const branchPoint = firstPly.branches[0];
        const parentBranch = branchPoint.branch;
        if (parentBranch === curBranch) break;
        ancestorMaxIndex[parentBranch] = branchPoint.index;
        curBranch = parentBranch;
      }
    }
    const inBranch = (p) => {
      if (p.branch === branch) return true;
      if (p.branch in ancestorMaxIndex) {
        return p.index < ancestorMaxIndex[p.branch];
      }
      return false;
    };
    return game.plies
      .slice(0, plyID + 1 * isDone)
      .filter((p) => p && inBranch(p))
      .map((p) => state.ptn.allPlies[p.id]);
  };

export const prevTPS = (state) =>
  state.position.plyIsDone
    ? state.position.ply.tpsBefore
    : state.position.prevPly
    ? state.position.prevPly.tpsBefore
    : null;

// Set of all TPS positions in the current game (for filtering engine results)
export const gameTpsSet = (state) => {
  const set = new Set();
  const allPlies = state.ptn && state.ptn.allPlies;
  if (allPlies) {
    for (const ply of allPlies) {
      if (!ply) continue;
      if (ply.tpsBefore) set.add(ply.tpsBefore);
      if (ply.tpsAfter) set.add(ply.tpsAfter);
    }
  }
  return set;
};

// Index mapping TPS strings to ply IDs that have notes, for O(1) lookup
export const tpsNoteIndex = (state) => {
  const afterIndex = {};
  const beforeIndex = {};
  const allPlies = state.ptn.allPlies;
  const notes = state.comments.notes;
  for (const id in notes) {
    const ply = allPlies[id];
    if (!ply) continue;
    if (ply.tpsAfter) {
      if (!afterIndex[ply.tpsAfter]) afterIndex[ply.tpsAfter] = [];
      afterIndex[ply.tpsAfter].push(id);
    }
    if (ply.tpsBefore) {
      if (!beforeIndex[ply.tpsBefore]) beforeIndex[ply.tpsBefore] = [];
      beforeIndex[ply.tpsBefore].push(id);
    }
  }
  return { afterIndex, beforeIndex };
};

export const suggestions = (state, getters) => (tps) => {
  if (!tps) {
    return [];
  }

  const results = [];
  let evalData = null;
  const { afterIndex, beforeIndex } = getters.tpsNoteIndex;

  // Check if this is the initial position (tps matches first ply's tpsBefore)
  // Also handle case where there are no plies (empty game with starting TPS)
  const firstPly = state.ptn.allPlies[0];
  const hasNoPlies = !state.ptn.allPlies || state.ptn.allPlies.length === 0;
  const isInitialPosition =
    (firstPly && firstPly.tpsBefore === tps) || hasNoPlies;

  // First, check ply -1 for initial position analysis
  if (isInitialPosition && state.comments.notes[-1]) {
    const notes = state.comments.notes[-1];
    const note = notes.find((n) => n.evaluation !== null);
    if (note) {
      evalData = {
        evaluation: note.evaluation,
        scoreText: note.scoreText,
        evalMark: note.evalMark,
        depth: note.depth,
        nodes: note.nodes,
        visits: note.visits,
        time: note.ms,
        botName: note.botName,
      };
    }
  }

  // Then, find evaluation data (from ply whose tpsAfter matches tps)
  if (!evalData) {
    const matchingIDs = afterIndex[tps];
    if (matchingIDs) {
      for (let i = 0; i < matchingIDs.length; i++) {
        const id = matchingIDs[i];
        const notes = state.comments.notes[id];
        if (!notes) continue;
        const note = notes.find((n) => n.evaluation !== null);
        if (note) {
          evalData = {
            evaluation: note.evaluation,
            scoreText: note.scoreText,
            evalMark: note.evalMark,
            depth: note.depth,
            nodes: note.nodes,
            visits: note.visits,
            time: note.ms,
            botName: note.botName,
          };
          break;
        }
      }
    }
  }

  // Check ply -1 for PVs in new format (initial position)
  if (isInitialPosition && state.comments.notes[-1]) {
    const notes = state.comments.notes[-1];
    // Parse TPS to get player and move number: "board player moveNumber"
    const tpsParts = tps.split(" ");
    const tpsPlayer = tpsParts.length >= 2 ? Number(tpsParts[1]) : 1;
    const tpsMoveNumber = tpsParts.length >= 3 ? Number(tpsParts[2]) : 1;
    // Opening swap: on move 1 when both players haven't placed flats yet
    const isFirstMove = tpsMoveNumber === 1 && !bothPlayersHaveFlats(tps);
    const tpsColor =
      state.config.openingSwap && isFirstMove
        ? tpsPlayer === 1
          ? 2
          : 1
        : tpsPlayer;
    for (const note of notes) {
      if (note.pvAfter !== null) {
        const noteIndex = notes.indexOf(note);
        for (let pvIndex = 0; pvIndex < note.pvAfter.length; pvIndex++) {
          const pvArray = note.pvAfter[pvIndex];
          const pv = parsePV(tpsPlayer, tpsColor, pvArray);
          const suggestion = {
            ply: pv.splice(0, 1)[0],
            followingPlies: pv,
            evaluation: note.evaluation !== null ? note.evaluation : null,
            scoreText: note.scoreText !== null ? note.scoreText : null,
            evalMark: note.evalMark !== null ? note.evalMark : null,
            depth: note.depth !== null ? note.depth : null,
            nodes: note.nodes !== null ? note.nodes : null,
            visits: note.visits !== null ? note.visits : null,
            time: note.ms !== null ? note.ms : null,
            botName: note.botName !== null ? note.botName : null,
            fromNotes: true,
            source: { plyID: -1, noteIndex, pvIndex, format: "pvAfter" },
          };
          results.push(suggestion);
        }
      }
    }
  }

  // Find all PVs in new format (pvAfter on ply whose tpsAfter matches tps)
  const afterIDs = afterIndex[tps];
  if (afterIDs) {
    for (let i = 0; i < afterIDs.length; i++) {
      const id = afterIDs[i];
      const notes = state.comments.notes[id];
      const ply = state.ptn.allPlies[id];
      if (!notes || !ply) continue;
      // Find all notes with pvAfter (new format)
      for (const note of notes) {
        if (note.pvAfter !== null) {
          // Determine player/color for the position after this ply
          const nextPlayer = ply.player === 1 ? 2 : 1;
          // Parse TPS to get move number for opening swap check
          const tpsParts = tps.split(" ");
          const tpsMoveNumber = tpsParts.length >= 3 ? Number(tpsParts[2]) : 1;
          const isFirstMove = tpsMoveNumber === 1 && !bothPlayersHaveFlats(tps);
          const nextColor =
            state.config.openingSwap && isFirstMove
              ? nextPlayer === 1
                ? 2
                : 1
              : nextPlayer;
          // Each note.pvAfter can contain multiple PV arrays
          const noteIndex = notes.indexOf(note);
          for (let pvIndex = 0; pvIndex < note.pvAfter.length; pvIndex++) {
            const pvArray = note.pvAfter[pvIndex];
            const pv = parsePV(nextPlayer, nextColor, pvArray);
            const suggestion = {
              ply: pv.splice(0, 1)[0],
              followingPlies: pv,
              // New format: eval/stats are in the same comment
              evaluation: note.evaluation !== null ? note.evaluation : null,
              scoreText: note.scoreText !== null ? note.scoreText : null,
              evalMark: note.evalMark !== null ? note.evalMark : null,
              depth: note.depth !== null ? note.depth : null,
              nodes: note.nodes !== null ? note.nodes : null,
              visits: note.visits !== null ? note.visits : null,
              time: note.ms !== null ? note.ms : null,
              botName: note.botName !== null ? note.botName : null,
              fromNotes: true,
              // Source tracking for deletion
              source: { plyID: id, noteIndex, pvIndex, format: "pvAfter" },
            };
            results.push(suggestion);
          }
        }
      }
    }
  }

  // Check ply -1 for PVs in old format (initial position)
  if (isInitialPosition && state.comments.notes[-1]) {
    const notes = state.comments.notes[-1];
    // Parse TPS to get player and move number: "board player moveNumber"
    const tpsPartsOld = tps.split(" ");
    const tpsPlayerOld = tpsPartsOld.length >= 2 ? Number(tpsPartsOld[1]) : 1;
    const tpsMoveNumberOld =
      tpsPartsOld.length >= 3 ? Number(tpsPartsOld[2]) : 1;
    // Opening swap: on move 1 when both players haven't placed flats yet
    const isFirstMoveOld = tpsMoveNumberOld === 1 && !bothPlayersHaveFlats(tps);
    const tpsColorOld =
      state.config.openingSwap && isFirstMoveOld
        ? tpsPlayerOld === 1
          ? 2
          : 1
        : tpsPlayerOld;
    for (const note of notes) {
      if (note.pv !== null) {
        const noteIndex = notes.indexOf(note);
        for (let pvIndex = 0; pvIndex < note.pv.length; pvIndex++) {
          const pvArray = note.pv[pvIndex];
          const pv = parsePV(tpsPlayerOld, tpsColorOld, pvArray);
          const suggestion = {
            ply: pv.splice(0, 1)[0],
            followingPlies: pv,
            evaluation: evalData ? evalData.evaluation : null,
            scoreText: evalData ? evalData.scoreText : null,
            evalMark: note.evalMark !== null ? note.evalMark : null,
            depth: evalData ? evalData.depth : null,
            nodes: evalData ? evalData.nodes : null,
            visits: evalData ? evalData.visits : null,
            time: evalData ? evalData.time : null,
            botName: evalData ? evalData.botName : null,
            fromNotes: true,
            source: { plyID: -1, noteIndex, pvIndex, format: "pv" },
          };
          results.push(suggestion);
        }
      }
    }
  }

  // Find all PVs in old format (pv on ply whose tpsBefore matches tps)
  const beforeIDs = beforeIndex[tps];
  if (beforeIDs) {
    for (let i = 0; i < beforeIDs.length; i++) {
      const id = beforeIDs[i];
      const notes = state.comments.notes[id];
      const ply = state.ptn.allPlies[id];
      if (!notes || !ply) continue;
      // Find all notes with pv (old format)
      for (const note of notes) {
        if (note.pv !== null) {
          // Each note.pv can contain multiple PV arrays
          const noteIndex = notes.indexOf(note);
          for (let pvIndex = 0; pvIndex < note.pv.length; pvIndex++) {
            const pvArray = note.pv[pvIndex];
            const pv = parsePV(ply.player, ply.color, pvArray);
            const suggestion = {
              ply: pv.splice(0, 1)[0],
              followingPlies: pv,
              // Old format: eval is from separate comment
              evaluation: evalData ? evalData.evaluation : null,
              scoreText: evalData ? evalData.scoreText : null,
              evalMark: note.evalMark !== null ? note.evalMark : null,
              depth: evalData ? evalData.depth : null,
              nodes: evalData ? evalData.nodes : null,
              visits: evalData ? evalData.visits : null,
              time: evalData ? evalData.time : null,
              botName: evalData ? evalData.botName : null,
              fromNotes: true,
              // Source tracking for deletion
              source: { plyID: id, noteIndex, pvIndex, format: "pv" },
            };
            results.push(suggestion);
          }
        }
      }
    }
  }

  // If no PVs found but we have eval data, return a single suggestion with just eval
  if (results.length === 0 && evalData) {
    results.push({
      ply: null,
      followingPlies: [],
      evaluation: evalData.evaluation,
      scoreText: evalData.scoreText || null,
      evalMark: evalData.evalMark || null,
      depth: evalData.depth,
      nodes: evalData.nodes,
      visits: evalData.visits,
      time: evalData.time,
      botName: evalData.botName,
      fromNotes: true,
    });
  }

  return results;
};

// Convenience getter that returns the first suggestion or null
export const suggestion = (state, getters) => (tps) => {
  const all = getters.suggestions(tps);
  return all.length > 0 ? all[0] : null;
};

// Get evaluation for a TPS based on preferSavedResults and savedBotName/botID
export const evaluationForTps = (state, getters, rootState) => (tps) => {
  if (!tps) return null;

  const analysis = rootState.analysis;
  if (!analysis) return null;
  if (analysis.analysisSource === "openings") return null;

  if (analysis.preferSavedResults) {
    // Get evaluation from saved suggestions filtered by savedBotName
    const savedBotName = analysis.savedBotName;
    const allSuggestions = getters.suggestions(tps);
    const filtered =
      savedBotName === null
        ? allSuggestions.filter((s) => !s.botName)
        : allSuggestions.filter((s) => s.botName === savedBotName);
    if (filtered.length > 0 && filtered[0].evaluation != null) {
      return filtered[0].evaluation;
    }
    return null;
  } else {
    // Get evaluation from selected bot's unsaved results
    const botID = analysis.botID;
    if (analysis.botPositions && botID) {
      const botPositions = analysis.botPositions[botID];
      if (botPositions && botPositions[tps]?.[0]) {
        return botPositions[tps][0].evaluation ?? null;
      }
    }
    return null;
  }
};
