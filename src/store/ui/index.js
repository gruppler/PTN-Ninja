import state from "./state";
import * as getters from "./getters";
import * as mutations from "./mutations";
import * as actions from "./actions";

export default {
  namespaced: false,
  getters,
  mutations,
  actions,
  state,
};
