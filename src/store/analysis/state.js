import { LocalStorage } from "quasar";
import { cloneDeep, defaults, forEach, sortBy } from "lodash";
import { bots, botListOptions } from "../../bots";
import CustomTeiBot from "../../bots/custom-tei";

const defaultBotID = "tiltak-cloud";

const botList = [...botListOptions];

const defaultState = {
  botList,
  customBots: {},
  botID: defaultBotID,
  botLog: [],
  botMeta: {},
  botPositions: {},
  botSettings: {},
  botState: {},
  pvLimit: 3,
  dbSettings: {
    includeBotGames: false,
    player1: [],
    player2: [],
    minRating: null,
    komi: [],
    maxSuggestedMoves: 8,
    tournament: null,
    minDate: null,
    maxDate: null,
  },
  openingPositions: {},
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
sortBy(
  Object.values(state.customBots).map(({ id }) => bots[id]),
  "created"
).forEach((bot) => state.botList.push(bot.listOption));

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

export default state;
