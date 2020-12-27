import Vue from "vue";
import Vuex from "vuex";

import ui from "./ui";

Vue.use(Vuex);

const Store = new Vuex.Store({
  ...ui,

  // enable strict mode (adds overhead!)
  // for dev mode only
  strict: process.env.DEV,
});

export default Store;
