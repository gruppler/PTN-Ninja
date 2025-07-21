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
  board3D: false,
  boardRotation: [0, 0.65],
  boardSize: { width: 0, height: 0 },
  boardSpace: { width: 0, height: 0 },
  boardTransform: [0, 0],
  disableBoard: false,
  disableStoneCycling: false,
  disableNavigation: false,
  disablePTN: false,
  disableText: false,
  disableUndo: false,
  editingBranch: "",
  editHeader: false,
  firstMoveNumber: 1,
  flatCounts: true,
  highlightSquares: true,
  highlighterColor: "",
  highlighterCustomColor: "",
  highlighterEnabled: false,
  highlighterSquares: {},
  isPortrait: false,
  komi: 0,
  moveNumber: true,
  evalText: true,
  nativeSharing:
    navigator.canShare && !Platform.is.desktop
      ? navigator.canShare({ text: "test", url: location.href })
      : false,
  notifyGame: true,
  notifyNotes: true,
  openDuplicate: "replace",
  orthographic: false,
  perspective: 5,
  playSpeed: 60, //FPM
  player1: "",
  player2: "",
  player: 1,
  playerName: "",
  scrollScrubbing: Platform.is.desktop,
  scrollThreshold: 0,
  selectedPiece: { color: 1, type: "F" },
  showAllBranches: false,
  showBoardPrefsBtn: false,
  showBoardTransformBtn: false,
  showControls: true,
  showPlayButton: false,
  showEval: true,
  showHeader: true,
  showHints: true,
  showMove: true,
  showPTN: true,
  showRoads: true,
  showScrubber: false,
  showToolbarAnalysis: true,
  showText: false,
  size: "6",
  stackCounts: false,
  textTab: "analysis",
  themeID: "classic",
  theme: THEMES.find((t) => t.id === "classic"),
  themes: [],
  turnIndicator: true,
  unplayedPieces: true,
};

export const embedUIOptions = [
  "axisLabels",
  "flatCounts",
  "turnIndicator",
  "highlightSquares",
  "moveNumber",
  "evalText",
  "playSpeed",
  "showAllBranches",
  "showMove",
  "showControls",
  "showPlayButton",
  "showPTN",
  "showRoads",
  "showScrubber",
  "showText",
  "stackCounts",
  "themeID",
  "unplayedPieces",
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
  "flatCounts",
  "turnIndicator",
  "highlightSquares",
  "moveNumber",
  "evalText",
  "showRoads",
  "stackCounts",
  "themeID",
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
