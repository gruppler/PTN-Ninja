import { bots } from "../../bots";
import { defaultEvalMarkThresholds } from "../../bots/bot";
import { pliesEqual } from "../../Game/PTN/Ply";

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

  // Skip if the move made matches the bot's top suggestion
  const topSuggestion = positionBefore[0];
  if (topSuggestion.ply && pliesEqual(ply, topSuggestion.ply)) {
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

  if (scoreLoss > thresholds.brilliant) {
    return "!!";
  } else if (scoreLoss > thresholds.good) {
    return "!";
  } else if (scoreLoss > thresholds.bad) {
    return null;
  } else if (scoreLoss > thresholds.blunder) {
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

// Returns a function that calculates eval mark for a ply given current bot positions
// This allows the component to call it with the ply and get reactive updates
// For saved results: returns the eval mark stored in the PTN comment (static)
// For live results: computes dynamically from thresholds
export const getEvalMarkOverride =
  (state, getters, rootState, rootGetters) => (ply) => {
    if (!ply) return null;

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
