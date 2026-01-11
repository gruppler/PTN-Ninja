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

// Active Bots management with LocalStorage persistence
const saveActiveBots = (state) => {
  try {
    LocalStorage.set("activeBots", state.activeBots);
  } catch (error) {
    if (error.code === 22) {
      error = "localstorageFull";
    }
    notifyError(error);
  }
};

export const ADD_ACTIVE_BOT = ({ state, commit }, botId = null) => {
  commit("ADD_ACTIVE_BOT", botId);
  saveActiveBots(state);
};

export const SET_ACTIVE_BOT = ({ state, commit }, { index, botId }) => {
  commit("SET_ACTIVE_BOT", { index, botId });
  saveActiveBots(state);
};

export const REMOVE_ACTIVE_BOT = ({ state, commit }, index) => {
  commit("REMOVE_ACTIVE_BOT", index);
  saveActiveBots(state);
};

export const INSERT_ACTIVE_BOT = ({ state, commit }, { index, botId }) => {
  commit("INSERT_ACTIVE_BOT", { index, botId });
  saveActiveBots(state);
};

export const REORDER_ACTIVE_BOTS = (
  { state, commit },
  { fromIndex, toIndex }
) => {
  commit("REORDER_ACTIVE_BOTS", { fromIndex, toIndex });
  saveActiveBots(state);
};
