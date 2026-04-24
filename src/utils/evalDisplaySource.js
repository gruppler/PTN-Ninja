import { normalizeWDL } from "../bots/wdl";

export function getEvalNumberOrder(evalType) {
  if (evalType === "wdl") {
    return ["wdl", "cp", "advantage"];
  }
  if (evalType === "advantage") {
    return ["advantage", "cp", "wdl"];
  }
  return ["cp", "wdl", "advantage"];
}

export function isOpeningSuggestion(suggestion) {
  return !!(
    suggestion &&
    "wins1" in suggestion &&
    "wins2" in suggestion &&
    "totalGames" in suggestion
  );
}

export function getActiveEvalDisplaySource({
  analysisSource,
  suggestion,
  evaluation,
  rawWdl,
  evalNumberOrder,
}) {
  if (isOpeningSuggestion(suggestion) || analysisSource === "openings") {
    return "wdl";
  }

  const hasTerminalScore =
    suggestion &&
    suggestion.scoreText &&
    Number.isFinite(Number(suggestion.evaluation));
  if (hasTerminalScore) {
    return "terminal";
  }

  const normalizedRawWdl =
    rawWdl === undefined
      ? normalizeWDL(suggestion && suggestion.wdl, evaluation)
      : rawWdl;
  const hasRawCp = suggestion && Number.isFinite(Number(suggestion.rawCp));
  const hasRawWdl = normalizedRawWdl !== null;
  const hasEvaluation = Number.isFinite(Number(evaluation));
  const availableBySource = {
    cp: hasRawCp,
    wdl: hasRawWdl,
    advantage: hasEvaluation,
  };

  for (const source of evalNumberOrder) {
    if (availableBySource[source]) {
      return source;
    }
  }
  return null;
}

// Compute the eval text suffix to append to a ply.text for display/export,
// mirroring the logic used by Board.vue and Ply.vue so image exports match
// the HTML board view (analysis-derived eval marks + tak/tinue + manual marks).
export function computePlyEvalSuffix(
  ply,
  { showEvalMarks, evalMarkOverride } = {}
) {
  if (!ply) return "";
  const plyEval = ply.evaluation;
  const takTinue = plyEval
    ? (plyEval.tinue ? '"' : "") + (plyEval.tak ? "'" : "")
    : "";

  if (showEvalMarks && evalMarkOverride) {
    return evalMarkOverride + takTinue;
  }

  if (plyEval && (plyEval["?"] || plyEval["!"])) {
    return plyEval.text;
  }

  return takTinue;
}

export function getResolvedSavedBotID(analysis) {
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
}

// In saved mode, returns the live bot suggestion at `tps` when autosave-per-
// position is enabled and the resolved bot is currently running at `tps`.
// Otherwise returns null so callers fall back to saved/stored suggestions.
export function getLiveSuggestionInSavedMode(analysis, tps) {
  if (!analysis || analysis.analysisSource !== "saved") {
    return null;
  }

  if (!analysis.autoSaveEachPosition) {
    return null;
  }

  const resolvedBotID = getResolvedSavedBotID(analysis);
  if (!resolvedBotID) {
    return null;
  }

  const botState = analysis.botStates?.[resolvedBotID];
  if (!botState || !botState.isRunning || botState.tps !== tps) {
    return null;
  }

  const liveSuggestions = analysis.botPositions?.[resolvedBotID]?.[tps] || [];
  return liveSuggestions[0] || null;
}

export function getSelectedSuggestionForTps({
  analysis,
  tps,
  currentTps,
  getSuggestionsForTps,
  context,
}) {
  if (!analysis) {
    return null;
  }

  if (analysis.analysisSource === "openings") {
    const openingMoves =
      analysis.openingPositions?.[tps] ||
      (tps === currentTps ? analysis.currentOpeningMoves || [] : []);
    return (
      openingMoves.find(
        (move) =>
          move &&
          Number(move.totalGames) > 0 &&
          normalizeWDL(move.wdl, move.evaluation) !== null
      ) || null
    );
  }

  // In saved mode with autosave-per-position, prefer the live suggestion from
  // the running bot so the eval bar mode (cp/wdl/advantage) stays consistent
  // with the live evaluation number being displayed.
  const liveSuggestion = getLiveSuggestionInSavedMode(analysis, tps);
  if (liveSuggestion) {
    return liveSuggestion;
  }

  if (analysis.preferSavedResults) {
    const savedBotName = analysis.savedBotName;
    const allSuggestions = getSuggestionsForTps
      ? getSuggestionsForTps(tps, context) || []
      : [];
    const filtered =
      savedBotName === null
        ? allSuggestions.filter((s) => !s.botName)
        : allSuggestions.filter((s) => s.botName === savedBotName);
    return filtered[0] || null;
  }

  const botID = analysis.botID;
  if (analysis.botPositions && botID) {
    return analysis.botPositions[botID]?.[tps]?.[0] || null;
  }

  return null;
}
