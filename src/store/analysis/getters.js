import { bots } from "../../bots";
import { defaultEvalMarkThresholds, calculateEvalMark } from "../../bots/bot";
import { computePlyEvalSuffix } from "../../utils/evalDisplaySource";

export const bot = (state) => {
  return bots[state.botID];
};

// Detect result-inferred eval notes (e.g., {+1} from game result)
// These have only an evaluation value with no engine-quality data
const isResultInferredNote = (note, plyID, allPlies) => {
  const ply = allPlies && allPlies[plyID];
  if (!ply || !ply.result || ply.result.type === "1") return false;
  return (
    note.depth === null &&
    note.rawCp === null &&
    note.wdl === null &&
    note.nodes === null &&
    note.scoreText === null &&
    note.pv === null &&
    note.pvAfter === null
  );
};

// Whether there are any actual saved analysis results in the current game's notes
export const hasAnySavedResults = (state, getters, rootState) => {
  const comments = rootState.game && rootState.game.comments;
  const notes = comments && comments.notes;
  if (!notes) return false;
  const allPlies =
    rootState.game && rootState.game.ptn && rootState.game.ptn.allPlies;
  for (const id in notes) {
    const noteList = notes[id];
    for (let i = 0; i < noteList.length; i++) {
      const note = noteList[i];
      if (
        note.evaluation !== null ||
        note.wdl !== null ||
        note.rawCp !== null ||
        note.scoreText !== null ||
        note.pv !== null ||
        note.pvAfter !== null
      ) {
        if (!isResultInferredNote(note, id, allPlies)) {
          return true;
        }
      }
    }
  }
  return false;
};

// Set of bot names that have actual saved results (not placeholders).
export const savedBotNamesWithResults = (state, getters, rootState) => {
  const comments = rootState.game && rootState.game.comments;
  const notes = comments && comments.notes;
  if (!notes) return new Set();

  const allPlies =
    rootState.game && rootState.game.ptn && rootState.game.ptn.allPlies;
  const botNameSet = new Set();
  for (const id in notes) {
    const noteList = notes[id];
    for (let i = 0; i < noteList.length; i++) {
      const note = noteList[i];
      if (
        note.evaluation !== null ||
        note.wdl !== null ||
        note.rawCp !== null ||
        note.scoreText !== null ||
        note.pv !== null ||
        note.pvAfter !== null
      ) {
        if (!isResultInferredNote(note, id, allPlies)) {
          botNameSet.add(note.botName !== undefined ? note.botName : null);
        }
      }
    }
  }
  return botNameSet;
};

// Ordered list of bot names for saved suggestions.
// Only includes names that have actual saved results.
// Follows active engine order first, then non-active names in PTN
// encounter order, then null (Other).
export const savedBotNames = (state, getters) => {
  const botNameSet = getters.savedBotNamesWithResults;
  if (botNameSet.size === 0) return [];

  const namedBots = [...botNameSet].filter((name) => name !== null);

  // Only include active bot labels that have saved results
  const activeBotLabels = [];
  (state.activeBots || []).forEach((id) => {
    const bot = bots[id];
    if (!bot || !bot.label || activeBotLabels.includes(bot.label)) return;
    if (botNameSet.has(bot.label)) {
      activeBotLabels.push(bot.label);
    }
  });

  const unmatched = namedBots.filter((name) => !activeBotLabels.includes(name));

  const result = [...activeBotLabels, ...unmatched];
  if (botNameSet.has(null)) {
    result.push(null);
  }
  return result;
};

const rawSuggestionsForTps = (state, tps, rootState, rootGetters) => {
  let rawMoves = [];

  switch (state.analysisSource) {
    case "openings":
      rawMoves =
        tps === rootState.game.position.tps
          ? state.currentOpeningMoves || []
          : [];
      break;
    case "engines": {
      const botID = state.botID;
      if (!botID) break;
      const positions = state.botPositions[botID];
      rawMoves = positions ? positions[tps] || [] : [];
      break;
    }
    case "saved": {
      // Mirror AnalysisOverlay.rawMoves saved-mode behavior so exports match
      // the HTML analysis visualization: prefer live suggestions from the
      // resolved bot when it is currently running at this tps.
      const savedBotName = state.savedBotName;
      const activeBots = state.activeBots || [];
      let resolvedBotID = state.botID;
      if (savedBotName) {
        for (const id of activeBots) {
          const bot = bots[id];
          if (bot && bot.label === savedBotName) {
            resolvedBotID = id;
            break;
          }
        }
      }

      const livePositions = resolvedBotID
        ? state.botPositions?.[resolvedBotID]
        : null;
      const liveSuggestions = livePositions ? livePositions[tps] || [] : [];

      const botState = resolvedBotID ? state.botStates?.[resolvedBotID] : null;
      const showLiveSuggestions = !!(
        botState &&
        botState.isRunning &&
        botState.tps === tps
      );

      if (showLiveSuggestions) {
        rawMoves = liveSuggestions;
        break;
      }

      const getSuggestions = rootGetters["game/suggestions"];
      const allSuggestions = getSuggestions ? getSuggestions(tps) || [] : [];
      if (allSuggestions.length === 0) {
        rawMoves = liveSuggestions;
        break;
      }

      const savedSuggestions =
        savedBotName === null
          ? allSuggestions.filter((s) => !s.botName)
          : allSuggestions.filter((s) => s.botName === savedBotName);

      rawMoves =
        savedSuggestions.length > 0 ? savedSuggestions : liveSuggestions;
      break;
    }
  }

  return rawMoves;
};

