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
  static validate(ptn, silent = false, multiple = false) {
    const games = multiple ? Game.split(ptn) : [ptn];
    let isValid = true;

    const _validate = (ptn, i) => {
      let game;
      try {
        // Parse the game
        game = new Game({
          ptn,
          state: { plyIndex: 0 },
          onError: (error, plyID) => {
            isValid = isValid && (error.message || error);
            if (!silent) {
              console.warn(
                `Encountered an error at ${
                  games.length > 1 ? "Game " + (i + 1) + ", " : ""
                }plyID: ${plyID}`
              );
              console.warn(error);
            }
          },
        });

        // Navigate through each branch
        Object.values(game.branches).forEach((ply) => {
          if (isValid === true) {
            game.board.goToPly(ply.id, true);
            game.board.last();
          }
        });
      } catch (error) {}
    };

    if (games) {
      games.forEach(_validate);
    } else {
      _validate(ptn);
    }
    return isValid;
  }
}
