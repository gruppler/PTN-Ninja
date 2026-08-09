// import TiltakCloud from "./tiltak-cloud";
import TiltakWasm from "./tiltak-wasm";
// import TopazWasm from "./topaz-wasm";
import TinueSolverBot from "./tinue-solver";
import TeiBot from "./tei";

const constructors = [
  /* TiltakCloud, */ TiltakWasm,
  /* TopazWasm, */ TinueSolverBot,
  TeiBot,
];

export const bots = {};
export const botListOptions = [];

constructors.forEach((Bot) => {
  const bot = new Bot();
  bots[bot.id] = bot;
  botListOptions.push(bot.listOption);
});
