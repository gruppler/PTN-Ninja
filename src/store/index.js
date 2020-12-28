import Vue from "vue";
import Vuex from "vuex";

import ui from "./ui";
import game from "./game";

Vue.use(Vuex);

const Store = new Vuex.Store({
  modules: {
    ui,
    game,
  },

  // enable strict mode (adds overhead!)
  // for dev mode only
  strict: process.env.DEV,
});

export default Store;
