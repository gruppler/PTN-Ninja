import { i18n } from "../boot/i18n";
import { notifyError } from "../utilities";

import TiltakCloud from "./tiltak-cloud";
import TiltakWasm from "./tiltak-wasm";
import TopazWasm from "./topaz-wasm";
import TeiBot from "./tei";

const constructors = [TiltakCloud, TiltakWasm, TopazWasm, TeiBot];

export const bots = {};
export const botOptions = [];

const onInit = (bot) => {
  if (botOptions.find((b) => b.value === bot.id)) {
    return;
  }
  botOptions.push({
    value: bot.id,
    label: i18n.t(bot.label),
    description: i18n.t(bot.description),
    icon: bot.icon,
  });
};

constructors.forEach((Bot) => {
  const bot = new Bot({
    onInit,
    onError: notifyError,
  });
  bots[bot.id] = bot;
});
