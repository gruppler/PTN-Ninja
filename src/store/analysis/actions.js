import { LocalStorage } from "quasar";
import { notifyError } from "../../utilities";

export const SET = ({ state, commit }, [key, value]) => {
  if (key in state.defaults) {
    try {
      LocalStorage.set(key, value);
    } catch (error) {
      if (error.code === 22) {
        error = "localstorageFull";
      }
      notifyError(error);
    }
    commit("SET", [key, value]);
  }
};
