import Vue from "vue";
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
    (ply.player === 1 ? evalAfter - evalBefore : evalBefore - evalAfter) / 2;

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

// Build a positions-like structure from saved notes for the two TPS values needed
const buildSavedPositions = (ply, rootGetters, savedBotName) => {
  const getSuggestions = rootGetters["game/suggestions"];
  if (!getSuggestions) return null;

  const tpsBefore = ply.tpsBefore;
  const tpsAfter = ply.tpsAfter;
  if (!tpsBefore || !tpsAfter) return null;

  const filterByBot = (allSuggestions) => {
    if (savedBotName === null || savedBotName === undefined) {
      return allSuggestions.filter((s) => !s.botName);
    }
    return allSuggestions.filter((s) => s.botName === savedBotName);
  };

  const beforeSuggestions = filterByBot(getSuggestions(tpsBefore));
  const afterSuggestions = filterByBot(getSuggestions(tpsAfter));

  if (!beforeSuggestions.length || !afterSuggestions.length) return null;

  return {
    [tpsBefore]: beforeSuggestions,
    [tpsAfter]: afterSuggestions,
  };
};

// Ordered list of bot names from saved suggestions.
// Active bots first (in activeBots order), then unmatched names (PTN encounter order), then null (Other).
export const savedBotNames = (state, getters, rootState, rootGetters) => {
  const game = rootState.game;
  const allPlies = game && game.ptn && game.ptn.allPlies;
  const getSuggestions = rootGetters["game/suggestions"];
  if (!allPlies || !getSuggestions) return [];

  const botNameSet = new Set();
  const collectBotNames = (tps) => {
    if (!tps) return;
    const suggestions = getSuggestions(tps);
    for (const s of suggestions) {
      botNameSet.add(s.botName);
    }
  };

  if (allPlies[0] && allPlies[0].tpsBefore) {
    collectBotNames(allPlies[0].tpsBefore);
  }
  for (const ply of allPlies) {
    if (ply) collectBotNames(ply.tpsAfter);
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
export const getEvalMarkOverride =
  (state, getters, rootState, rootGetters) => (ply) => {
    if (!ply) return null;

    const thresholds = state.evalMarkThresholds || defaultEvalMarkThresholds;

    if (state.preferSavedResults) {
      // Use saved notes as the source
      const positions = buildSavedPositions(
        ply,
        rootGetters,
        state.savedBotName
      );
      if (!positions) return null;
      return calculateEvalMark(ply, positions, thresholds);
    } else {
      // Use unsaved bot positions as the source
      const botID = state.botID;
      const positions = botID ? state.botPositions[botID] : null;
      if (!positions || Object.keys(positions).length === 0) return null;
      return calculateEvalMark(ply, positions, thresholds);
    }
  };
