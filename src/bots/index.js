import { i18n } from "../boot/i18n";
import { notifyError, notifyHint, notifyWarning } from "../utilities";

import TiltakCloud from "./tiltak-cloud";
import TiltakWasm from "./tiltak-wasm";
import TopazWasm from "./topaz-wasm";
import TeiBot from "./tei";

const constructors = [TiltakCloud, TiltakWasm, TopazWasm, TeiBot];

export const bots = {};
export const botOptions = [];

constructors.forEach((Bot) => {
  const bot = new Bot({
    onError: notifyError,
    onInfo: notifyHint,
    onWarning: notifyWarning,
  });
  bots[bot.id] = bot;
  botOptions.push({
    value: bot.id,
    label: i18n.t(bot.label),
    description: i18n.t(bot.description),
    icon: bot.icon,
  });
});
