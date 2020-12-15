import Ply from "../Ply";

import { last } from "lodash";

export default class GameIX {
  isValidSquare(square, assumeSoloCap = false) {
    const piece = square.piece;

    if (this.state.selected.pieces.length) {
      // Move in progress
      const currentSquare = this.state.selected.pieces[0].square;
      let neighbors = currentSquare.static.neighbors.concat();

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
            currentSquare.static.x - prevSquare.static.x,
            currentSquare.static.y - prevSquare.static.y,
          ])
        ];
        neighbors = [
          currentSquare.static.neighbors[direction],
          this.state.selected.squares[0],
        ];
      }

      if (neighbors.includes(square)) {
        // Neighbor square
        if (square.pieces.length === 0) {
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
        if (piece.color === this.state.turn && this.state.number !== 1) {
          // Player's piece
          return true;
        }
      }
      if (
        this.state.ply &&
        piece &&
        piece.ply === this.state.ply &&
        this.state.number !== 1
      ) {
        // Piece just placed; valid for stone cycling
        return true;
      }
    }
    return false;
  }

  selectSquare(square, altSelect = false, editMode = false, selectedPiece) {
    if (!editMode && !this.isValidSquare(square)) {
      return false;
    }

    const piece = square.piece;

    if (editMode) {
      if (altSelect) {
        if (!piece) {
          return false;
        }
        return this.state.unplayPiece(square);
      } else if (piece && (piece.isCapstone || piece.isStanding)) {
        return false;
      }
      return this.state.playPiece(
        selectedPiece.color,
        selectedPiece.type,
        square
      );
    }

    let move = last(this.state.selected.moveset);

    let types = [];
    let color = piece ? piece.color : this.state.turn;
    if (
      (piece && piece.type === "flat") ||
      this.state.pieces.played[color].flat.length < this.pieceCounts[color].flat
    ) {
      types.push("flat", "wall");
    }
    if (
      this.state.pieces.played[color].cap.length < this.pieceCounts[color].cap
    ) {
      types.push("cap");
    }
    if (altSelect) {
      types.reverse();
    }

    if (!move) {
      move = {
        action: "push",
        x: square.static.x,
        y: square.static.y,
        count: 0,
        type: "",
      };
      this.state.selected.moveset.push(move);
    }

    if (this.state.selected.pieces.length) {
      this.dropSelection(square, altSelect);
    } else if (piece) {
      // Nothing selected yet, but this square has a piece
      if (
        piece.ply &&
        this.state.ply === piece.ply &&
        this.state.number !== 1
      ) {
        // Cycle through F, S, C
        move.type =
          types[
            (types.indexOf(piece.isStanding ? "wall" : piece.type) + 1) %
              types.length
          ];
        this.insertPly(Ply.fromMoveset([move]), false, true);
        this.cancelMove();
      } else {
        // Select piece or stack
        if (altSelect) {
          this.state.selectPiece(piece);
          move.count = 1;
        } else {
          this.state.selectPieces(square.pieces.slice(-this.size));
          move.count = this.state.selected.pieces.length;
        }
        this.state.selected.initialCount = Math.min(
          this.size,
          square.pieces.length
        );
        this.state.selectSquare(square);
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
          this.state.reselectPiece(
            square.pieces[
              square.pieces.length - this.state.selected.pieces.length - 1
            ]
          );
          last(this.state.selected.moveset).count -=
            move.action === "pop" ? -1 : 1;
        } else {
          // Drop all
          this.state.deselectAllPieces();
          last(
            this.state.selected.moveset
          ).count = this.state.selected.initialCount;
        }
      } else {
        this.state.deselectPiece();
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
          square.static.x - currentSquare.static.x,
          square.static.y - currentSquare.static.y,
        ])
      ];
      const neighbor = square.static.neighbors[direction];
      const piece = square.piece;

      this.state.selected.initialCount = this.state.selected.pieces.length;
      this.state.selectSquare(square);
      move = {
        action: "push",
        x: square.static.x,
        y: square.static.y,
        count: altSelect ? this.state.selected.pieces.length : 1,
        flatten: piece && piece.isStanding,
      };
      this.state.selected.moveset.push(move);

      if (move.flatten) {
        piece.isStanding = false;
      }

      // Move selection from currentSquare to new square
      currentSquare.popPieces(this.state.selected.pieces.length);
      square.pushPieces(this.state.selected.pieces);
      if (altSelect) {
        // Drop all
        this.state.deselectAllPieces();
      } else {
        this.state.deselectPiece();
      }

      // If there's nowhere left to continue, drop the rest
      if (
        this.state.selected.pieces.length > 0 &&
        (!neighbor || !this.isValidSquare(neighbor, true))
      ) {
        move.count += this.state.selected.pieces.length;
        this.state.deselectAllPieces();
      }
    }

    if (this.state.selected.pieces.length === 0) {
      if (this.state.selected.moveset.length > 1) {
        this.insertPly(Ply.fromMoveset(this.state.selected.moveset), true);
      }
      this.state.deselectAllSquares();
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
    this.state.deselectAllPieces();
    this.state.deselectAllSquares();
    this.state.selected.moveset = [];
    this.state.selected.initialCount = 0;
  }
}
