import { LocalStorage } from "quasar";
import { Platform } from "quasar";

const defaults = {
  axisLabels: true,
  board3D: false,
  flatCounts: true,
  pieceShadows: !Platform.is.mobile,
  showControls: true,
  showPTN: true,
  showProgress: true,
  showText: true,
  textTab: "notes",
  unplayedPieces: true
};

let state = { embed: false, games: [], defaults, ...defaults };

function load(key, initial) {
  return key in localStorage ? LocalStorage.getItem(key) : initial;
}

if (window === window.top) {
  for (let key in state) {
    state[key] = load(key, state[key]);
  }
}

export default state;
