import Vue from "vue";
import { cloneDeep } from "lodash";
import { bots } from "../../bots";

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

export const BOT_LOG = (state, message) => {
  state.botLog.push(message);
};

export const CLEAR_BOT_LOG = (state) => {
  const bot = Vue.prototype.$bot;
  bot.log = [];
  state.botLog = bot.log;
};

export const SET_BOT_META = (state, [key, value]) => {
  state.botMeta[key] = value;
};

export const SET_BOT_STATE = (state, [key, value]) => {
  state.botState[key] = value;
};

export const SET_BOT_POSITION = (state, [tps, suggestions]) => {
  Vue.set(state.botPositions, tps, suggestions);
};

export const CLEAR_BOT_POSITIONS = (state) => {
  const bot = Vue.prototype.$bot;
  bot.positions = {};
  state.botPositions = bot.positions;
};