const serializeSuggestions = (rawMoves) => {
  const validMoves = rawMoves.filter((m) => m && m.ply);
  if (validMoves.length === 0) return null;

  return validMoves.map((m) => ({
    ptn: m.ply.text || m.ply.ptn,
    evaluation: m.evaluation != null ? m.evaluation : null,
    wdl: m.wdl != null ? m.wdl : null,
    rawCp: m.rawCp != null ? m.rawCp : null,
    depth: m.depth != null ? m.depth : null,
    nodes: m.nodes != null ? m.nodes : null,
    totalGames: m.totalGames != null ? m.totalGames : null,
    wins1: m.wins1 != null ? m.wins1 : null,
    wins2: m.wins2 != null ? m.wins2 : null,
    draws: m.draws != null ? m.draws : null,
  }));
};

export const pngSuggestionsForTps =
  (state, getters, rootState, rootGetters) => (tps) => {
    if (!tps) return null;
    const rawMoves = rawSuggestionsForTps(state, tps, rootState, rootGetters);
    return serializeSuggestions(rawMoves);
  };

// Returns the current analysis suggestions serialized for the PNG renderer.
// Mirrors the logic in AnalysisOverlay.rawMoves but serializes plies to PTN strings.
export const pngSuggestions = (state, getters, rootState, rootGetters) => {
  const tps = rootState.game.position.tps;
  const getSuggestionsForTps = getters.pngSuggestionsForTps;
  if (!getSuggestionsForTps) return null;
  return getSuggestionsForTps(tps);
};

// Returns the eval text suffix to append after a ply's base notation,
// combining the analysis-derived eval mark override (saved or live) with
// the ply's own tak/tinue and manual ?/! marks. Shared by Board.vue,
// Ply.vue, and PNG/SVG/GIF image exports so all renderings stay in sync.
export const plyEvalSuffix = (state, getters) => (ply) => {
  if (!ply) return "";
  const showEvalMarks = !!state.showEvalMarks;
  const evalMarkOverride = showEvalMarks
    ? getters.getEvalMarkOverride(ply)
    : null;
  return computePlyEvalSuffix(ply, { showEvalMarks, evalMarkOverride });
};

// Returns a function that calculates eval mark for a ply given current bot positions
// This allows the component to call it with the ply and get reactive updates
// For saved results: returns the eval mark stored in the PTN comment (static)
// For live results: computes dynamically from thresholds
export const getEvalMarkOverride =
  (state, getters, rootState, rootGetters) => (ply) => {
    if (!ply) return null;
    if (state.analysisSource === "openings") return null;

    if (state.preferSavedResults) {
      // Use saved eval mark from the PTN comment (does not change with thresholds)
      const getSuggestions = rootGetters["game/suggestions"];
      if (!getSuggestions) return null;

      const tpsAfter = ply.tpsAfter;
      if (!tpsAfter) return null;

      const savedBotName = state.savedBotName;
      const allSuggestions = getSuggestions(tpsAfter, {
        preferredPlyID: ply.id,
      });
      const filtered =
        savedBotName === null || savedBotName === undefined
          ? allSuggestions.filter((s) => !s.botName)
          : allSuggestions.filter((s) => s.botName === savedBotName);

      // Return the evalMark from the first matching suggestion that has one
      for (const suggestion of filtered) {
        if (suggestion.evalMark) {
          return suggestion.evalMark;
        }
      }
      return null;
    } else {
      // Use unsaved bot positions as the source (compute dynamically)
      const botID = state.botID;
      const thresholds =
        (botID &&
          state.botMetas[botID] &&
          state.botMetas[botID].evalMarkThresholds) ||
        defaultEvalMarkThresholds;
      const positions = botID ? state.botPositions[botID] : null;
      if (!positions || Object.keys(positions).length === 0) return null;
      return calculateEvalMark(ply, positions, thresholds);
    }
  };
