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
    let result = true;
    const game = new Game({
      ptn,
      state: { plyIndex: 0 },
      onError: (error, plyID) => {
        result = error.message || error;
        console.warn("Encountered an error at plyID:", plyID);
        console.error(error);
      },
    });

    // Navigate through each branch
    Object.values(game.branches).forEach((ply) => {
      if (result === true) {
        game.board.goToPly(ply.id, true);
        game.board.last();
      }
    });
    return result;
  }
}
