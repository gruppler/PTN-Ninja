import { LocalStorage, Platform } from "quasar";
import { pick } from "lodash";
import { THEMES } from "../../themes";

let defaults = {
  offline: !navigator.onLine,
  analysisSections: {
    botSuggestions: true,
    dbMoves: true,
    dbGames: true,
  },
  dbSettings: {
    includeBotGames: false,
    player1: [],
    player2: [],
    minRating: null,
    komi: [],
    maxSuggestedMoves: 8,
    tournament: null,
    minDate: null,
    maxDate: null,
  },
  botSettings: {
    bot: "tiltak",
    maxSuggestedMoves: 8,
    depth: 12,
    timeBudget: 30,
  },
  animateBoard: true,
  animateScrub: false,
  axisLabels: true,
  board3D: false,
  boardRotation: [0, 0.65],
  boardSpace: { width: 0, height: 0 },
  boardTransform: [0, 0],
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
  orthogonal: false,
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
  showControls: true,
  showPlayButton: true,
  showEval: true,
  showHints: true,
  showMove: true,
  showPTN: true,
  showRoads: true,
  showScrubber: false,
  showText: false,
  size: "6",
  stackCounts: false,
  textTab: "notes",
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

defaults.embedConfig = {
  width: "100%",
  height: "600px",
  includeNames: false,
  state: true,
  ui: pick(defaults, embedUIOptions),
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

defaults.gifConfig = {
  plyRange: { min: 0, max: 4 },
  playSpeed: 60, //FPM
  imageSize: "md",
  textSize: "md",
  includeNames: true,
  padding: true,
  transparent: false,
  ...pick(defaults, imgUIOptions),
};
defaults.pngConfig = {
  imageSize: "md",
  textSize: "md",
  includeNames: true,
  padding: true,
  bgAlpha: 1,
  ...pick(defaults, imgUIOptions),
};

let state = {
  embed: Platform.within.iframe,
  scrubbing: false,
  thumbnails: {},
  defaults,
  ...defaults,
};

const load = (key, initial) =>
  LocalStorage.has(key) ? LocalStorage.getItem(key) : initial;

if (!state.embed && !LocalStorage.isEmpty()) {
  for (let key in defaults) {
    state[key] = load(key, state[key]);
  }
}

export default state;
