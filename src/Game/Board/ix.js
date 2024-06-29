import Ply from "../PTN/Ply";

import { isString, last } from "lodash";

export default class BoardIX {
  isValidSquare(square, assumeSoloCap = false) {
    square = this.getSquare(square);
    const piece = square.piece;

    if (this.selected.pieces.length) {
      if (
        this.selected.pieces.length === 1 &&
        !this.selected.pieces[0].square
      ) {
        // Unplayed piece selected
        return !piece;
      } else {
        // Move in progress
        const currentSquare = this.selected.pieces[0].square;
        let neighbors = currentSquare.static.neighbors.concat();

        if (square === currentSquare) {
          return true;
        }

        if (this.selected.moveset.length > 1) {
          // Direction is defined
          const prevSquare =
            this.selected.squares[this.selected.squares.length - 2];
          const direction = { "+": "N", "-": "S", ">": "E", "<": "W" }[
            Ply.getDirection([
              currentSquare.static.x - prevSquare.static.x,
              currentSquare.static.y - prevSquare.static.y,
            ])
          ];
          neighbors = [
            currentSquare.static.neighbors[direction],
            this.selected.squares[0],
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
            last(this.selected.pieces).isCapstone &&
            (this.selected.pieces.length === 1 || assumeSoloCap)
          ) {
            // Potential wall smash
            return true;
          }
        }
      }
    } else if (!this.isGameEnd || this.isGameEndDefault) {
      if (this.turn === this.player) {
        // It's the user's turn
        if (!piece) {
          // Empty square
          return true;
        }

        if (
          piece.color === this.turn &&
          (!this.game.openingSwap ||
            this.number !== 1 ||
            (this.plyIsDone && this.turn === 1))
        ) {
          // Player's piece, can be selected
          // Edge case: on opening swap, after 2 has played, let 1 move
          return true;
        }
      }

      if (
        this.ply &&
        piece &&
        piece.ply === this.ply &&
        (!this.game.config.isOnline || piece.ply.player === this.player) &&
        this.number !== 1
      ) {
        // Piece just placed; valid for stone cycling
        return true;
      }
    }
    return false;
  }

  selectUnplayedPiece(type, toggleWall = false) {
    if (this.isGameEnd) {
      return false;
    }
    if (this.game.openingSwap && this.isFirstMove) {
      type = "flat";
    }
    const color = this.color;
    const piece =
      this.pieces.all[color][type][this.pieces.played[color][type].length];
    if (!piece) {
      return false;
    }
    if (piece.isSelected) {
      if (
        !piece.isCapstone &&
        toggleWall &&
        !(this.game.openingSwap && this.isFirstMove)
      ) {
        piece.isStanding = !piece.isStanding;
      } else {
        piece.isStanding = false;
        this._deselectPiece();
      }
    } else {
      if (this.selected.pieces.length) {
        this.cancelMove(true);
      }
      this._selectPiece(piece);
      if (
        !piece.isCapstone &&
        toggleWall &&
        !(this.game.openingSwap && this.isFirstMove)
      ) {
        piece.isStanding = true;
      }
    }
    this.updatePiecesOutput();
    this.updateSelectedOutput();
  }

  selectSquare(
    square,
    altSelect = false,
    editMode = false,
    selectedPiece,
    count = null
  ) {
    square = this.getSquare(square);
    if (!editMode && !this.isValidSquare(square)) {
      return false;
    }

    let piece = square.piece;
    if (isString(piece)) {
      piece = this.getPiece(piece);
    }

    // Place or remove a piece in TPS mode
    if (editMode && count === null) {
      if (altSelect) {
        if (!piece) {
          return false;
        }
        this.unplayPiece(square);
        return this.updateBoardOutput();
      } else if (piece && (piece.isCapstone || piece.isStanding)) {
        return false;
      }
      this.playPiece(selectedPiece.color, selectedPiece.type, square);
      return this.updateBoardOutput();
    }

    let move = last(this.selected.moveset);

    // Get available stone types for cycling
    let types = [];
    let color = piece ? piece.color : this.turn;
    if (
      (piece && piece.type === "flat") ||
      this.pieces.played[color].flat.length < this.game.pieceCounts[color].flat
    ) {
      types.push("flat", "wall");
    }
    if (
      this.pieces.played[color].cap.length < this.game.pieceCounts[color].cap
    ) {
      types.push("cap");
    }
    if (altSelect) {
      types.reverse();
    }

    // Start or continue a move
    if (!move) {
      move = {
        action: "push",
        x: square.static.x,
        y: square.static.y,
        count: 0,
        type: "",
      };
      this.selected.moveset.push(move);
    }

    if (this.selected.pieces.length) {
      this.dropSelection(square, altSelect, count);
    } else if (piece) {
      // Nothing selected yet, but this square has a piece
      if (
        count === null &&
        piece.ply &&
        this.ply === piece.ply &&
        this.number !== 1123
      ) {
        // Cycle through F, S, C
        move.type =
          types[
            (types.indexOf(piece.isStanding ? "wall" : piece.type) + 1) %
              types.length
          ];
        this.game.insertPly(Ply.fromMoveset([move]), false, true);
        this.cancelMove();
      } else if (piece.color === this.turn) {
        // Select piece or stack
        if (count) {
          if (count === "all") {
            count = Math.min(this.size, square.pieces.length);
          } else if (count === "friendly") {
            for (
              let i = Math.max(0, square.pieces.length - this.size);
              i < square.pieces.length;
              i++
            ) {
              const prevPiece = square.pieces[i - 1];
              if (prevPiece && prevPiece.color === this.turn) {
                count = square.pieces.length - i;
                break;
              }
            }
            if (!count || count === "friendly") {
              this.selected.moveset.pop();
              return;
            }
          } else {
            count = Math.min(Number(count), this.size, square.pieces.length);
          }
          this._selectPieces(square.pieces.slice(-count));
          move.count = this.selected.pieces.length;
        } else if (altSelect) {
          this._selectPiece(piece);
          move.count = 1;
        } else {
          this._selectPieces(square.pieces.slice(-this.size));
          move.count = this.selected.pieces.length;
        }
        this.selected.initialCount = Math.min(this.size, square.pieces.length);
        this._selectSquare(square);
        move.action = "pop";
      }
    } else if (count === null) {
      // Place piece as new ply
      if (this.game.openingSwap && this.isFirstMove) {
        move.type = "flat";
      } else {
        move.type = types[0];
      }
      this.game.insertPly(Ply.fromMoveset([move]));
      this.cancelMove();
    } else {
      this.selected.moveset.pop();
      return;
    }

    this.updateSelectedOutput();
    return this.updateBoardOutput();
  }

