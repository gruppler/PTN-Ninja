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
      // Remove from active bots if present
      const activeIndex = state.activeBots.indexOf(botID);
      if (activeIndex !== -1) {
        dispatch("REMOVE_ACTIVE_BOT", activeIndex);
      }
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
  saveCollapsedBots(state);
};

// Engine selection with bidirectional syncing
export const SELECT_ENGINE = (
  { state, dispatch, rootState, rootGetters },
  botId
) => {
  dispatch("SET", ["preferSavedResults", false]);
  dispatch("SET", ["analysisSource", "engines"]);
  if (botId && botId !== state.botID) {
    dispatch("SET", ["botID", botId]);
  }
  // Sync savedBotName to match the selected engine's label
  const bot = bots[botId];
  const label = bot ? bot.label : null;
  if (label) {
    const allPlies = rootState.game?.ptn?.allPlies;
    if (allPlies) {
      const getSuggestions = rootGetters["game/suggestions"];
      let found = false;
      const check = (tps) => {
        if (!tps || found) return;
        const suggestions = getSuggestions(tps);
        if (suggestions.some((s) => s.botName === label)) found = true;
      };
      if (allPlies[0] && allPlies[0].tpsBefore) {
        check(allPlies[0].tpsBefore);
      }
      for (const ply of allPlies) {
        if (ply) check(ply.tpsAfter);
      }
      if (found) {
        dispatch("SET", ["savedBotName", label]);
      }
    }
  }
};

export const SYNC_SAVED_ENGINE = ({ state, getters, dispatch }) => {
  const names = getters.savedBotNames;
  if (names.length === 0) {
    // No saved results at all - switch to engine analysis
    if (state.preferSavedResults) {
      dispatch("SET", ["preferSavedResults", false]);
    }
    return;
  }
  if (!names.includes(state.savedBotName)) {
    // Prefer the label of the currently selected engine if it has saved results
    const bot = bots[state.botID];
    const label = bot ? bot.label : null;
    if (label && names.includes(label)) {
      dispatch("SET", ["savedBotName", label]);
    } else if (names.includes(null) && !label) {
      dispatch("SET", ["savedBotName", null]);
    } else {
      dispatch("SET", ["savedBotName", names[0]]);
    }
  }
};

export const SYNC_SAVED_ENGINE_TO_CURRENT = ({ state, getters, dispatch }) => {
  const names = getters.savedBotNames;
  if (names.length === 0) {
    // No saved results — keep showing the active engine
    return;
  }
  dispatch("SET", ["preferSavedResults", true]);
  dispatch("SET", ["analysisSource", "saved"]);
  // Prefer the label of the currently selected engine if it has saved results
  const bot = bots[state.botID];
  const label = bot ? bot.label : null;
  if (label && names.includes(label)) {
    dispatch("SET", ["savedBotName", label]);
  } else if (!names.includes(state.savedBotName)) {
    // Current savedBotName is invalid, fall back
    if (names.includes(null) && !label) {
      dispatch("SET", ["savedBotName", null]);
    } else {
      dispatch("SET", ["savedBotName", names[0]]);
    }
  }
};

export const SELECT_SAVED_ENGINE = ({ state, dispatch }, botName) => {
  dispatch("SET", ["savedBotName", botName]);
  dispatch("SET", ["preferSavedResults", true]);
  dispatch("SET", ["analysisSource", "saved"]);
  // Sync botID to the engine whose label matches the saved bot name
  if (botName) {
    for (const [id, bot] of Object.entries(bots)) {
      if (bot.label === botName) {
        if (id !== state.botID) {
          dispatch("SET", ["botID", id]);
        }
        break;
      }
    }
  }
};

export const SELECT_OPENINGS = ({ dispatch }) => {
  dispatch("SET", ["analysisSource", "openings"]);
};

// Collapsed bots persistence
const saveCollapsedBots = (state) => {
  try {
    LocalStorage.set("collapsedBots", state.collapsedBots);
  } catch (error) {
    if (error.code === 22) {
      error = "localstorageFull";
    }
    notifyError(error);
  }
};

export const SET_BOT_COLLAPSED = ({ state, commit }, { index, collapsed }) => {
  commit("SET_BOT_COLLAPSED", { index, collapsed });
  saveCollapsedBots(state);
};

export const SET_SAVED_BOT_COLLAPSED = ({ commit }, { index, collapsed }) => {
  commit("SET_SAVED_BOT_COLLAPSED", { index, collapsed });
};
