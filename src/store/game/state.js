import { LocalStorage, Platform } from "quasar";
import Game from "../../Game";
import { uniq } from "lodash";

const state = {
  error: null,
  board: null,
  comments: null,
  config: null,
  history: null,
  historyIndex: 0,
  list: [],
  position: null,
  ptn: null,
  selected: null,
  editingTPS: undefined,
  hlSquares: [],
};

const load = (key, initial) =>
  LocalStorage.has(key) ? LocalStorage.getItem(key) : initial;

if (!Platform.within.iframe && LocalStorage.has("games")) {
  state.list = uniq(LocalStorage.getItem("games")).map((name) => {
    const ptn = load("ptn-" + name);
    let state = load("state-" + name);
    if (ptn && (!state || !state.tps || !("ply" in state))) {
      // Backward compatibility
      try {
        state = new Game({ ptn, state }).minState;
        LocalStorage.set("state-" + name, state);
      } catch (error) {
        console.error("Error parsing " + name, error);
      }
    }
    return {
      name,
      ptn,
      state,
      config: load("config-" + name) || {},
      history: load("history-" + name),
      historyIndex: load("historyIndex-" + name),
      editingTPS: load("editingTPS-" + name),
    };
  });
}

export default state;
