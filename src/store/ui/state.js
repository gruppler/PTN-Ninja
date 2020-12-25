import { LocalStorage } from "quasar";
import { Platform } from "quasar";

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
  pieceShadows: !Platform.is.mobile,
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
  "playSpeed",
  "showAllBranches",
  "showControls",
  "showMove",
  "showPTN",
  "showRoads",
  "showScrubber",
  "showText",
  "theme",
  "unplayedPieces",
];

export const pngUIOptions = [
  "axisLabels",
  "flatCounts",
  "turnIndicator",
  "highlightSquares",
  "showRoads",
  "theme",
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
  size: "md",
  includeNames: true,
  pieceShadows: true,
  padding: true,
  ...pick(defaults, pngUIOptions),
};

let state = {
  embed: Platform.within.iframe,
  games: [],
  defaults,
  ...defaults,
};

const load = (key, initial) =>
  LocalStorage.has(key) ? LocalStorage.getItem(key) : initial;

if (!state.embed) {
  if (!LocalStorage.isEmpty()) {
    for (let key in state) {
      state[key] = load(key, state[key]);
    }
  }
  state.games = load("games", []).map((name) => ({
    name,
    ptn: load("ptn-" + name),
    state: load("state-" + name),
    config: load("config-" + name) || {},
    history: load("history-" + name),
    historyIndex: load("historyIndex-" + name),
  }));
}

export default state;
