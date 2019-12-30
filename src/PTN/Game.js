import Aggregation from "./Aggregation";

import GameBase from "./Game/base";
import GameComments from "./Game/comments";
import GameEnd from "./Game/end";
import GameIX from "./Game/ix";
import GameMutations from "./Game/mutations";
import GameNavigation from "./Game/navigation";
import GameUndo from "./Game/undo";

export default class Game extends (new Aggregation(
  GameBase,
  GameComments,
  GameEnd,
  GameIX,
  GameMutations,
  GameNavigation,
  GameUndo
)) {
  static validate(notation) {
    try {
      new Game(notation);
    } catch (error) {
      return error ? error.message : "";
    }
    return true;
  }
}
