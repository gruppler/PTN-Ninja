import { LocalStorage } from "quasar";
import { cloneDeep, defaults, forEach } from "lodash";
import { bots, botOptions } from "../../bots";

const defaultBotID = "tiltak-cloud";

const defaultState = {
  bots: botOptions,
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
