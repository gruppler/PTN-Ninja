import Vue from "vue";
import { parseURLparams } from "../../router/routes";
import router from "../../router";
import { parsePV } from "../../utilities";
import { normalizeWDL } from "../../bots/wdl";
import { bothPlayersHaveFlats } from "../../Game/PTN/TPS";
const hasProtectedMainlineInState = (state) =>
  Boolean(state.config && state.config.playtakLive && state.config.playtakID);

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

export const hasProtectedMainline = (state) =>
  Vue.prototype.$game
    ? Vue.prototype.$game.hasProtectedMainline()
    : hasProtectedMainlineInState(state);

export const canTrimToBoard = (state) =>
  Vue.prototype.$game
    ? !Vue.prototype.$game.getProtectedMainlinePlies().length
    : !hasProtectedMainlineInState(state);
export const canTrimToPly = (state) =>
  Vue.prototype.$game
    ? !Vue.prototype.$game.getProtectedMainlinePlies().length
    : !hasProtectedMainlineInState(state);

export const canDeleteBranch = (state) => (branch) => {
  if (!hasProtectedMainline(state)) {
    return true;
  }
  return Boolean(branch && String(branch).trim());
};

export const protectedMainlinePlyIDs = (state) =>
  Vue.prototype.$game ? Vue.prototype.$game.getProtectedMainlinePlyIDs() : [];

export const isProtectedMainlinePly = (state, getters) => (plyID) => {
  if (Vue.prototype.$game) {
    return Vue.prototype.$game.isProtectedMainlinePly(plyID);
  }

  const parsedPlyID = parseInt(plyID, 10);
  if (!Number.isFinite(parsedPlyID)) {
    return false;
  }
  return getters.protectedMainlinePlyIDs.includes(parsedPlyID);
};

export const canUndoWithMainlinePreserved = (state) => {
  const game = Vue.prototype.$game;
  if (!hasProtectedMainline(state)) {
    return true;
  }

  if (game && typeof game.canUndoWithMainlinePreserved === "function") {
    return game.canUndoWithMainlinePreserved();
  }

  if (!(state.historyIndex > 0)) {
    return false;
  }
  return true;
};

export const canEditCurrentPTN = (state) =>
  Vue.prototype.$game
    ? !Vue.prototype.$game.getProtectedMainlinePlies().length
    : !hasProtectedMainlineInState(state);

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

