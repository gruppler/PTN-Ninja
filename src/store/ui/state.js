import { LocalStorage, Platform } from "quasar";
import { cloneDeep, defaultsDeep, pick } from "lodash";
import { THEMES } from "../../themes";

const defaultState = {
  offline: !navigator.onLine,
  analysisSections: {
    dbMoves: true,
    dbGames: true,
    savedResults: true,
    positionNotes: true,
  },
  animateBoard: true,
  animateScrub: false,
  autoAnnotateTak: false,
  axisLabels: true,
  axisLabelsSmall: true,
  board3D: false,
  boardEvalBar: true,
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
  centerStackCounts: false,
  editHeader: false,
  editingBranch: "",
  evalText: true,
  firstMoveNumber: 1,
  flatCounts: true,
  gameTimer: true,
  hapticNavControls: true,
  highlighterColor: "",
  highlighterCustomColor: "",
  highlightSquares: true,
  inlineBranches: true,
  isPortrait: false,
  isSmallToggles: false,
  isVertical: false,
  toggleLayout: "row",
  komi: 0,
  moveNumber: true,
  nativeSharing:
    navigator.canShare && !Platform.is.desktop
      ? navigator.canShare({ text: "test", url: location.href })
      : false,
  notifyAnalysisNotes: false,
  hideAnalysisNotes: true,
  notifyGame: true,
  notifyNotes: true,
  openDuplicate: "replace",
  orthographic: false,
  perspective: 5,
  player: 1,
  player1: "",
  player2: "",
  playerName: "",
  playtakGameTypeFilter: "",
  playtakPlayerFilter: "",
  playSpeed: 60, //FPM
  scrollNavigation: Platform.is.desktop,
  scrollThreshold: 0,
  selectedPiece: { color: 1, type: "F" },
  showAllBranches: true,
  showAnalysisBoard: true,
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
  skipToEndOnLoad: true,
  showToolbarAnalysis: true,
  size: "6",
  stackCounts: false,
  textTab: "openings",
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
  "boardEvalBar",
  "disableBoard",
  "disableNavigation",
  "disablePTN",
  "disablePTNTools",
  "disableStoneCycling",
  "disableText",
  "disableUndo",
  "evalText",
  "flatCounts",
  "gameTimer",
  "highlightSquares",
  "inlineBranches",
  "moveNumber",
  "notifyAnalysisNotes",
  "notifyGame",
  "notifyNotes",
  "playSpeed",
  "showAllBranches",
  "showAnalysisBoard",
  "showBoardPrefsBtn",
  "showBoardTransformBtn",
  "showControls",
  "showEval",
  "showMove",
  "showPlayButton",
  "showPTN",
  "showRoads",
  "showScrubber",
  "showText",
  "showToolbarAnalysis",
  "stackCounts",
  "centerStackCounts",
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
  "axisLabelsSmall",
  "boardEvalBar",
  "evalText",
  "flatCounts",
  "highlightSquares",
  "moveNumber",
  "showAnalysisBoard",
  "showRoads",
  "stackCounts",
  "centerStackCounts",
  "themeID",
  "turnIndicator",
  "unplayedPieces",
];

defaultState.gifConfig = {
  plyRange: { min: 0, max: 4 },
  playSpeed: 60, //FPM
  delayAnalysis: false,
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
  svgFormat: false,
  ...pick(defaultState, imgUIOptions),
};

const state = {
  embed: Platform.within.iframe,
  collapseBranchRequest: null,
  expandBranchRequest: null,
  scrubbing: false,
  plyPreviewActive: false,
  branchMenuOpen: false,
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
if (
  state.gifConfig &&
  state.gifConfig.delayAnalysisByFrame !== undefined &&
  state.gifConfig.delayAnalysis === defaultState.gifConfig.delayAnalysis
) {
  state.gifConfig.delayAnalysis = state.gifConfig.delayAnalysisByFrame;
}
if (state.textTab === "analysis") {
  state.textTab = "notes";
}

export default state;
