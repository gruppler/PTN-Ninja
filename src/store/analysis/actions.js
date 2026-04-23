import { LocalStorage } from "quasar";
import { bots } from "../../bots";
import { notifyError } from "../../utilities";
import { cloneDeep, omit, throttle } from "lodash";

// Keys whose values represent the "selected analysis source" that gets
// persisted per-game (see game/SAVE_ANALYSIS_SELECTION).
const GAME_PERSISTED_KEYS = new Set([
  "analysisSource",
  "botID",
  "savedBotName",
  "preferSavedResults",
  "collapsedBots",
]);

// When restoring the selection from a game's saved config, suppress
// re-persisting the incoming values back to the game.
let isRestoringAnalysisSelection = false;

const throttledPersistSelectionToGame = throttle(
  (dispatch, selection) => {
    dispatch("game/SAVE_ANALYSIS_SELECTION", selection, { root: true });
  },
  300,
  { leading: false, trailing: true }
);

const schedulePersistSelectionToGame = (state, dispatch, rootState) => {
  if (isRestoringAnalysisSelection) return;
  if (!rootState || !rootState.game || rootState.ui?.embed) return;
  throttledPersistSelectionToGame(dispatch, {
    source: state.analysisSource,
    botID: state.botID,
    savedBotName: state.savedBotName,
    preferSavedResults: state.preferSavedResults,
    collapsedBots: state.collapsedBots,
    textTab: rootState.ui && rootState.ui.textTab,
  });
};

// Public entry point for other modules (e.g. ui/SET_UI when textTab changes)
// to schedule a persist of the current analysis selection to the game.
export const SCHEDULE_PERSIST_SELECTION_TO_GAME = ({
  state,
  dispatch,
  rootState,
}) => {
  schedulePersistSelectionToGame(state, dispatch, rootState);
};

export const SET = ({ state, commit, dispatch, rootState }, [key, value]) => {
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
    if (GAME_PERSISTED_KEYS.has(key)) {
      schedulePersistSelectionToGame(state, dispatch, rootState);
    }
  }
  return false;
};

// Cancel any pending persist-to-game writes. Called when switching games to
// avoid writing a stale selection back to the newly-loaded game.
export const CANCEL_PENDING_ANALYSIS_SELECTION_PERSIST = () => {
  throttledPersistSelectionToGame.cancel();
};

// Validate a stored selection against the current bot registry and the
// current game's saved results. Returns true only if the selection can be
// faithfully restored.
const isSelectionRestorable = (selection, getters) => {
  if (!selection || typeof selection !== "object") return false;
  const validSources = ["openings", "engines", "saved"];
  if (!validSources.includes(selection.source)) return false;
  if (selection.source === "engines") {
    if (!selection.botID || !bots[selection.botID]) return false;
  }
  if (selection.source === "saved") {
    const names = getters && getters.savedBotNamesWithResults;
    const name =
      selection.savedBotName === undefined ? null : selection.savedBotName;
    if (!names || !names.has(name)) return false;
  }
  return true;
};

