import { LocalStorage, Platform } from "quasar";

const state = {
  current: null,
  list: [],
};

const load = (key, initial) =>
  LocalStorage.has(key) ? LocalStorage.getItem(key) : initial;

if (!Platform.within.iframe && LocalStorage.has("games")) {
  state.list = LocalStorage.getItem("games").map((name) => ({
    name,
    ptn: load("ptn-" + name),
    state: load("state-" + name),
    config: load("config-" + name) || {},
    history: load("history-" + name),
    historyIndex: load("historyIndex-" + name),
  }));
}

export default state;
