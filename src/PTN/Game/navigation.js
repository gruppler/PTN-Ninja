import Piece from "../Piece";

import { defaults, last, times } from "lodash";

export default class GameNavigation {
  _setPly(plyID, isDone = false) {
    this.state.plyID = plyID;
    this.state.plyIsDone = isDone;
    this.updateState();
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
      this.updateState();
      return true;
    }
  }

  // After _setPly, update the rest of the state
  updateState() {
    this.state = defaults(this.state, this._state);

    if (this.state.plyID in this.plies) {
      let newPly = this.plies[this.state.plyID];
      let newMove = newPly.move;
      let newBranch = newPly.branch;
      let newNumber = newMove.linenum.number;
      const isDifferentBranch =
        this.state.branch !== newBranch ||
        this.state.targetBranch !== this.state._targetBranch;

      // Update lists of current branch's plies and moves
      if (isDifferentBranch || !this.state.plies) {
        if (newPly.isInBranch(this.state.targetBranch)) {
          this.state.plies = this.plies.filter(ply =>
            ply.isInBranch(this.state.targetBranch)
          );
        } else {
          this.state.plies = this.plies.filter(ply =>
            ply.isInBranch(this.state.branch)
          );
        }
        this.state.moves = [];
        this.state.plies.forEach(ply => {
          if (ply.player === 2 || !ply.move.ply2) {
            this.state.moves.push(ply.move);
          }
        });
      }

      // Update previous and next plies
      if (isDifferentBranch || this.state.ply !== newPly) {
        this.state.prevPly = newPly.index
          ? this.state.plies[newPly.index - 1]
          : null;
        this.state.nextPly =
          newPly.index < this.state.plies.length - 1
            ? this.state.plies[newPly.index + 1]
            : null;
      }

      this.state._targetBranch = this.state.targetBranch;
      this.state.ply = newPly;
      this.state.move = newMove;
      this.state.branch = newBranch;
      this.state.number = newNumber;
    }

    let flats = [0, 0];
    this.state.squares.forEach(row => {
      row.forEach(square => {
        if (square.length) {
          let piece = last(square);
          flats[piece.color - 1] += piece.isFlat;
        }
      });
    });
    this.state.flats = flats;

    this.state.isFirstMove =
      this.state.number === 1 &&
      (!this.state.ply || this.state.ply.index < 1 || !this.state.plyIsDone);

    if (this.state.ply) {
      this.state.isGameEnd = this.state.plyIsDone && !!this.state.ply.result;
      if (this.state.isGameEnd) {
        this.state.turn = this.state.ply.player;
      } else {
        this.state.turn = this.state.plyIsDone
          ? this.state.ply.player === 1
            ? 2
            : 1
          : this.state.ply.player;
      }
    } else {
      this.state.turn = this.firstPlayer;
    }

    if (this.state.isFirstMove) {
      this.state.color = this.state.turn === 1 ? 2 : 1;
    } else {
      this.state.color = this.state.turn;
    }

    if (this.isLocal) {
      this.state.player = this.state.turn;
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
        if (flatten) {
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
        if (flatten) {
          last(square).isStanding = false;
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
    let switchBranch = this.state.targetBranch !== this.state._targetBranch;

    if (!targetPly || this.state.selected.pieces.length) {
      return false;
    }

    const log = label => {
      if (process.env.NODE_ENV === "production") {
        return;
      }
      console.log(
        label,
        this.state.branch + this.state.number + ".",
        this.state.ply.text(),
        this.state.plyIsDone,
        Object.assign({}, this.state)
      );
    };

    const target = {
      ply: targetPly,
      plyIsDone: isDone,
      move: targetPly.move,
      branch: targetPly.branch,
      number: targetPly.move.linenum.number
    };

    log("started at");

    // Set targetBranch if target is outside of it
    if (!targetPly.isInBranch(this.state.targetBranch)) {
      switchBranch = true;
      this.state.targetBranch = target.branch;
      this.updateState();
    }

    // If current ply is outside target branch...
    let wentBack = false;
    while (
      !this.state.ply.isInBranch(target.branch) &&
      !this.state.ply.hasBranch(target.branch) &&
      this._undoPly()
    ) {
      // ...go back until we're on an ancestor or sibling of the target branch
      wentBack = true;
    }
    if (wentBack) {
      log("went back to");
    }

    if (
      switchBranch &&
      this.state.branch !== target.branch &&
      this.state.ply.hasBranch(target.branch)
    ) {
      if (this.state.plyIsDone) {
        this._undoPly();
      }
      this._setPly(this.state.ply.getBranch(target.branch).id, false);
      log("switched branch to");
    }

    if (this.state.ply.index < target.ply.index) {
      while (this.state.ply.index < target.ply.index && this._doPly()) {
        // Go forward until we reach the target ply
      }
      log("went forward to");
    } else if (this.state.ply.index > target.ply.index) {
      while (this.state.ply.index > target.ply.index && this._undoPly()) {
        // Go backward until we reach the target ply
      }
      log("went back again to");
    }

    // Do or undo the target ply
    if (target.plyIsDone !== this.state.plyIsDone) {
      if (target.plyIsDone) {
        this._doPly();
        log("did ply");
      } else {
        this._undoPly();
        log("undid ply");
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
