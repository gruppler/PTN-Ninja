import Vue from "vue";
import { bots } from "../../bots";
import CustomTeiBot from "../../bots/custom-tei";
import { cloneDeep, sortBy } from "lodash";

export const SET = (state, [key, value]) => {
  if (key in state.defaults) {
    state[key] = cloneDeep(value);
  }
};

// Initialize per-bot state in the store
export const INIT_BOT = (state, botID) => {
  if (!(botID in bots)) {
    return;
  }
  const bot = bots[botID];
  // Initialize per-bot state if not already present (use cloneDeep to avoid shared references)
  if (!state.botLogs[botID]) {
    Vue.set(state.botLogs, botID, cloneDeep(bot.log));
  }
  if (!state.botMetas[botID]) {
    Vue.set(state.botMetas, botID, cloneDeep(bot.meta));
  }
  if (!state.botStates[botID]) {
    Vue.set(state.botStates, botID, cloneDeep(bot.state));
  }
  if (!state.botPositions[botID]) {
    Vue.set(state.botPositions, botID, cloneDeep(bot.positions));
  }
};

// Set the bot to display in ToolbarAnalysis
export const SET_BOT = (state, botID) => {
  if (!(botID in bots)) {
    throw new Error("Bot not available");
  }
  state.botID = botID;
  INIT_BOT(state, botID);
};

