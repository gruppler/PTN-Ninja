import { LocalStorage, Platform } from "quasar";
import { cloneDeep, defaultsDeep, pick } from "lodash";
import { THEMES } from "../../themes";

const defaultState = {
  offline: !navigator.onLine,
  analysisSections: {
    botSuggestions: false,
    dbMoves: false,
    dbGames: false,
  },
  animateBoard: true,
  animateScrub: false,
  axisLabels: true,
  axisLabelsSmall: false,
  board3D: false,
  boardRotation: [0, 0.65],
  boardSize: { width: 0, height: 0 },
  boardSpace: { width: 0, height: 0 },
  boardTransform: [0, 0],
  disableBoard: false,
  disableNavigation: false,
  disablePTN: false,
  disablePTNTools: false,
  disableStoneCycling: false,
  disableText: false,
  disableUndo: false,
  editHeader: false,
  editingBranch: "",
  evalText: true,
  firstMoveNumber: 1,
  flatCounts: true,
  hapticNavControls: true,
  highlighterColor: "",
  highlighterCustomColor: "",
  highlighterEnabled: false,
  highlighterSquares: {},
  highlightSquares: true,
  isPortrait: false,
  isVertical: false,
  komi: 0,
  moveNumber: true,
  nativeSharing:
    navigator.canShare && !Platform.is.desktop
      ? navigator.canShare({ text: "test", url: location.href })
      : false,
  notifyAnalysisNotes: true,
  notifyGame: true,
  notifyNotes: true,
  openDuplicate: "replace",
  orthographic: false,
  perspective: 5,
  player: 1,
  player1: "",
  player2: "",
  playerName: "",
  playSpeed: 60, //FPM
  scrollScrubbing: Platform.is.desktop,
  scrollThreshold: 0,
  selectedPiece: { color: 1, type: "F" },
  showAllBranches: false,
  showBoardPrefsBtn: false,
  showBoardTransformBtn: false,
  showControls: true,
  showEval: true,
  showHeader: true,
  showHints: true,
  showMove: true,
  showPlayButton: false,
  showPTN: true,
  showRoads: true,
  showScrubber: false,
  showText: false,
  showToolbarAnalysis: true,
  size: "6",
  stackCounts: false,
  textTab: "analysis",
  theme: THEMES.find((t) => t.id === "classic"),
  themeID: "classic",
  themes: [],
  turnIndicator: true,
  unplayedPieces: true,
  verticalLayout: true,
  verticalLayoutAuto: true,
};

export const embedUIOptions = [
  "axisLabels",
  "axisLabelsSmall",
  "disableBoard",
  "disableNavigation",
  "disablePTN",
  "disablePTNTools",
  "disableStoneCycling",
  "disableText",
  "disableUndo",
  "evalText",
  "flatCounts",
  "highlightSquares",
  "moveNumber",
  "notifyAnalysisNotes",
  "notifyGame",
  "notifyNotes",
  "playSpeed",
  "showAllBranches",
  "showBoardPrefsBtn",
  "showBoardTransformBtn",
  "showControls",
  "showMove",
  "showPlayButton",
  "showPTN",
  "showRoads",
  "showScrubber",
  "showText",
  "stackCounts",
  "themeID",
  "turnIndicator",
  "unplayedPieces",
  "verticalLayout",
  "verticalLayoutAuto",
];

defaultState.embedConfig = {
  width: "100%",
  height: "600px",
  includeNames: false,
  state: true,
  ui: pick(defaultState, embedUIOptions),
};

export const imgUIOptions = [
  "axisLabels",
  "evalText",
  "flatCounts",
  "highlightSquares",
  "moveNumber",
  "showRoads",
  "stackCounts",
  "themeID",
  "turnIndicator",
  "unplayedPieces",
];

defaultState.gifConfig = {
  plyRange: { min: 0, max: 4 },
  playSpeed: 60, //FPM
  imageSize: "md",
  textSize: "md",
  includeNames: true,
  padding: true,
  transparent: false,
  ...pick(defaultState, imgUIOptions),
};
defaultState.pngConfig = {
  imageSize: "md",
  textSize: "md",
  includeNames: true,
  padding: true,
  bgAlpha: 1,
  ...pick(defaultState, imgUIOptions),
};

const state = {
  embed: Platform.within.iframe,
  scrubbing: false,
  thumbnails: {},
  shortLinks: {},
  defaults: defaultState,
  ...cloneDeep(defaultState),
};

// Load from LocalStorage
const load = (key, initial) =>
  LocalStorage.has(key) ? LocalStorage.getItem(key) : initial;

if (!state.embed && !LocalStorage.isEmpty()) {
  for (let key in defaultState) {
    state[key] = load(key, state[key]);
  }
} else if (!LocalStorage.isEmpty()) {
  state.theme = load("theme", state.theme);
}

// Backward compatibility
defaultsDeep(state, defaultState);

export default state;
