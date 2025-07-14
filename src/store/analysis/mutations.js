import Vue from "vue";
import { bots } from "../../bots";
import CustomTeiBot from "../../bots/custom-tei";
import { cloneDeep } from "lodash";

export const SET = (state, [key, value]) => {
  if (key in state.defaults) {
    state[key] = cloneDeep(value);
    if (key === "botID") {
      SET_BOT(state, value);
    }
  }
};

export const SET_BOT = (state, botID) => {
  if (!(botID in bots)) {
    throw new Error("Bot not available");
  }
  const bot = bots[botID];
  Vue.prototype.$bot = bot;
  state.botID = botID;
  state.botLog = bot.log;
  state.botMeta = bot.meta;
  state.botState = bot.state;
  state.botPositions = bot.positions;
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

export const BOT_LOG = (state, message) => {
  state.botLog.push(message);
};

export const CLEAR_BOT_LOG = (state) => {
  const bot = bots[state.botID];
  bot.log = [];
  state.botLog = bot.log;
};

export const SET_BOT_META = (state, changes) => {
  bots[state.botID].meta = state.botMeta = { ...state.botMeta, ...changes };
};

export const SET_BOT_STATE = (state, changes) => {
  bots[state.botID].state = state.botState = { ...state.botState, ...changes };
};

export const SET_BOT_POSITION = (state, [tps, suggestions]) => {
  Vue.set(state.botPositions, tps, suggestions);
};

export const CLEAR_BOT_POSITIONS = (state) => {
  const bot = bots[state.botID];
  bot.positions = {};
  state.botPositions = bot.positions;
};
