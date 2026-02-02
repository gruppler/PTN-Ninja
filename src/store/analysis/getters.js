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

// Returns a function that calculates eval mark for a ply given current bot positions
// This allows the component to call it with the ply and get reactive updates
export const getEvalMarkOverride = (state) => (ply) => {
  if (!ply) return null;

  const botID = state.botID;
  const thresholds = state.evalMarkThresholds || defaultEvalMarkThresholds;
  const positions = botID ? state.botPositions[botID] : null;

  if (!positions || Object.keys(positions).length === 0) {
    return null;
  }

  return calculateEvalMark(ply, positions, thresholds);
};
