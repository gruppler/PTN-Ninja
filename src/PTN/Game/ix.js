import Linenum from "../Linenum";
import Move from "../Move";
import Nop from "../Nop";
import Ply from "../Ply";

import { last } from "lodash";

export default class GameIX {
  isValidSquare(square, assumeSoloCap = false) {
    const piece = square.length ? last(square) : null;

    if (this.state.selected.pieces.length) {
      // Move in progress
      const currentSquare = this.state.selected.pieces[0].square;
      let neighbors = currentSquare.neighbors.concat();

      if (square === currentSquare) {
        return true;
      }

      if (this.state.selected.moveset.length > 1) {
        // Direction is defined
        const prevSquare = this.state.selected.squares[
          this.state.selected.squares.length - 2
        ];
        const direction = { "+": "N", "-": "S", ">": "E", "<": "W" }[
          Ply.getDirection([
            currentSquare.x - prevSquare.x,
            currentSquare.y - prevSquare.y
          ])
        ];
        neighbors = [
          currentSquare.neighbors[direction],
          this.state.selected.squares[0]
        ];
      }

      if (neighbors.includes(square)) {
        // Neighbor square
        if (square.length === 0) {
          // Empty square
          return true;
        }
        if (piece.isCapstone) {
          // Occupied by a capstone
          return false;
        }
        if (!piece.isStanding) {
          // Occupied by a flat
          return true;
        }
        if (
          last(this.state.selected.pieces).isCapstone &&
          (this.state.selected.pieces.length === 1 || assumeSoloCap)
        ) {
          // Potential wall smash
          return true;
        }
      }
    } else if (!this.state.isGameEnd) {
      if (this.state.turn === this.state.player) {
        // Placement
        if (!piece) {
          // Empty square
          return true;
        }
        if (piece.color === this.state.turn && !this.state.isFirstMove) {
          // Player's piece
          return true;
        }
      }
      if (
        this.state.ply &&
        piece &&
        piece.ply === this.state.ply &&
        (this.isLocal || piece.ply.player === this.state.player) &&
        !this.state.isFirstMove
      ) {
        // Piece just placed; valid for stone cycling
        return true;
      }
    }
    return false;
  }

  selectSquare(square, altSelect = false) {
    if (!this.isValidSquare(square)) {
      return false;
    }

    const piece = square.length ? square[square.length - 1] : null;
    let move = last(this.state.selected.moveset);

    let types = [];
    if (
      this.state.pieces[this.state.turn].flat.length < this.pieceCounts.flat
    ) {
      types.push("flat", "wall");
    }
    if (this.state.pieces[this.state.turn].cap.length < this.pieceCounts.cap) {
      types.push("cap");
    }
    if (altSelect) {
      types.reverse();
    }

    if (!move) {
      move = {
        action: "push",
        x: square.x,
        y: square.y,
        count: 0,
        type: ""
      };
      this.state.selected.moveset.push(move);
    }

    if (this.state.selected.pieces.length) {
      this.dropSelection(square, altSelect);
    } else if (piece) {
      // Nothing selected yet, but this square has a piece
      if (piece.ply && this.state.ply === piece.ply && this.state.number > 1) {
        // Cycle through F, S, C
        move.type =
          types[
            (types.indexOf(piece.isStanding ? "wall" : piece.type) + 1) %
              types.length
          ];
        if (this.state.plyIsDone) {
          this._undoPly();
        }
        if (!this.state.nextPly) {
          this.state.move.plies.pop();
        }
        this.insertPly(Ply.fromMoveset([move]));
        this.cancelMove();
      } else {
        // Select piece or stack
        if (altSelect) {
          this.state.selected.pieces.push(piece);
          move.count = 1;
        } else {
          this.state.selected.pieces.push(...square.slice(-this.size));
          move.count = this.state.selected.pieces.length;
        }
        this.state.selected.initialCount = Math.min(this.size, square.length);
        this.state.selected.squares.push(square);
        move.action = "pop";
      }
    } else {
      // Place piece as new ply
      if (this.state.isFirstMove) {
        move.type = "flat";
      } else {
        move.type = types[0];
      }
      this.insertPly(Ply.fromMoveset([move]));
      this.cancelMove();
    }

    return true;
  }

