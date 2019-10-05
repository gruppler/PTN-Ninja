import Piece from "../Piece";

import { last, times } from "lodash";

export default class GameNavigation {
  _setPly(plyID, isDone = false) {
    this.state.plyID = plyID;
    this.state.plyIsDone = isDone;
  }

  setTarget(ply) {
    if (this.state.selected.pieces.length) {
      return false;
    }
    this.state.targetBranch = ply.branch;
    if (
      this.state.ply &&
      (ply.branches.includes(this.state.ply) ||
        !this.state.ply.isInBranch(ply.branch))
    ) {
      return this.goToPly(ply.id, this.state.plyIsDone);
    } else {
      return true;
    }
  }

  _doPly() {
    const ply = this.state.plyIsDone ? this.state.nextPly : this.state.ply;
    if (ply && this._doMoveset(ply.toMoveset(), ply.color, ply)) {
      this._setPly(ply.id, true);
      if (ply.result) {
        if (ply.result.type === "R" && !ply.result.roads) {
          ply.result.roads = this.findRoads();
        }
      } else if (ply.index === this.state.plies.length - 1) {
        this.checkGameEnd();
      }
      if (
        this.state.isGameEnd ||
        (this.state.nextPly && this.state.nextPly.branches.length)
      ) {
        // Save board state if it's not already
        this.saveBoardState();
      }
      return true;
    } else {
      return false;
    }
  }

  _undoPly() {
    const ply = this.state.plyIsDone ? this.state.ply : this.state.prevPly;
    if (ply && this._doMoveset(ply.toUndoMoveset(), ply.color, ply)) {
      this._setPly(ply.id, false);
      return true;
    } else {
      return false;
    }
  }

  _doMoveset(moveset, color = 1, ply = null) {
    let stack = [];

    if (moveset[0].errors) {
      console.error(moveset[0].errors);
      return false;
    }

    moveset.forEach(({ action, x, y, count = 1, flatten, type }) => {
      const square = this.state.squares[y][x];

      if (type) {
        if (action === "pop") {
          // Undo placement
          let piece = square.pop();
          this.state.pieces[color][piece.type].pop();
        } else {
          // Do placement
          let piece = new Piece({
            ply,
            square,
            game: this,
            color,
            type
          });
          square.push(piece);
          this.state.pieces[color][piece.type].push(piece);
        }
      } else if (action === "pop") {
        // Undo movement
        times(count, () => stack.push(square.pop()));
        if (flatten && square.length) {
          last(square).isStanding = true;
        }
      } else {
        // Do movement
        if (square.length && last(square).isStanding) {
          if (stack[0].isCapstone) {
            if (ply && !flatten) {
              flatten = ply.wallSmash = "*";
              this._updatePTN();
            }
          } else {
            console.error("Invalid ply");
            return false;
          }
        }
        if (flatten && square.length) {
          last(square).isStanding = false;
        } else if (flatten) {
          ply.wallSmash = "";
          this._updatePTN();
        }

        times(count, () => {
          let piece = stack.pop();
          if (!piece) {
            console.error("Invalid ply");
            return false;
          }
          piece.square = square;
          square.push(piece);
        });
      }
    });

    return true;
  }

  _undoMoveset(moveset, color = 1, ply = null) {
    return this._doMoveset(
      moveset
        .map(move => ({
          ...move,
          action: move.action === "pop" ? "push" : "pop"
        }))
        .reverse(),
      color,
      ply
    );
  }

  _doTPS({ grid }) {
    let stack, square, piece, type;
    grid.forEach((row, y) => {
      row.forEach((col, x) => {
        if (col[0] !== "x") {
          stack = col.split("");
          square = this.state.squares[y][x];
          while ((piece = stack.shift())) {
            if (/[SC]/.test(stack[0])) {
              type = stack.shift();
            } else {
              type = "flat";
            }
            piece = new Piece({
              square,
              game: this,
              color: 1 * piece,
              type
            });
            square.push(piece);
            this.state.pieces[piece.color][piece.type].push(piece);
          }
        }
      });
    });
  }

  goToPly(plyID, isDone) {
    const targetPly = this.plies[plyID];

    if (!targetPly || this.state.selected.pieces.length) {
      return false;
    }

    const target = {
      plyIsDone: isDone,
      move: targetPly.move,
      branch: targetPly.branch,
      number: targetPly.move.linenum.number
    };

    // Load a board state?
    if (!this.state.ply.isInBranch(target.branch)) {
      let parentPly = this.branches[target.branch];
      while (parentPly && !(parentPly.id in this.boards)) {
        // Find the closest branch that has a saved board state
        parentPly = this.branches[parentPly.branches[0].branch];
      }
      if (
        parentPly &&
        parentPly.id in this.boards &&
        "false" in this.boards[parentPly.id]
      ) {
        // Load the board state
        this.state.setBoard(
          this.boards[parentPly.id].false,
          parentPly.id,
          false
        );
      } else {
        // Failed to find a close board state, so go to the beginning
        // (This should theoretically never happen)
        console.log("Failed to find a close board state");
        this.state.setBoard(this.boards[0].false, 0, false);
      }
    } else if (
      plyID in this.boards &&
      Math.abs(targetPly.index - this.state.ply.index) > this.size * this.size
    ) {
      // Load board state if it exists and is far enough away
      if (!(isDone in this.boards[plyID])) {
        isDone = !isDone;
      }
      this.state.setBoard(this.boards[plyID][isDone], plyID, isDone);
    }

    // Set targetBranch if target is outside of it
    if (!targetPly.isInBranch(this.state.targetBranch)) {
      this.state.targetBranch = target.branch;
    }

    if (this.state.ply.branches.includes(targetPly)) {
      // Switch to the target branch if we're on a sibling
      if (this.state.plyIsDone) {
        this._undoPly();
      }
      this._setPly(targetPly.id, false);
    }

    if (this.state.ply.index < targetPly.index) {
      while (this.state.ply.index < targetPly.index && this._doPly()) {
        // Go forward until we reach the target ply
      }
    } else if (this.state.ply.index > targetPly.index) {
      while (this.state.ply.index > targetPly.index && this._undoPly()) {
        // Go backward until we reach the target ply
      }
    }

    // Do or undo the target ply
    if (target.plyIsDone !== this.state.plyIsDone) {
      if (target.plyIsDone) {
        this._doPly();
      } else {
        this._undoPly();
      }
    }

    return true;
  }

  first() {
    return this.goToPly(this.state.plies[0].id, false);
  }

  last() {
    return this.goToPly(last(this.state.plies).id, true);
  }

  prev(half = false) {
    if (this.state.selected.pieces.length) {
      return false;
    }
    if (this.state.plyIsDone) {
      return this._undoPly();
    } else if (this.state.prevPly) {
      return this.goToPly(this.state.prevPly.id, half);
    }
    return false;
  }

  next(half = false) {
    if (this.state.selected.pieces.length) {
      return false;
    }
    if (!this.state.plyIsDone) {
      return this._doPly();
    } else if (this.state.nextPly) {
      return this.goToPly(this.state.nextPly.id, !half);
    }
    return false;
  }
}
