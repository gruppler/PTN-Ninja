import Aggregation from "aggregation/es6";

import GameBase from "./base";
import GameOnline from "./online";
import GameComments from "./comments";
import GameMutations from "./mutations";
import GameUndo from "./undo";

export default class Game extends Aggregation(
  GameBase,
  GameOnline,
  GameComments,
  GameMutations,
  GameUndo
) {
  static validate(ptn) {
    try {
      new Game({ ptn });
    } catch (error) {
      return error ? error.message : "";
    }
    return true;
  }
}
