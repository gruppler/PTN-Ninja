import { LocalStorage, Platform } from "quasar";
import { pick } from "lodash";
import { THEMES } from "../../themes";

let defaults = {
  animateBoard: true,
  animateScrub: false,
  axisLabels: true,
  board3D: false,
  boardRotation: [0, 0.65],
  boardSpace: { width: 0, height: 0 },
  boardTransform: [0, 0],
  editingBranch: "",
  firstMoveNumber: 1,
  flatCounts: true,
  highlightSquares: true,
  isPortrait: false,
  moveNumber: true,
  nativeSharing:
    navigator.canShare && !Platform.is.desktop
      ? navigator.canShare({ text: "test", url: location.href })
      : false,
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
  scrollScrubbing: Platform.is.desktop,
  scrollThreshold: 250,
  selectedPiece: { color: 1, type: "F" },
  showAllBranches: false,
  showControls: true,
  showHints: true,
  showMove: true,
  showPTN: true,
  showRoads: true,
  showScrubber: true,
  showText: false,
  size: "6",
  textTab: "chat",
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
  "pieceShadows",
  "playSpeed",
  "showAllBranches",
  "showMove",
  "showControls",
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
  "moveNumber",
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
  bgAlpha: 1,
  ...pick(defaults, pngUIOptions),
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