export const SAVE_BOT = (state, bot) => {
  try {
    // Update Bots
    Vue.set(state.customBots, bot.id, bot);
    if (bot.id in bots) {
      // Existing Bot
      bots[bot.id].setMeta(bot.meta, true);
      bot = bots[bot.id];
    } else {
      // New Bot
      bot = new CustomTeiBot(bot.id, bot.meta);
      Vue.set(bots, bot.id, bot);
    }

    // Update List
    const listIndex = state.botList.findIndex((b) => b.value === bot.id);
    if (listIndex < 0) {
      state.botList.push(bot.listOption);
    } else {
      state.botList.splice(listIndex, 1, bot.listOption);
    }
    state.botList = sortBy(state.botList, ["label", "value"]);

    // Update Settings
    Vue.set(state.botSettings, bot.id, cloneDeep(bot.settings));
    Object.defineProperty(bot, "settings", {
      get() {
        return state.botSettings[bot.id];
      },
    });

    SET_BOT(state, bot.id);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const DELETE_BOT = (state, botID) => {
  try {
    // Update Bots
    Vue.delete(state.customBots, botID);
    Vue.delete(bots, botID);

    // Update List
    state.botList.splice(
      state.botList.findIndex((b) => b.value === botID),
      1
    );

    // Update Settings
    Vue.delete(state.botSettings, botID);

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

// Per-bot mutations - all take botID as first parameter
export const BOT_LOG = (state, { botID, message }) => {
  const bot = bots[botID];
  if (bot) {
    bot.log.push(message);
  }
  if (!state.botLogs[botID]) {
    Vue.set(state.botLogs, botID, []);
  }
  state.botLogs[botID].push(message);
};

export const CLEAR_BOT_LOG = (state, botID) => {
  const bot = bots[botID];
  if (bot) {
    bot.log = [];
  }
  Vue.set(state.botLogs, botID, []);
};

export const SET_BOT_META = (state, { botID, changes }) => {
  const bot = bots[botID];
  if (bot) {
    bot.meta = { ...bot.meta, ...changes };
  }
  if (!state.botMetas[botID]) {
    Vue.set(state.botMetas, botID, {});
  }
  Vue.set(state.botMetas, botID, { ...state.botMetas[botID], ...changes });
};

export const SET_BOT_STATE = (state, { botID, changes }) => {
  const bot = bots[botID];
  if (bot) {
    Object.assign(bot.state, changes);
  }
  if (!state.botStates[botID]) {
    Vue.set(state.botStates, botID, {});
  }
  const newState = { ...state.botStates[botID], ...changes };
  Vue.set(state.botStates, botID, newState);
};

export const SET_BOT_POSITION = (state, { botID, tps, suggestions }) => {
  const bot = bots[botID];
  if (bot) {
    bot.positions[tps] = suggestions;
  }
  if (!state.botPositions[botID]) {
    Vue.set(state.botPositions, botID, {});
  }
  Vue.set(state.botPositions[botID], tps, suggestions);
};

export const SET_BOT_POSITIONS = (state, { botID, positions }) => {
  const bot = bots[botID];
  if (bot) {
    bot.positions = positions || {};
  }
  Vue.set(state.botPositions, botID, positions || {});
};

export const DELETE_BOT_POSITION = (state, { botID, tps }) => {
  const bot = bots[botID];
  if (bot && bot.positions) {
    delete bot.positions[tps];
  }
  if (state.botPositions[botID]) {
    const positions = { ...state.botPositions[botID] };
    delete positions[tps];
    Vue.set(state.botPositions, botID, positions);
  }
};

export const CLEAR_BOT_POSITIONS = (state, botID) => {
  const bot = bots[botID];
  if (bot) {
    bot.positions = {};
  }
  Vue.set(state.botPositions, botID, {});
};

// Active Bots mutations
export const ADD_ACTIVE_BOT = (state, botId = null) => {
  state.activeBots.push(botId);
  if (botId) {
    INIT_BOT(state, botId);
  }
};

export const SET_ACTIVE_BOT = (state, { index, botId }) => {
  Vue.set(state.activeBots, index, botId);
  if (botId) {
    INIT_BOT(state, botId);
  }
};

export const REMOVE_ACTIVE_BOT = (state, index) => {
  if (state.activeBots.length > 1) {
    state.activeBots.splice(index, 1);
  }
};

export const INSERT_ACTIVE_BOT = (state, { index, botId }) => {
  state.activeBots.splice(index, 0, botId);
  if (botId) {
    INIT_BOT(state, botId);
  }
};

export const REORDER_ACTIVE_BOTS = (state, { fromIndex, toIndex }) => {
  const bot = state.activeBots[fromIndex];
  state.activeBots.splice(fromIndex, 1);
  state.activeBots.splice(toIndex, 0, bot);
  // Collapsed state is now keyed by bot name, so no swap needed
};

// Set collapsed state for a bot by name (used by both saved and unsaved panels)
export const SET_BOT_COLLAPSED = (state, { botName, collapsed }) => {
  // Use empty string for null/undefined bot names (the "Other" section)
  const key = botName != null ? botName : "";
  Vue.set(state.collapsedBots, key, collapsed);
};

export const SET_SUGGESTION_PV_EXPANDED = (
  state,
  { engineKey, pvIndex, expanded }
) => {
  const key = engineKey != null ? engineKey : "";
  const indexKey = String(pvIndex);

  if (!state.expandSuggestionPVs[key]) {
    Vue.set(state.expandSuggestionPVs, key, {});
  }

  if (expanded) {
    Vue.set(state.expandSuggestionPVs[key], indexKey, true);
    return;
  }

  Vue.delete(state.expandSuggestionPVs[key], indexKey);
  if (Object.keys(state.expandSuggestionPVs[key]).length === 0) {
    Vue.delete(state.expandSuggestionPVs, key);
  }
};

export const SET_OPENING_MOVES = (state, payload) => {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const tps = payload.tps || null;
    const moves = payload.moves || [];
    state.currentOpeningMoves = moves;
    if (tps) {
      Vue.set(state.openingPositions, tps, moves);
    }
    return;
  }

  state.currentOpeningMoves = payload || [];
};

// Replace the entire openingPositions map. Used by the Opening Explorer when
// filter settings change so stale moves for non-current positions are
// discarded and any cached-for-current-filters moves are surfaced immediately.
export const REPLACE_OPENING_POSITIONS = (state, positions) => {
  Vue.set(state, "openingPositions", positions || {});
};

export const SET_HOVERED_OVERLAY_PLY_TEXT = (state, plyText) => {
  state.hoveredOverlayPlyText = plyText || null;
};

// Update opening explorer stats for display in the tab bar
export const SET_OPENING_STATS = (
  state,
  { totalGames, moveCount, available, loading, dbMinRating }
) => {
  Vue.set(state, "openingStats", {
    totalGames,
    moveCount,
    available,
    loading: !!loading,
    dbMinRating:
      dbMinRating !== undefined ? dbMinRating : state.openingStats.dbMinRating,
  });
};
