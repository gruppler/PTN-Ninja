import { LocalStorage, Platform } from "quasar";
import { pick } from "lodash";
import { THEMES } from "../../themes";

let defaults = {
  animateBoard: true,
  axisLabels: true,
  board3D: false,
  boardRotation: [0, 0.65],
  editingTPS: "",
  editingBranch: "",
  firstMoveNumber: 1,
  flatCounts: true,
  highlightSquares: true,
  isEditingTPS: false,
  isPortrait: false,
  notifyGame: true,
  notifyNotes: true,
  openDuplicate: "replace",
  orthogonal: false,
  perspective: 5,
  pieceShadows: true,
  playSpeed: 60, //BPM
  player1: "",
  player2: "",
  player: 1,
  playerName: "",
  selectedPiece: { color: 1, type: "F" },
  showAllBranches: false,
  showControls: true,
  showMove: true,
  showPTN: false,
  showRoads: true,
  showScrubber: true,
  showText: false,
  size: 5,
  textTab: "chat",
  themeID: "classic",
  theme: THEMES[0],
  themes: [],
  turnIndicator: true,
  unplayedPieces: true,
};

export const embedUIOptions = [
  "axisLabels",
  "flatCounts",
  "turnIndicator",
  "highlightSquares",
  "pieceShadows",
  "playSpeed",
  "showAllBranches",
  "showControls",
  "showMove",
  "showPTN",
  "showRoads",
  "showScrubber",
  "showText",
  "themeID",
  "unplayedPieces",
];

export const pngUIOptions = [
  "axisLabels",
  "flatCounts",
  "turnIndicator",
  "highlightSquares",
  "pieceShadows",
  "showRoads",
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

defaults.pngConfig = {
  imageSize: "md",
  textSize: "md",
  includeNames: true,
  padding: true,
  ...pick(defaults, pngUIOptions),
};

let state = {
  embed: Platform.within.iframe,
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
