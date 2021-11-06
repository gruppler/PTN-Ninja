import { LocalStorage, Platform } from "quasar";
import Game from "../../Game";

const state = {
  board: null,
  comments: null,
  config: null,
  history: null,
  historyIndex: 0,
  list: [],
  position: null,
  ptn: null,
  selected: null,
};

const load = (key, initial) =>
  LocalStorage.has(key) ? LocalStorage.getItem(key) : initial;

if (!Platform.within.iframe && LocalStorage.has("games")) {
  state.list = LocalStorage.getItem("games").map((name) => {
    const ptn = load("ptn-" + name);
    let state = load("state-" + name);
    if (ptn && (!state || !state.tps || !state.ply)) {
      // Backward compatibility
      state = new Game({ ptn, state }).minState;
      LocalStorage.set("state-" + name, state);
    }
    return {
      name,
      ptn,
      state,
      config: load("config-" + name) || {},
      history: load("history-" + name),
      historyIndex: load("historyIndex-" + name),
    };
  });
}

export default state;