export const suggestions =
  (state, getters) =>
  (tps, context = {}) => {
    if (!tps) {
      return [];
    }

    const contextPreferredPlyID =
      context &&
      context.preferredPlyID !== undefined &&
      context.preferredPlyID !== null
        ? String(context.preferredPlyID)
        : null;
    const currentPositionPreferredPlyID =
      state.position &&
      state.position.tps === tps &&
      state.position.boardPly &&
      state.position.boardPly.id !== undefined &&
      state.position.boardPly.id !== null
        ? String(state.position.boardPly.id)
        : null;
    const preferredPlyID =
      contextPreferredPlyID || currentPositionPreferredPlyID;
    const prioritizePreferredPlyID = (ids = []) => {
      if (!preferredPlyID || !ids || ids.length < 2) {
        return ids;
      }
      const preferred = [];
      const others = [];
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i]) === preferredPlyID) {
          preferred.push(ids[i]);
        } else {
          others.push(ids[i]);
        }
      }
      return preferred.length ? preferred.concat(others) : ids;
    };

    const results = [];
    let evalData = null;
    const hasEvalPayload = (note) =>
      !!note &&
      (note.evaluation !== null ||
        note.wdl !== null ||
        note.rawCp !== null ||
        note.scoreText !== null);
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
      const note = notes.find((n) => hasEvalPayload(n));
      if (note) {
        evalData = {
          evaluation: note.evaluation,
          wdl: note.wdl,
          rawCp: note.rawCp,
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
      const matchingIDs = prioritizePreferredPlyID(afterIndex[tps]);
      if (matchingIDs) {
        for (let i = 0; i < matchingIDs.length; i++) {
          const id = matchingIDs[i];
          const notes = state.comments.notes[id];
          if (!notes) continue;
          const note = notes.find((n) => hasEvalPayload(n));
          if (note) {
            evalData = {
              evaluation: note.evaluation,
              wdl: note.wdl,
              rawCp: note.rawCp,
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
              wdl: note.wdl !== null ? note.wdl : null,
              rawCp: note.rawCp !== null ? note.rawCp : null,
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
    const afterIDs = prioritizePreferredPlyID(afterIndex[tps]);
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
            const tpsMoveNumber =
              tpsParts.length >= 3 ? Number(tpsParts[2]) : 1;
            const isFirstMove =
              tpsMoveNumber === 1 && !bothPlayersHaveFlats(tps);
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
                wdl: note.wdl !== null ? note.wdl : null,
                rawCp: note.rawCp !== null ? note.rawCp : null,
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
      const isFirstMoveOld =
        tpsMoveNumberOld === 1 && !bothPlayersHaveFlats(tps);
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
              wdl: evalData ? evalData.wdl : null,
              rawCp: evalData ? evalData.rawCp : null,
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
    const beforeIDs = prioritizePreferredPlyID(beforeIndex[tps]);
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
                wdl: evalData ? evalData.wdl : null,
                rawCp: evalData ? evalData.rawCp : null,
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
        wdl: evalData.wdl || null,
        rawCp: evalData.rawCp ?? null,
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
export const suggestion =
  (state, getters) =>
  (tps, context = {}) => {
    const all = getters.suggestions(tps, context);
    return all.length > 0 ? all[0] : null;
  };

const getResolvedSavedBotID = (analysis) => {
  if (!analysis) return null;
  const savedBotName = analysis.savedBotName;
  if (!savedBotName) {
    return analysis.botID;
  }

  const activeBots = analysis.activeBots || [];
  const botList = analysis.botList || [];
  for (const id of activeBots) {
    const option = botList.find((b) => b && b.value === id);
    if (option && option.label === savedBotName) {
      return id;
    }
  }

  return analysis.botID;
};

const getLiveSuggestionInSavedMode = (analysis, tps, currentTPS = null) => {
  if (!analysis || analysis.analysisSource !== "saved") {
    return null;
  }

  if (!analysis.autoSaveEachPosition && currentTPS !== tps) {
    return null;
  }

  const resolvedBotID = getResolvedSavedBotID(analysis);
  if (!resolvedBotID) {
    return null;
  }

  const botState = analysis.botStates?.[resolvedBotID];
  const isRunningCurrentTPS =
    botState && botState.isRunning && botState.tps === tps;
  if (!isRunningCurrentTPS) {
    return null;
  }

  const liveSuggestions = analysis.botPositions?.[resolvedBotID]?.[tps] || [];
  return liveSuggestions[0] || null;
};

// Get evaluation for a TPS based on preferSavedResults and savedBotName/botID
export const evaluationForTps =
  (state, getters, rootState) =>
  (tps, context = {}) => {
    if (!tps) return null;

    const analysis = rootState.analysis;
    if (!analysis) return null;
    if (analysis.analysisSource === "openings") {
      const openingMoves =
        analysis.openingPositions?.[tps] ||
        (tps === state.position.tps ? analysis.currentOpeningMoves || [] : []);
      const topMove = openingMoves.find(
        (move) =>
          move &&
          Number(move.totalGames) > 0 &&
          normalizeWDL(move.wdl, move.evaluation) !== null
      );
      if (topMove) {
        return topMove.evaluation ?? null;
      }
      return null;
    }

    const liveSuggestion = getLiveSuggestionInSavedMode(
      analysis,
      tps,
      state.position?.tps
    );
    if (liveSuggestion && liveSuggestion.evaluation != null) {
      return liveSuggestion.evaluation;
    }

    if (analysis.preferSavedResults) {
      // Get evaluation from saved suggestions filtered by savedBotName
      const savedBotName = analysis.savedBotName;
      const allSuggestions = getters.suggestions(tps, context);
      const filtered =
        savedBotName === null
          ? allSuggestions.filter((s) => !s.botName)
          : allSuggestions.filter((s) => s.botName === savedBotName);
      if (filtered.length > 0 && filtered[0].evaluation != null) {
        return filtered[0].evaluation;
      }
      return null;
    }

    // Get evaluation from selected bot's unsaved results
    const botID = analysis.botID;
    if (analysis.botPositions && botID) {
      const botPositions = analysis.botPositions[botID];
      if (botPositions && botPositions[tps]?.[0]) {
        return botPositions[tps][0].evaluation ?? null;
      }
    }
    return null;
  };

// Get WDL percentages for a TPS based on preferSavedResults and savedBotName/botID
export const wdlForTps =
  (state, getters, rootState) =>
  (tps, context = {}) => {
    if (!tps) return null;

    const analysis = rootState.analysis;
    if (!analysis) return null;
    if (analysis.analysisSource === "openings") {
      const openingMoves =
        analysis.openingPositions?.[tps] ||
        (tps === state.position.tps ? analysis.currentOpeningMoves || [] : []);
      const topMove = openingMoves.find(
        (move) =>
          move &&
          Number(move.totalGames) > 0 &&
          normalizeWDL(move.wdl, move.evaluation) !== null
      );
      if (topMove) {
        return normalizeWDL(topMove.wdl, topMove.evaluation);
      }
      return null;
    }

    const normalizeSuggestion = (suggestion) => {
      if (!suggestion) {
        return null;
      }
      return normalizeWDL(suggestion.wdl, suggestion.evaluation);
    };

    const liveSuggestion = getLiveSuggestionInSavedMode(
      analysis,
      tps,
      state.position?.tps
    );
    const liveWdl = normalizeSuggestion(liveSuggestion);
    if (liveWdl !== null) {
      return liveWdl;
    }

    if (analysis.preferSavedResults) {
      const savedBotName = analysis.savedBotName;
      const allSuggestions = getters.suggestions(tps, context);
      const filtered =
        savedBotName === null
          ? allSuggestions.filter((s) => !s.botName)
          : allSuggestions.filter((s) => s.botName === savedBotName);
      return normalizeSuggestion(filtered[0] || null);
    }

    const botID = analysis.botID;
    if (analysis.botPositions && botID) {
      const botPositions = analysis.botPositions[botID];
      if (botPositions && botPositions[tps]?.[0]) {
        return normalizeSuggestion(botPositions[tps][0]);
      }
    }
    return null;
  };
