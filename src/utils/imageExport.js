import { cloneDeep, isEqual } from "lodash";
import { defaults } from "tps-ninja/src/options.js";
import { themeForExport } from "../themes";
import {
  getActiveEvalDisplaySource,
  getEvalNumberOrder,
  getSelectedSuggestionForTps,
} from "./evalDisplaySource";

// The image of the current position is made three ways: the quick download,
// the export dialog and the image link. All three are built from the options
// made here, so that they draw the same picture.

const TAGS = ["caps", "flats", "caps1", "flats1", "caps2", "flats2"];

// The evaluation shown beside the board, as the board itself shows it
const evalBarOptions = ({ state, getters }) => {
  const { position } = state.game;
  const analysis = state.analysis;
  const tps = (position.boardPly && position.boardPly.tpsAfter) || position.tps;
  const getSuggestionsForTps = getters["analysis/pngSuggestionsForTps"];
  const getWdlForTps = getters["game/wdlForTps"];
  const bar = {
    evaluation: getters["game/evaluationForTps"](tps),
    wdl: getWdlForTps ? getWdlForTps(tps) : null,
    wins1: null,
    draws: null,
    wins2: null,
  };

  const selected = getSelectedSuggestionForTps({
    analysis,
    tps,
    currentTps: position.tps,
    getSuggestionsForTps: getters["game/suggestions"],
  });
  const source = getActiveEvalDisplaySource({
    analysisSource: analysis && analysis.analysisSource,
    suggestion: selected,
    evaluation: bar.evaluation,
    evalNumberOrder: getEvalNumberOrder(analysis && analysis.evalType),
  });
  bar.evalBarMode = source === "wdl" ? "wdl" : "single";

  // Without a saved evaluation, fall back on the best suggestion's
  const best = getSuggestionsForTps
    ? (getSuggestionsForTps(tps) || [])[0] || null
    : null;
  if (bar.evaluation === null && getSuggestionsForTps) {
    bar.evaluation = (best && best.evaluation) ?? null;
  }
  if ((bar.wdl === null || bar.wdl === undefined) && getSuggestionsForTps) {
    bar.wdl = (best && best.wdl) ?? null;
    if (
      (!bar.wdl || typeof bar.wdl !== "object") &&
      best &&
      (best.wins1 != null || best.draws != null || best.wins2 != null)
    ) {
      bar.wins1 = best.wins1 ?? null;
      bar.draws = best.draws ?? null;
      bar.wins2 = best.wins2 ?? null;
    }
  }
  return bar;
};

// The renderer's options for the current position. `store` is the root store
// (its `state` and `getters`); `config` is the image settings, the saved ones
// unless given.
export function imageOptions(store, config = store.state.ui.pngConfig) {
  const { state, getters } = store;
  const game = state.game;
  const options = {
    ...cloneDeep(config),
    font: "Roboto",
    komi: game.config.komi,
    opening: game.config.opening,
    tps: game.position.tps,
    theme: getters["ui/theme"](config.themeID),
    hlSquares: config.highlightSquares && !game.highlighterEnabled,
    hlPieces: config.highlightPieces,
    // Inverted, since the renderer draws them unless told not to
    hideFlatWinHighlights: !config.flatWinHighlights,
    transform: state.ui.boardTransform,
  };

  if (game.highlighterEnabled && Object.keys(game.highlighterSquares).length) {
    options.highlighter = game.highlighterSquares;
  }

  if (options.showAnalysisBoard) {
    const suggestions = getters["analysis/pngSuggestions"];
    if (suggestions) {
      options.suggestions = suggestions;
    }
  }

  if (options.boardEvalBar && getters["game/evaluationForTps"]) {
    Object.assign(options, evalBarOptions(store));
  }

  const { ply, plyIsDone } = game.position;
  if (ply) {
    if (plyIsDone) {
      // The renderer plays the ply itself, from the position before it
      const getSuffix = getters["analysis/plyEvalSuffix"];
      const evalSuffix = options.evalText && getSuffix ? getSuffix(ply) : "";
      options.ply = ply.text + evalSuffix;
      options.tps = ply.tpsBefore;
    } else if (options.hlSquares || options.hlPieces) {
      // The board is drawn as it stands, before this ply, so the renderer
      // needs to know the highlighted ply hasn't been played on it yet
      options.hl = ply.text;
      options.plyIsDone = false;
    }
  }

  if (options.includeNames) {
    options.player1 = game.ptn.tags.player1;
    options.player2 = game.ptn.tags.player2;
  }
  TAGS.forEach((tag) => {
    options[tag] = game.ptn.tags[tag];
  });

  return options;
}

// The options a link carries. The server draws a link's image with the same
// renderer, from these options as a query string. What isn't listed doesn't
// travel in a link: the board's rotation, highlighter squares and analysis.
const LINK_OPTIONS = [
  "tps",
  "ply",
  "hl",
  "plyIsDone",
  "hlSquares",
  "hlPieces",
  "imageSize",
  "textSize",
  "bgAlpha",
  "axisLabels",
  "flatCounts",
  "padding",
  "stackCounts",
  "showRoads",
  "moveNumber",
  "evalText",
  "turnIndicator",
  "unplayedPieces",
  "hideFlatWinHighlights",
  "komi",
  "opening",
  ...TAGS,
  "player1",
  "player2",
];

// The query string of an image link for these options, naming the file
// `name`. Whatever the renderer would assume anyway is left out.
export function imageLinkQuery(options, name) {
  const params = [];
  const add = (key, value) =>
    params.push(key + "=" + encodeURIComponent(value));

  LINK_OPTIONS.forEach((key) => {
    const value = options[key];
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !isEqual(value, defaults[key])
    ) {
      add(key, value);
    }
  });

  add("name", name);

  const theme = options.theme;
  if (theme) {
    add(
      "theme",
      theme.isBuiltIn ? theme.id : JSON.stringify(themeForExport(theme, true))
    );
  }

  return params.join("&");
}
