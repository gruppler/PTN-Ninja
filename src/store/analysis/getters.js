import { bots } from "../../bots";

export const bot = (state) => {
  return bots[state.botID];
};
