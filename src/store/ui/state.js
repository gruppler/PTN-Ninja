import { LocalStorage } from "quasar";
import { Platform } from "quasar";

const defaults = {
  axisLabels: true,
  board3D: false,
  flatCounts: true,
  highlightSquares: true,
  notifyNotes: true,
  pieceShadows: !Platform.is.mobile,
  playSpeed: 60, //BPM
  player1: "",
  player2: "",
  showAllBranches: false,
  showControls: true,
  showMove: true,
  showPTN: true,
  showRoads: true,
  showScrubber: true,
  showText: false,
  size: 5,
  textTab: "notes",
  unplayedPieces: true
};

let state = { embed: false, games: [], defaults, ...defaults };

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
    state: load("state-" + name)
  }));
}

export default state;
