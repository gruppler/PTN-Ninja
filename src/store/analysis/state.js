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
  analysisSource: "openings", // Board overlay data source: "openings", "engines", or "saved"
  botSettings: {}, // Per-bot settings (persisted)
  // Per-bot reactive state (keyed by botID)
  botLogs: {},
  botMetas: {},
  botPositions: {},
  botStates: {},
  // Collapsed state for engine sections (keyed by bot name/label)
  collapsedBots: {},
  // Global settings
  showEvalMarks: true,
  evalType: "cp",
  evalMarkThresholds: { ...defaultEvalMarkThresholds },
  pvLimit: 3,
  pvsToSave: 1,
  saveSearchStats: true,
  showFullPVs: false,
  // Expanded PV rows keyed by engine key then PV index
  expandSuggestionPVs: {},
  showContinuation: true,
  autoSaveEachPosition: false,
  autoSaveOnSearchComplete: false,
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
  currentOpeningMoves: [],
  openingPositions: {},
  openingStats: {
    totalGames: 0,
    moveCount: 0,
    available: false,
    dbMinRating: 0,
  },
};
forEach(bots, (bot, id) => {
  defaultState.botSettings[id] = cloneDeep(bot.settings);
});

const state = {
  defaults: defaultState,
  ...cloneDeep(defaultState),
  hoveredOverlayPlyText: null,
};

const migrateEvalMarkThresholds = (thresholds) => {
  if (!thresholds || typeof thresholds !== "object") {
    return thresholds;
  }

  const keys = ["brilliant", "good", "bad", "blunder"];
  if (!keys.every((key) => Number.isFinite(thresholds[key]))) {
    return thresholds;
  }

  const values = keys.map((key) => thresholds[key]);
  const looksLegacyPercentScale =
    values.every((value) => Math.abs(value) <= 1) &&
    values.some((value) => !Number.isInteger(value));

  if (!looksLegacyPercentScale) {
    return thresholds;
  }

  return {
    ...thresholds,
    brilliant: Math.round(thresholds.brilliant * 100),
    good: Math.round(thresholds.good * 100),
    bad: Math.round(thresholds.bad * 100),
    blunder: Math.round(thresholds.blunder * 100),
  };
};

// Load from LocalStorage
const load = (key, initial) => {
  if (!LocalStorage.has(key)) return initial;
  const value = LocalStorage.getItem(key);
  // Quasar LocalStorage converts null to the string "null"; restore it
  if (value === "null" && initial === null) return null;
  return value;
};

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
if (
  LocalStorage.has("autoSaveAfterSearch") &&
  !LocalStorage.has("autoSaveEachPosition") &&
  !LocalStorage.has("autoSaveOnSearchComplete")
) {
  state.autoSaveOnSearchComplete = !!state.autoSaveAfterSearch;
}
delete state.autoSaveAfterSearch;
state.evalMarkThresholds = migrateEvalMarkThresholds(state.evalMarkThresholds);
if (
  !state.expandSuggestionPVs ||
  typeof state.expandSuggestionPVs !== "object" ||
  Array.isArray(state.expandSuggestionPVs)
) {
  state.expandSuggestionPVs = {};
}
// Migrate old index-based collapsedBots to empty (will be repopulated by name)
if (
  state.collapsedBots &&
  typeof Object.keys(state.collapsedBots)[0] === "string"
) {
  // Check if keys look like indices (numeric strings)
  const keys = Object.keys(state.collapsedBots);
  if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
    // Old format - reset to empty
    state.collapsedBots = {};
  }
}
// Remove deprecated collapsedSavedBots
delete state.collapsedSavedBots;
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
