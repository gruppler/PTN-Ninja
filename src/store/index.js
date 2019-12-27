import Vue from "vue";
import Vuex from "vuex";
import { Platform } from "quasar";

import ui from "./ui";

let modules = {};

if (!Platform.within.iframe) {
  modules.online = import("./online");
}

Vue.use(Vuex);

export default function(/* { ssrContext } */) {
  const Store = new Vuex.Store({
    ...ui,
    modules,

    // enable strict mode (adds overhead!)
    // for dev mode only
    strict: process.env.DEV
  });

  return Store;
}