  dropSelection(square, altSelect = false) {
    const currentSquare = this.state.selected.pieces[0].square;
    const isFirstMove = this.state.selected.moveset.length === 1;
    let move = last(this.state.selected.moveset);

    if (!this.isValidSquare(square)) {
      return false;
    }

    if (square === currentSquare) {
      // Drop in current square
      if (altSelect) {
        if (
          this.state.selected.initialCount - 1 * !isFirstMove >
          this.state.selected.pieces.length
        ) {
          // Undo last drop
          this.state.selected.pieces.unshift(
            square[square.length - this.state.selected.pieces.length - 1]
          );
          last(this.state.selected.moveset).count -=
            move.action === "pop" ? -1 : 1;
        } else {
          // Drop all
          this.state.selected.pieces = [];
          last(
            this.state.selected.moveset
          ).count = this.state.selected.initialCount;
        }
      } else {
        this.state.selected.pieces.shift();
        last(this.state.selected.moveset).count +=
          move.action === "pop" ? -1 : 1;
      }
    } else if (!isFirstMove && square === this.state.selected.squares[0]) {
      // Selected initial square to cancel move
      this.cancelMove();
    } else {
      // Drop in different square
      const direction = { "+": "N", "-": "S", ">": "E", "<": "W" }[
        Ply.getDirection([
          square.x - currentSquare.x,
          square.y - currentSquare.y
        ])
      ];
      const neighbor = square.neighbors[direction];
      const piece = last(square);

      this.state.selected.initialCount = this.state.selected.pieces.length;
      this.state.selected.squares.push(square);
      move = {
        action: "push",
        x: square.x,
        y: square.y,
        count: altSelect ? this.state.selected.pieces.length : 1,
        flatten: piece && piece.isStanding
      };
      this.state.selected.moveset.push(move);

      if (move.flatten) {
        piece.isStanding = false;
      }

      // Move selection from currentSquare to new square
      currentSquare.splice(
        -this.state.selected.pieces.length,
        this.state.selected.pieces.length
      );
      square.push(...this.state.selected.pieces);
      this.state.selected.pieces.forEach(piece => (piece.square = square));
      if (altSelect) {
        // Drop all
        this.state.selected.pieces = [];
      } else {
        this.state.selected.pieces.shift();
      }

      // If there's nowhere left to continue, drop the rest
      if (
        this.state.selected.pieces.length > 0 &&
        (!neighbor || !this.isValidSquare(neighbor, true))
      ) {
        move.count += this.state.selected.pieces.length;
        this.state.selected.pieces = [];
      }
    }

    if (this.state.selected.pieces.length === 0) {
      if (this.state.selected.moveset.length > 1) {
        this.insertPly(Ply.fromMoveset(this.state.selected.moveset), true);
      }
      this.state.selected.squares = [];
      this.state.selected.moveset = [];
      this.state.selected.initialCount = 0;
    }
  }

  cancelMove() {
    if (this.state.selected.moveset.length > 1) {
      last(
        this.state.selected.moveset
      ).count = this.state.selected.initialCount;
      this._undoMoveset(this.state.selected.moveset, this.state.color);
    }
    this.state.selected.pieces = [];
    this.state.selected.squares = [];
    this.state.selected.moveset = [];
    this.state.selected.initialCount = 0;
  }

  insertPly(ply, isAlreadyDone = false) {
    if (ply.constructor !== Ply) {
      ply = Ply.parse(ply, { id: this.plies.length });
    }
    if (this.state.plyIsDone && this.state.nextPly) {
      this._setPly(this.state.nextPly.id, false);
    }

    let move = this.state.move;

    ply.color = this.state.color;
    ply.player = this.state.turn;

    if (!move.plies[ply.player - 1]) {
      // Next ply in the move
      move.setPly(ply, ply.player - 1);
    } else if (
      !move ||
      (ply.player === 1 && !this.state.nextPly && this.state.plyIsDone)
    ) {
      // Next move in the branch
      const number = this.state.number + 1;
      move = this.moves.find(
        ({ linenum }) =>
          linenum.branch === this.state.branch && linenum.number === number
      );
      if (move) {
        move.ply1 = ply;
      } else {
        // New move
        move = new Move({
          game: this,
          id: this.moves.length,
          linenum: new Linenum(this.state.branch + number + ". ", this),
          ply1: ply
        });
        this.moves.push(move);
      }
    } else {
      // New branch
      if (!this.state.plyIsDone && this.state.ply.branches.length) {
        ply.branch = this.newBranchID(
          this.state.ply.branches[0].branch,
          this.state.number
        );
      } else {
        ply.branch = this.newBranchID(this.state.branch, this.state.number);
      }
      move = new Move({
        game: this,
        id: this.moves.length,
        linenum: new Linenum(ply.branch + this.state.number + ". ", this)
      });
      if (ply.player === 2) {
        move.ply1 = Nop.parse("--");
      }
      move.setPly(ply, ply.player - 1);
      this.moves.push(move);
      this.branches[ply.branch] = ply;
      this.state.targetBranch = ply.branch;
    }

    if (
      move.number === this.firstMoveNumber &&
      this.firstPlayer === 2 &&
      !move.ply1
    ) {
      move.ply1 = Nop.parse("--");
    }

    this.plies.push(ply);

    this.recordChange(() => {
      if (!isAlreadyDone) {
        // do ply;
        this.goToPly(ply.id, true);
      } else {
        this._setPly(ply.id, true);
      }
      if (!this.checkGameEnd()) {
        // Update PTN if checking for game end didn't
        this._updatePTN();
      }
    });
  }

  newBranchID(branch, number) {
    const prefix = branch || "";
    let i = 1;
    do {
      branch = prefix + number + "-" + i++ + ".";
    } while (branch in this.branches);
    return branch;
  }
}
