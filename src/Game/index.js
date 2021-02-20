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
  static validate(notation) {
    try {
      new Game(notation);
    } catch (error) {
      return error ? error.message : "";
    }
    return true;
  }
}
