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
