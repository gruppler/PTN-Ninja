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
  static validate(ptn, silent = false) {
    let result = true;
    let game;
    try {
      // Parse the game
      game = new Game({
        ptn,
        state: { plyIndex: 0 },
        onError: (error, plyID) => {
          result = error.message || error;
          if (!silent) {
            console.warn("Encountered an error at plyID:", plyID);
            console.warn(error);
          }
        },
      });

      // Navigate through each branch
      Object.values(game.branches).forEach((ply) => {
        if (result === true) {
          game.board.goToPly(ply.id, true);
          game.board.last();
        }
      });
    } catch (error) {}
    return result;
  }
}
