import TPS from "../PTN/TPS";

import { last, times } from "lodash";

export default class BoardNavigation {
  _setPly(plyID, isDone = false) {
    this.plyID = plyID;
    this.plyIsDone = isDone;
  }

  setTarget(ply) {
    if (this.selected.pieces.length) {
      return false;
    }
    this.targetBranch = ply.branch;
    if (
      this.ply &&
      (ply.branches.includes(this.ply) || !this.ply.isInBranch(ply.branch))
    ) {
      return this.goToPly(ply.id, this.plyIsDone);
    } else {
      this.updatePTNOutput();
      return true;
    }
  }

  _afterPly(ply, isDone) {
    if (isDone) {
      if (ply.result && ply.result.type !== "1") {
        if (ply.result.type === "R" && !ply.result.roads) {
          this.updateSquareConnections();
          ply.result.roads = this.findRoads();
        }
        this.setRoads(ply.result.roads);
      } else if (ply.index === this.plies.length - 1) {
        this.checkGameEnd();
      }
      if (this.isGameEnd || (this.nextPly && this.nextPly.branches.length)) {
        this.game.saveBoardState();
      }
    } else {
      this.setRoads(null);
      if (ply.branches.length) {
        this.game.saveBoardState();
      }
    }
  }

  _doPly() {
    const ply = this.plyIsDone ? this.nextPly : this.ply;
    if (ply && this._doMoveset(ply.toMoveset(), ply.color, ply)) {
      this._setPly(ply.id, true);
      this._afterPly(ply, true);
      return true;
    } else {
      return false;
    }
  }

  _undoPly() {
    const ply = this.plyIsDone ? this.ply : this.prevPly;
    if (ply && this._doMoveset(ply.toUndoMoveset(), ply.color, ply)) {
      this._setPly(ply.id, false);
      this._afterPly(ply, false);
      return true;
    } else {
      return false;
    }
  }

  _doMoveset(moveset, color = 1, ply = null) {
    let stack = [];

    if (moveset[0].errors) {
      throw new Error(...moveset[0].errors);
      return false;
    }

    for (let i = 0; i < moveset.length; i++) {
      const move = moveset[i];
      const action = move.action;
      const x = move.x;
      const y = move.y;
      const count = move.count || 1;
      let flatten = move.flatten;
      const type = move.type;
      if (!this.squares[y] || !this.squares[y][x]) {
        throw new Error("Invalid move");
      }
      const square = this.squares[y][x];

      if (type) {
        if (action === "pop") {
          // Undo placement
          this.unplayPiece(square);
        } else {
          // Do placement
          if (square.piece) {
            throw new Error("Invalid move");
          }
          const piece = this.playPiece(color, type, square);
          if (!piece) {
            throw new Error("Invalid move");
          }
          piece.ply = ply;
        }
      } else if (action === "pop") {
        // Begin movement
        if (i === 0 && square.color !== color) {
          throw new Error("Invalid move");
        }
        times(count, () => {
          const piece = square.popPiece();
          if (!piece) {
            throw new Error("Invalid move");
          }
          stack.push(piece);
        });
        if (flatten && square.pieces.length) {
          // Undo smash
          square.piece.isStanding = true;
          square.setPiece(square.piece);
        }
      } else {
        // Continue movement
        if (square.pieces.length) {
          // Check that we can move onto existing piece(s)
          if (square.piece.isCapstone) {
            throw new Error("Invalid move");
          } else if (square.piece.isStanding) {
            if (
              stack[0].isCapstone &&
              count === 1 &&
              i === moveset.length - 1
            ) {
              if (ply && !flatten) {
                // Add smash notation if it's missing
                flatten = ply.wallSmash = "*";
                this.dirtyPly(ply.id);
                this.updatePTNOutput();
                this.game._updatePTN();
              }
            } else {
              throw new Error("Invalid move");
            }
          }
          if (flatten && square.pieces.length) {
            // Smash
            square.piece.isStanding = false;
            square.setPiece(square.piece);
          } else if (flatten) {
            // Remove false smash
            ply.wallSmash = "";
            this.dirtyPly(ply.id);
            this.updatePTNOutput();
            this.game._updatePTN();
          }
        }

        times(count, () => {
          const piece = stack.pop();
          if (!piece) {
            throw new Error("Invalid move");
          }
          square.pushPiece(piece);
        });
      }
    }

    return true;
  }

