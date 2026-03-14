import { bots } from "../../bots";
import { defaultEvalMarkThresholds } from "../../bots/bot";

export const bot = (state) => {
  return bots[state.botID];
};

// Calculate eval mark for a single ply based on bot positions
const calculateEvalMark = (ply, positions, thresholds) => {
  // Skip first two plies (opening moves) - no meaningful "before" to compare
  const tpsParts = ply.tpsBefore ? ply.tpsBefore.split(" ") : [];
  const moveNumber = tpsParts.length >= 3 ? Number(tpsParts[2]) : 0;
  if (moveNumber <= 1) {
    return null;
  }

  // Skip if this is the first ply in the game (no previous ply to compare against)
  if (!ply.index) {
    return null;
  }

  const positionBefore = positions[ply.tpsBefore];
  const positionAfter = positions[ply.tpsAfter];

  if (!positionBefore || !positionAfter) {
    return null;
  }
  if (!positionBefore[0] || !positionAfter[0]) {
    return null;
  }

  const rawEvalBefore = positionBefore[0].evaluation;
  const rawEvalAfter = positionAfter[0].evaluation;

  if (rawEvalBefore === null || rawEvalAfter === null) {
    return null;
  }

  const evalBefore = Math.round(100 * rawEvalBefore) / 1e4;
  const evalAfter = Math.round(100 * rawEvalAfter) / 1e4;

  const scoreLoss =
    ply.player === 1 ? evalAfter - evalBefore : evalBefore - evalAfter;

  // Thresholds are stored at 2x scale; halve them so displayed values
  // match actual eval percentage-point differences.
  if (scoreLoss > thresholds.brilliant / 2) {
    return "!!";
  } else if (scoreLoss > thresholds.good / 2) {
    return "!";
  } else if (scoreLoss > thresholds.bad / 2) {
    return null;
  } else if (scoreLoss > thresholds.blunder / 2) {
    return "?";
  } else {
    return "??";
  }
};

// Ordered list of bot names from saved suggestions.
// Active bots first (in activeBots order), then unmatched names (PTN encounter order), then null (Other).
export const savedBotNames = (state, getters, rootState) => {
  const comments = rootState.game && rootState.game.comments;
  const notes = comments && comments.notes;
  if (!notes) return [];

  const botNameSet = new Set();
  for (const id in notes) {
    const noteList = notes[id];
    for (let i = 0; i < noteList.length; i++) {
      const note = noteList[i];
      if (
        note.evaluation !== null ||
        note.pv !== null ||
        note.pvAfter !== null
      ) {
        botNameSet.add(note.botName !== undefined ? note.botName : null);
      }
    }
  }

  const namedBots = [...botNameSet].filter((name) => name !== null);

  const activeBotLabels = {};
  (state.activeBots || []).forEach((id, idx) => {
    const bot = bots[id];
    if (bot) activeBotLabels[bot.label] = idx;
  });

  const matched = namedBots.filter((name) => name in activeBotLabels);
  const unmatched = namedBots.filter((name) => !(name in activeBotLabels));
  matched.sort((a, b) => activeBotLabels[a] - activeBotLabels[b]);

  const result = [...matched, ...unmatched];
  if (botNameSet.has(null)) {
    result.push(null);
  }
  return result;
};

// Returns the current analysis suggestions serialized for the PNG renderer.
// Mirrors the logic in AnalysisOverlay.rawMoves but serializes plies to PTN strings.
export const pngSuggestions = (state, getters, rootState, rootGetters) => {
  const tps = rootState.game.position.tps;
  let rawMoves = [];

  switch (state.analysisSource) {
    case "openings":
      rawMoves = state.currentOpeningMoves || [];
      break;
    case "engines": {
      const botID = state.botID;
      if (!botID) break;
      const positions = state.botPositions[botID];
      rawMoves = positions ? positions[tps] || [] : [];
      break;
    }
    case "saved": {
      const getSuggestions = rootGetters["game/suggestions"];
      if (!getSuggestions) break;
      const allSuggestions = getSuggestions(tps);
      if (!allSuggestions || allSuggestions.length === 0) break;
      const savedBotName = state.savedBotName;
      if (savedBotName === null) {
        rawMoves = allSuggestions.filter((s) => !s.botName);
      } else {
        rawMoves = allSuggestions.filter((s) => s.botName === savedBotName);
      }
      break;
    }
  }

  const validMoves = rawMoves.filter((m) => m && m.ply);
  if (validMoves.length === 0) return null;

  return validMoves.map((m) => ({
    ptn: m.ply.text || m.ply.ptn,
    evaluation: m.evaluation != null ? m.evaluation : null,
    depth: m.depth != null ? m.depth : null,
    nodes: m.nodes != null ? m.nodes : null,
    totalGames: m.totalGames != null ? m.totalGames : null,
    wins1: m.wins1 != null ? m.wins1 : null,
    wins2: m.wins2 != null ? m.wins2 : null,
    draws: m.draws != null ? m.draws : null,
  }));
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
      const allSuggestions = getSuggestions(tpsAfter);
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
      const thresholds = state.evalMarkThresholds || defaultEvalMarkThresholds;
      const botID = state.botID;
      const positions = botID ? state.botPositions[botID] : null;
      if (!positions || Object.keys(positions).length === 0) return null;
      return calculateEvalMark(ply, positions, thresholds);
    }
  };
