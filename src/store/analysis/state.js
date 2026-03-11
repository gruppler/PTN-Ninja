import { LocalStorage } from "quasar";
import { cloneDeep, defaults, forEach, sortBy } from "lodash";
import { bots, botListOptions } from "../../bots";
import CustomTeiBot from "../../bots/custom-tei";
import { defaultEvalMarkThresholds } from "../../bots/bot";

const defaultBotID = "tiltak";

const botList = [...botListOptions];

const defaultState = {
  activeBots: [],
  botList,
  customBots: {},
  botID: defaultBotID, // Used for ToolbarAnalysis and other eval bars
  savedBotName: null, // Bot name for saved results selection (null = "Other"/unnamed)
  preferSavedResults: true, // Whether to show saved results over bot analysis
  botSettings: {}, // Per-bot settings (persisted)
  // Per-bot reactive state (keyed by botID)
  botLogs: {},
  botMetas: {},
  botPositions: {},
  botStates: {},
  // Collapsed state for active bots (keyed by index)
  collapsedBots: {},
  // Collapsed state for saved results bots (keyed by index)
  collapsedSavedBots: {},
  // Global settings
  showEvalMarks: true,
  evalMarkThresholds: { ...defaultEvalMarkThresholds },
  pvLimit: 3,
  pvsToSave: 1,
  saveSearchStats: true,
  showFullPVs: false,
  showContinuation: true,
  autoSaveAfterSearch: false,
  overwriteInferior: true,
  dbSettings: {
    includeBotGames: false,
    openGamesInNewTab: false,
    player1: [],
    player2: [],
    minRating: null,
    komi: [],
    maxSuggestedMoves: 5,
    maxTopGames: 5,
    tournament: null,
    minDate: null,
    maxDate: null,
  },
  openingPositions: {},
  openingStats: { totalGames: 0, moveCount: 0, available: false },
};
forEach(bots, (bot, id) => {
  defaultState.botSettings[id] = cloneDeep(bot.settings);
});

const state = {
  defaults: defaultState,
  ...cloneDeep(defaultState),
};

// Load from LocalStorage
const load = (key, initial) =>
  LocalStorage.has(key) ? LocalStorage.getItem(key) : initial;

if (!LocalStorage.isEmpty()) {
  for (let key in defaultState) {
    state[key] = load(key, state[key]);
  }
}

// Create custom bots
Object.values(state.customBots).forEach((bot) => {
  bots[bot.id] = new CustomTeiBot(bot.id, bot.meta);
  if (!(bot.id in state.botSettings)) {
    state.botSettings[bot.id] = cloneDeep(bots[bot.id].settings);
  } else {
    defaults(state.botSettings[bot.id], bots[bot.id].settings);
  }
});
// Add to botList

Object.values(state.customBots).forEach(({ id }) =>
  state.botList.push(bots[id].listOption)
);
state.botList = sortBy(state.botList, ["label", "value"]);

// Fall back to default bot if selected doesn't exist
if (!bots[state.botID]) {
  state.botID = defaultBotID;
}

// Overwrite default bot settings
forEach(bots, (bot, id) => {
  Object.defineProperty(bot, "settings", {
    get() {
      return state.botSettings[id];
    },
  });
});

// Backward compatibility
defaults(state, defaultState);
defaults(state.dbSettings, defaultState.dbSettings);
defaults(state.botSettings, defaultState.botSettings);
Object.keys(defaultState.botSettings).forEach((bot) => {
  defaults(state.botSettings[bot], defaultState.botSettings[bot]);
});

// Initialize per-bot state for all active bots
state.activeBots.forEach((botId) => {
  if (botId && bots[botId]) {
    const bot = bots[botId];
    if (!state.botLogs[botId]) {
      state.botLogs[botId] = cloneDeep(bot.log);
    }
    if (!state.botMetas[botId]) {
      state.botMetas[botId] = cloneDeep(bot.meta);
    }
    if (!state.botStates[botId]) {
      state.botStates[botId] = cloneDeep(bot.state);
    }
    if (!state.botPositions[botId]) {
      state.botPositions[botId] = cloneDeep(bot.positions);
    }
  }
});

export default state;