  _undoMoveset(moveset, color = 1, ply = null) {
    return this._doMoveset(
      moveset
        .map((move) => ({
          ...move,
          action: move.action === "pop" ? "push" : "pop",
        }))
        .reverse(),
      color,
      ply
    );
  }

  doTPS(tps) {
    if (!tps) {
      if (this.game.tags.tps) {
        tps = this.game.tags.tps.value;
      } else {
        this.clearBoard();
        return;
      }
    }
    if (tps.constructor === String) {
      tps = TPS.parse(tps);
    }
    const grid = tps.grid;
    let stack, square, piece, type;
    this.clearBoard();
    grid.forEach((row, y) => {
      row.forEach((col, x) => {
        if (col[0] !== "x") {
          stack = col.split("");
          square = this.squares[y][x];
          this.dirty.board.squareConnections[square.static.coord] = true;
          while ((piece = stack.shift())) {
            if (/[SC]/.test(stack[0])) {
              type = stack.shift();
            } else {
              type = "flat";
            }
            this.playPiece(piece, type, square, true);
          }
        }
      });
    });
    this.updateSquareConnections();
    this.setRoads(this.findRoads());
  }

  goToPly(plyID, isDone) {
    const targetPly = this.game.plies[plyID];

    if (!targetPly || !this.ply || this.selected.pieces.length) {
      return false;
    }

    const target = {
      plyIsDone: isDone,
      move: targetPly.move,
      branch: targetPly.branch,
      number: targetPly.move.number,
    };

    const boardPly = this.game.plies[this.boardPly.id];

    // Load a board state?
    if (!boardPly.isInBranch(target.branch)) {
      let parentPly = this.game.branches[target.branch];
      while (parentPly && !(parentPly.id in this.game.boardStates)) {
        // Find the closest branch that has a saved board state
        parentPly = this.game.branches[parentPly.branches[0].branch];
      }
      if (
        parentPly &&
        parentPly.id in this.game.boardStates &&
        "false" in this.game.boardStates[parentPly.id]
      ) {
        // Load the board state
        this.setBoard(
          this.game.boardStates[parentPly.id].false,
          parentPly.id,
          false
        );
      } else {
        // Failed to find a close board state, so go to the beginning
        // (This should theoretically never happen)
        this.setBoard(this.game.boardStates[0].false, 0, false);
      }
    } else if (
      plyID in this.game.boardStates &&
      Math.abs(targetPly.index - this.ply.index) > this.size * this.size
    ) {
      // Load board state if it exists and is far enough away
      if (!(isDone in this.game.boardStates[plyID])) {
        isDone = !isDone;
      }
      this.setBoard(this.game.boardStates[plyID][isDone], plyID, isDone);
    }

    // Set targetBranch if target is outside of it
    if (!targetPly.isInBranch(this.targetBranch)) {
      this.targetBranch = target.branch;
    }

    if (this.ply.branches.includes(targetPly)) {
      // Switch to the target branch if we're on a sibling
      if (this.plyIsDone) {
        this._undoPly(true);
      }
      this._setPly(targetPly.id, false);
    }

    if (this.ply.index < targetPly.index) {
      while (this.ply.index < targetPly.index && this._doPly(true)) {
        // Go forward until we reach the target ply
      }
    } else if (this.ply.index > targetPly.index) {
      while (this.ply.index > targetPly.index && this._undoPly(true)) {
        // Go backward until we reach the target ply
      }
    }

    // Do or undo the target ply
    if (target.plyIsDone !== this.plyIsDone) {
      if (target.plyIsDone) {
        this._doPly(true);
      } else {
        this._undoPly(true);
      }
    }

    this.updateBoardOutput();
    this.updatePositionOutput();
    this.updatePTNBranchOutput();

    return true;
  }

  first() {
    return this.goToPly(this.plies[0].id, false);
  }

  last() {
    return this.goToPly(last(this.plies).id, true);
  }

  prev(half = false) {
    if (this.selected.pieces.length) {
      return false;
    }
    if ((half || !this.prevPly) && this.plyIsDone) {
      const result = this._undoPly();
      this.updateBoardOutput();
      this.updatePositionOutput();
      return result;
    } else if (this.prevPly) {
      return this.goToPly(this.prevPly.id, true);
    }
    return false;
  }

  next(half = false) {
    if (this.selected.pieces.length) {
      return false;
    }
    if (!this.plyIsDone) {
      const result = this._doPly();
      this.updateBoardOutput();
      this.updatePositionOutput();
      return result;
    } else if (this.nextPly) {
      return this.goToPly(this.nextPly.id, !half);
    }
    return false;
  }
}