  dropSelection(square, altSelect = false, count = null) {
    const currentSquare = this.selected.pieces[0].square;
    const isFirstMove = this.selected.moveset.length === 1;
    let move = last(this.selected.moveset);

    if (!this.isValidSquare(square)) {
      return false;
    }

    if (!currentSquare) {
      // Unplayed piece
      const piece = this.selected.pieces[0];
      move = {
        action: "push",
        x: square.static.x,
        y: square.static.y,
        count: 0,
        type: piece.isStanding ? "wall" : piece.type,
      };
      this.cancelMove();
      this.game.insertPly(Ply.fromMoveset([move]));
      return;
    }

    if (square === currentSquare) {
      // Drop in current square
      if (altSelect) {
        if (
          this.selected.initialCount - 1 * !isFirstMove >
          this.selected.pieces.length
        ) {
          // Undo last drop
          this._reselectPiece(
            square.pieces[
              square.pieces.length - this.selected.pieces.length - 1
            ]
          );
          last(this.selected.moveset).count -= move.action === "pop" ? -1 : 1;
        } else {
          // Drop all
          this._deselectAllPieces();
          last(this.selected.moveset).count = this.selected.initialCount;
        }
      } else if (count) {
        if (count === "all") {
          this._deselectAllPieces();
          count = this.selected.initialCount;
          last(this.selected.moveset).count = count;
        } else if (count === "friendly") {
          for (let i = this.selected.pieces.length; i >= 0; i--) {
            const topPiece = square.pieces[square.pieces.length - i];
            if (topPiece && topPiece.color === this.turn) {
              count = this.selected.pieces.length - i + 1;
              break;
            }
          }
          if (!count || count === "friendly") {
            return;
          }
        } else {
          count = Math.min(Number(count), this.selected.pieces.length);
        }
        this._deselectPieces(this.selected.pieces.slice(0, count));
        last(this.selected.moveset).count +=
          move.action === "pop" ? -count : count;
      } else {
        this._deselectPiece();
        last(this.selected.moveset).count += move.action === "pop" ? -1 : 1;
      }
    } else if (!isFirstMove && square === this.selected.squares[0]) {
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

      if (count) {
        if (count === "all") {
          count = this.selected.pieces.length;
        } else if (count === "friendly") {
          for (let i = 0; i < this.selected.pieces.length; i++) {
            if (this.selected.pieces[i].color === this.turn) {
              count = i + 1;
              break;
            }
          }
          if (!count || count === "friendly") {
            return;
          }
        } else {
          count = Math.min(Number(count), this.selected.pieces.length);
        }
      } else {
        count = altSelect ? this.selected.pieces.length : 1;
      }

      // Move selection from currentSquare to new square
      this.selected.initialCount = this.selected.pieces.length;
      this._selectSquare(square);
      currentSquare.popPieces(this.selected.pieces.length);
      square.pushPieces(this.selected.pieces);

      move = {
        action: "push",
        x: square.static.x,
        y: square.static.y,
        count,
        flatten: piece && piece.isStanding,
      };
      this.selected.moveset.push(move);

      if (move.flatten) {
        piece.isStanding = false;
      }

      this._deselectPieces(this.selected.pieces.slice(0, count));

      // If there's nowhere left to continue, drop the rest
      if (
        this.selected.pieces.length > 0 &&
        (!neighbor || !this.isValidSquare(neighbor, true))
      ) {
        move.count += this.selected.pieces.length;
        this._deselectAllPieces();
      }
    }

    if (this.selected.pieces.length === 0) {
      if (this.selected.moveset.length > 1) {
        this.game.insertPly(Ply.fromMoveset(this.selected.moveset), true);
      }
      this._deselectAllSquares();
      this.selected.moveset = [];
      this.selected.initialCount = 0;
    }

    this.updateSelectedOutput();
  }

  cancelMove(flatten = false) {
    if (this.selected.moveset.length > 1) {
      last(this.selected.moveset).count = this.selected.initialCount;
      this._undoMoveset(this.selected.moveset, this.color);
    }
    this._deselectAllPieces(flatten);
    this._deselectAllSquares();
    this.selected.moveset = [];
    this.selected.initialCount = 0;
    this.updateSelectedOutput();
    this.updateBoardOutput();
  }
}
