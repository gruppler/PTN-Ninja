import { LocalStorage } from "quasar";
import { Platform } from "quasar";

const defaults = {
  axisLabels: true,
  board3D: false,
  flatCounts: true,
  highlightSquares: true,
  pieceShadows: !Platform.is.mobile,
  player1: "",
  player2: "",
  showAllBranches: false,
  showControls: true,
  showPTN: true,
  showProgress: true,
  showRoads: true,
  showText: true,
  size: 5,
  textTab: "notes",
  unplayedPieces: true
};

let state = { embed: window !== window.top, games: [], defaults, ...defaults };

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