import { LocalStorage } from "quasar";
import { bots } from "../../bots";
import { notifyError } from "../../utilities";
import { omit } from "lodash";

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
  return false;
};

export const SAVE_BOT = ({ state, commit }, bot) => {
  try {
    LocalStorage.set("customBots", { ...state.customBots, [bot.id]: bot });
    LocalStorage.set("botID", bot.id);
    commit("SAVE_BOT", bot);
    return true;
  } catch (error) {
    if (error.code === 22) {
      error = "localstorageFull";
    }
    notifyError(error);
    return false;
  }
};

export const DELETE_BOT = ({ state, commit, dispatch }, botID) => {
  if (botID in state.customBots) {
    try {
      LocalStorage.set("botSettings", omit(state.botSettings, botID));
      LocalStorage.set("customBots", omit(state.customBots, botID));
      commit("DELETE_BOT", botID);
      // SET_BOT(state, state.defaults.botID);
      dispatch("SET", ["botID", "tei"]);
      return true;
    } catch (error) {
      if (error.code === 22) {
        error = "localstorageFull";
      }
      notifyError(error);
    }
  }
  return false;
};

export const BOT_CONNECT = ({ state }) => {
  bots[state.botID].connect();
};

export const BOT_DISCONNECT = ({ state }) => {
  bots[state.botID].disconnect();
};
