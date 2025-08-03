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
      if (!ply.tpsAfter) {
        ply.tpsAfter = this.tps;
        this.dirtyPly(ply.id);
      }
      if (ply.result && ply.result.type !== "1") {
        if (ply.result.type === "R" && !ply.result.roads) {
          this.updateSquareConnections();
          ply.result.roads = this.findRoads();
        }
        this.setRoads(ply.result.roads);
      } else if (ply.index === this.plies.length - 1) {
        this.checkGameEnd();
      }
    } else {
      this.setRoads(null);
    }
  }

  _doPly() {
    const ply = this.plyIsDone ? this.nextPly : this.ply;
    if (!ply) {
      return false;
    }
    if (!ply.tpsBefore) {
      ply.tpsBefore = this.tps;
      this.dirtyPly(ply.id);
    }
    try {
      this._doMoveset(ply.toMoveset(), ply.color, ply);
      this._setPly(ply.id, true);
      this._afterPly(ply, true);
      return true;
    } catch (error) {
      console.error("Failed to do ply", ply, error);
      throw error;
    }
  }

  _undoPly() {
    const ply = this.plyIsDone ? this.ply : this.prevPly;
    if (!ply) {
      return false;
    }
    try {
      this._doMoveset(ply.toUndoMoveset(), ply.color, ply);
      this._setPly(ply.id, false);
      this._afterPly(ply, false);
      return true;
    } catch (error) {
      console.error("Failed to undo ply", ply, error);
      throw error;
    }
  }

  _doMoveset(moveset, color = 1, ply = null) {
    let stack = [];

    if (moveset[0].errors) {
      throw new Error(...moveset[0].errors);
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
        throw new Error(`Invalid coordinate (${x}, ${y})`);
      }
      const square = this.squares[y][x];

      if (type) {
        if (action === "pop") {
          // Undo placement
          if (!square.piece) {
            throw new Error(
              `Cannot unplace from empty square ${square.static.coord}`
            );
          }
          this.unplayPiece(square);
        } else {
          // Do placement
          if (square.piece) {
            throw new Error(
              `Cannot place into occupied square ${square.static.coord}`
            );
          }
          const piece = this.playPiece(color, type, square);
          if (!piece) {
            throw new Error(`No remaining ${type} pieces`);
          }
          piece.ply = ply;
        }
      } else if (action === "pop") {
        // Begin movement
        if (i === 0 && square.color !== color) {
          throw new Error(
            `Player does not control initial square ${square.static.coord}`
          );
        }
        if (count > this.size) {
          throw new Error(
            `Cannot move ${count} pieces from square ${square.static.coord}`
          );
        }
        times(count, () => {
          const piece = square.popPiece();
          if (!piece) {
            throw new Error(
              `Cannot move ${count} pieces from square ${square.static.coord}`
            );
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
            throw new Error(`Cannot move onto cap at ${square.static.coord}`);
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
              throw new Error(
                `Cannot move onto wall at ${square.static.coord}`
              );
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
            throw new Error(
              `Cannot drop ${count} pieces onto square ${square.static.coord}`
            );
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
    if (tps === undefined) {
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

  get isAtEndOfMainBranch() {
    return !this.ply || (!this.ply.branch && !this.nextPly && this.plyIsDone);
  }

  goToEndOfMainBranch() {
    const lastPly = this.game.plies.findLast((ply) => !ply.branch);
    if (lastPly) {
      return this.goToPly(lastPly.id, true);
    }
  }

  goToPly(plyID, isDone = false) {
    try {
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

      // Set targetBranch if target is outside of it
      if (!targetPly.isInBranch(this.targetBranch)) {
        this.targetBranch = target.branch;
      }

      // Go back until we're on a common branch or the first ply
      while (this.ply.index > 0 && !targetPly.isInBranch(this.ply.branch)) {
        this._undoPly();
      }

      // Switch branches
      if (!targetPly.isInBranch(this.ply.branch)) {
        let ply = this.ply.getBranch(this.targetBranch);
        if (!ply) {
          throw new Error("Could not find a path to the target ply");
        }
        if (this.plyIsDone) {
          this._undoPly();
        }
        this._setPly(ply.id, false);
      }

      if (this.ply.index < targetPly.index) {
        while (this.ply.index < targetPly.index && this._doPly()) {
          // Go forward until we reach the target ply
        }
      } else if (this.ply.index > targetPly.index) {
        while (this.ply.index > targetPly.index && this._undoPly()) {
          // Go backward until we reach the target ply
        }
      }

      // Do or undo the target ply
      if (target.plyIsDone !== this.plyIsDone) {
        if (target.plyIsDone) {
          this._doPly();
        } else {
          this._undoPly();
        }
      }

      this.updatePTNOutput();
      this.updateBoardOutput();
      this.updatePositionOutput();
      this.updatePTNBranchOutput();
    } catch (error) {
      if (this.game.onError) {
        this.game.onError(error, this.plyID);
        this.updatePTNOutput();
        this.updateBoardOutput();
        this.updatePositionOutput();
        this.updatePTNBranchOutput();
        return false;
      } else {
        throw error;
      }
    }
    return true;
  }

  first() {
    if (!this.plies.length) {
      return;
    }
    return this.goToPly(this.plies[0].id, false);
  }

  last() {
    if (!this.plies.length) {
      return;
    }
    return this.goToPly(last(this.plies).id, true);
  }

  prev(half = false, times = 1) {
    if (this.selected.pieces.length) {
      return false;
    }
    if ((half || !this.prevPly) && this.plyIsDone) {
      const result = this._undoPly();
      this.updatePTNOutput();
      this.updateBoardOutput();
      this.updatePositionOutput();
      return result;
    } else {
      let destination = this.getPrevPly(times);
      if (destination) {
        return this.goToPly(destination.id, true);
      }
    }
    return false;
  }

  next(half = false, times = 1) {
    if (this.selected.pieces.length) {
      return false;
    }
    if (!this.plyIsDone) {
      const result = this._doPly();
      this.updatePTNOutput();
      this.updateBoardOutput();
      this.updatePositionOutput();
      return result;
    } else {
      let destination = this.getNextPly(times);
      if (destination) {
        return this.goToPly(destination.id, !half);
      }
    }
    return false;
  }
}
