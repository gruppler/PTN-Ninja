import { LocalStorage } from "quasar";
import { Platform } from "quasar";

import { pick } from "lodash";

let defaults = {
  animateBoard: true,
  axisLabels: true,
  board3D: false,
  boardRotation: [0.5790436572786892, 0.4425154402869453],
  editingTPS: "",
  editingBranch: "",
  firstMoveNumber: 1,
  flatCounts: true,
  highlightSquares: true,
  isEditingTPS: false,
  isPortrait: false,
  notifyGame: true,
  notifyNotes: true,
  pieceShadows: !Platform.is.mobile,
  playSpeed: 60, //BPM
  player1: "",
  player2: "",
  selectedPiece: { color: 1, type: "F" },
  showAllBranches: false,
  showControls: true,
  showMove: true,
  showPTN: false,
  showRoads: true,
  showScrubber: true,
  showText: false,
  size: 5,
  textTab: "notes",
  unplayedPieces: true
};

const embedUIOptions = [
  "axisLabels",
  "flatCounts",
  "highlightSquares",
  "playSpeed",
  "showAllBranches",
  "showControls",
  "showMove",
  "showRoads",
  "showScrubber",
  "unplayedPieces"
];

defaults.embedConfig = {
  width: "100%",
  height: "600px",
  state: true,
  ui: pick(defaults, embedUIOptions)
};

let state = {
  embed: Platform.within.iframe,
  games: [],
  defaults,
  ...defaults
};

const load = (key, initial) =>
  LocalStorage.has(key) ? LocalStorage.getItem(key) : initial;

if (!state.embed) {
  if (!LocalStorage.isEmpty()) {
    for (let key in state) {
      state[key] = load(key, state[key]);
    }
  }
  state.games = load("games", []).map(name => ({
    name,
    ptn: load("ptn-" + name),
    state: load("state-" + name),
    options: load("options-" + name) || {},
    history: load("history-" + name),
    historyIndex: load("historyIndex-" + name)
  }));
}

export default state;