// Restore the persisted analysis selection from a game's config without
// re-persisting the values back to the game. If the selection is missing or
// references an engine/saved bot that is no longer valid, fall back to the
// same default logic used when loading a game without a saved selection
// (preferSavedResults = true + SYNC_SAVED_ENGINE).
export const RESTORE_ANALYSIS_SELECTION = (
  { state, commit, dispatch, getters },
  selection
) => {
  throttledPersistSelectionToGame.cancel();

  const hasSelection = selection && typeof selection === "object";

  // Restore independent UI fields (collapsedBots, textTab) regardless of
  // whether the selection itself is valid — they don't depend on which bot
  // is selected.
  const restoreIndependentFields = () => {
    if (!hasSelection) return;
    if (
      selection.collapsedBots &&
      typeof selection.collapsedBots === "object"
    ) {
      commit("SET", ["collapsedBots", selection.collapsedBots]);
      try {
        LocalStorage.set("collapsedBots", selection.collapsedBots);
      } catch (_) {}
    }
    if (typeof selection.textTab === "string") {
      commit("ui/SET_UI", ["textTab", selection.textTab], { root: true });
      try {
        LocalStorage.set("textTab", selection.textTab);
      } catch (_) {}
    }
  };

  if (!isSelectionRestorable(selection, getters)) {
    isRestoringAnalysisSelection = true;
    try {
      restoreIndependentFields();
    } finally {
      isRestoringAnalysisSelection = false;
    }
    dispatch("SET", ["preferSavedResults", true]);
    dispatch("SYNC_SAVED_ENGINE");
    return;
  }

  isRestoringAnalysisSelection = true;
  try {
    commit("SET", ["analysisSource", selection.source]);
    try {
      LocalStorage.set("analysisSource", selection.source);
    } catch (_) {}
    if (selection.botID && bots[selection.botID]) {
      commit("SET", ["botID", selection.botID]);
      try {
        LocalStorage.set("botID", selection.botID);
      } catch (_) {}
    }
    if ("savedBotName" in selection) {
      commit("SET", ["savedBotName", selection.savedBotName]);
      try {
        LocalStorage.set("savedBotName", selection.savedBotName);
      } catch (_) {}
    }
    if (typeof selection.preferSavedResults === "boolean") {
      commit("SET", ["preferSavedResults", selection.preferSavedResults]);
      try {
        LocalStorage.set("preferSavedResults", selection.preferSavedResults);
      } catch (_) {}
    }
    restoreIndependentFields();
  } finally {
    isRestoringAnalysisSelection = false;
  }
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

const saveExpandedSuggestionPVs = (state) => {
  try {
    LocalStorage.set("expandSuggestionPVs", state.expandSuggestionPVs);
  } catch (error) {
    if (error.code === 22) {
      error = "localstorageFull";
    }
    notifyError(error);
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

// Called when loading/switching games. If the current engine has saved results,
// select it. Otherwise, find an engine that does have saved results.
export const SYNC_SAVED_ENGINE = ({ state, getters, dispatch }) => {
  const withResults = getters.savedBotNamesWithResults;
  if (withResults.size === 0) {
    // No saved results at all - switch to engine analysis
    if (state.preferSavedResults) {
      dispatch("SET", ["preferSavedResults", false]);
    }
    if (state.analysisSource === "saved") {
      dispatch("SET", ["analysisSource", "openings"]);
    }
    return;
  }
  // Saved results exist — ensure analysisSource reflects that
  if (state.analysisSource !== "saved") {
    dispatch("SET", ["analysisSource", "saved"]);
  }
  // If current savedBotName has actual results, keep it
  if (withResults.has(state.savedBotName)) {
    return;
  }
  // Prefer the label of the currently selected engine if it has results
  const bot = bots[state.botID];
  const label = bot ? bot.label : null;
  if (label && withResults.has(label)) {
    dispatch("SET", ["savedBotName", label]);
  } else {
    // Fall back to first bot with actual results
    const names = getters.savedBotNames;
    const firstWithResults = names.find((n) => withResults.has(n));
    if (firstWithResults !== undefined) {
      dispatch("SET", ["savedBotName", firstWithResults]);
    }
  }
};

// Called when switching to the Saved tab. Syncs savedBotName to the current
// engine's saved results, or falls back to the next engine with results.
export const SYNC_SAVED_ENGINE_TO_CURRENT = ({ state, getters, dispatch }) => {
  const withResults = getters.savedBotNamesWithResults;
  const names = getters.savedBotNames;
  dispatch("SET", ["preferSavedResults", true]);
  dispatch("SET", ["analysisSource", "saved"]);
  // Select the current engine's saved results if they exist
  const bot = bots[state.botID];
  const label = bot ? bot.label : null;
  if (label && withResults.has(label)) {
    dispatch("SET", ["savedBotName", label]);
  } else if (withResults.has(state.savedBotName)) {
    // Current savedBotName still has results, keep it
  } else if (names.length > 0) {
    dispatch("SET", ["savedBotName", names[0]]);
  }
};

export const SYNC_ENGINE_TO_SAVED = ({ state, dispatch }) => {
  dispatch("SET", ["preferSavedResults", false]);
  dispatch("SET", ["analysisSource", "engines"]);
  // Sync botID to the active engine matching the current saved bot name
  if (state.savedBotName) {
    for (const id of state.activeBots) {
      const bot = bots[id];
      if (bot && bot.label === state.savedBotName) {
        if (id !== state.botID) {
          dispatch("SET", ["botID", id]);
        }
        return;
      }
    }
  }
  // If no matching engine found, keep the current botID (previously selected)
};

export const SELECT_SAVED_ENGINE = ({ state, dispatch }, botName) => {
  dispatch("SET", ["savedBotName", botName]);
  dispatch("SET", ["preferSavedResults", true]);
  dispatch("SET", ["analysisSource", "saved"]);
  // Sync botID to the active engine whose label matches the saved bot name
  if (botName) {
    for (const id of state.activeBots) {
      const bot = bots[id];
      if (bot && bot.label === botName) {
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

export const SET_BOT_COLLAPSED = (
  { state, commit, dispatch, rootState },
  { botName, collapsed }
) => {
  commit("SET_BOT_COLLAPSED", { botName, collapsed });
  saveCollapsedBots(state);
  schedulePersistSelectionToGame(state, dispatch, rootState);
};

// Persist per-engine eval mark threshold edits. Updates bot.meta +
// state.botMetas for immediate effect and stores the value in
// botMetaOverrides so it survives reloads for both built-in and custom bots.
export const SET_BOT_EVAL_MARK_THRESHOLDS = (
  { state, commit, dispatch },
  { botID, thresholds }
) => {
  if (!botID || !thresholds) {
    return;
  }
  const cloned = cloneDeep(thresholds);
  commit("SET_BOT_META", {
    botID,
    changes: { evalMarkThresholds: cloned },
  });
  const overrides = {
    ...(state.botMetaOverrides || {}),
    [botID]: {
      ...((state.botMetaOverrides && state.botMetaOverrides[botID]) || {}),
      evalMarkThresholds: cloned,
    },
  };
  dispatch("SET", ["botMetaOverrides", overrides]);
};

export const SET_SUGGESTION_PV_EXPANDED = (
  { state, commit },
  { engineKey, pvIndex, expanded }
) => {
  commit("SET_SUGGESTION_PV_EXPANDED", { engineKey, pvIndex, expanded });
  saveExpandedSuggestionPVs(state);
};
