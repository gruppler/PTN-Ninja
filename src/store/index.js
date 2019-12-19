import Vue from "vue";
import Vuex from "vuex";

import ui from "./ui";
import online from "./online";

Vue.use(Vuex);

export default function(/* { ssrContext } */) {
  const Store = new Vuex.Store({
    ...ui,
    modules: {
      online
    },

    // enable strict mode (adds overhead!)
    // for dev mode only
    strict: process.env.DEV
  });

  return Store;
}
