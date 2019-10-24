import Linenum from "../Linenum";
import Move from "../Move";
import Nop from "../Nop";
import Ply from "../Ply";
import Tag from "../Tag";

import { isArray } from "lodash";

export default class GameMutations {
  _renameBranch(oldBranch, newBranch) {
    if (newBranch in this.branches) {
      return false;
    }

    // Update moves/linenums
    this.moves.forEach(move => {
      if (move.branch.startsWith(oldBranch)) {
        move.branch = move.branch.replace(oldBranch, newBranch);
      }
    });

    // Update branches
    let branches = {};
    Object.values(this.branches).forEach(ply => {
      if (ply) {
        branches[ply.branch] = ply;
      }
    });
    this.branches = branches;

    // Update targetBranch
    if (this.state.targetBranch.startsWith(oldBranch)) {
      this.state.targetBranch = this.state.targetBranch.replace(
        oldBranch,
        newBranch
      );
    }

    return true;
  }

  renameBranch(oldBranch, newBranch) {
    this.recordChange(() => {
      if (this._renameBranch(oldBranch, newBranch)) {
        this._updatePTN();
      }
    });
  }

  _trimToPly() {
    this.tags.tps = Tag.parse(`[TPS "${this.state.tps}"]`);

    const boardPly = this.state.boardPly;
    const newPly = boardPly.isDone
      ? this.state.plies[this.plies[boardPly.id].index + 1]
      : this.plies[boardPly.id];

    if (!newPly) {
      return false;
    }

    if (newPly.branch) {
      // Remove preceeding and non-descendent plies
      this._deletePlies(
        this.plies
          .filter(
            ply =>
              ply.index < newPly.index ||
              !ply.branch.startsWith(newPly.branch) ||
              (!newPly.isInBranch(ply.branch) && !newPly.hasBranch(ply.branch))
          )
          .map(ply => ply.id),
        false,
        false
      );

      this.branches[newPly.branch] = newPly;

      // Make branch primary
      this._renameBranch(newPly.branch, "");
    } else {
      // Remove preceeding plies
      this._deletePlies(
        this.state.plies.slice(0, newPly.index).map(ply => ply.id)
      );
    }

    this._setPly(newPly.id, false);

    this._updatePTN();
    this.init(this.ptn, { ...this, state: null });
    return true;
  }

  trimToPly() {
    if (!this.state.ply) {
      return;
    }
    this.recordChange(this._trimToPly);
  }

  _trimToBoard() {
    this.tags.tps = Tag.parse(`[TPS "${this.state.tps}"]`);
    this.branches = {};
    this.moves = [];
    this.plies = [];
    this.chatlog = {};
    this._updatePTN();
    this.init(this.ptn, { ...this, state: null });
  }

  trimToBoard() {
    if (!this.state.ply) {
      return;
    }
    this.recordChange(this._trimToBoard);
  }

  _deletePly(plyID, removeDescendents = false, removeOrphans = true) {
    const ply = this.plies[plyID];
    if (!ply) {
      return false;
    }
    const move = ply.move;

    // Remove branch(es)
    if (ply.branches && ply.branches.length > 1) {
      if (removeOrphans && ply.branches[0] === ply) {
        // Remove all branches if original
        ply.branches
          .slice(1)
          .forEach(ply => this._deletePly(ply.id, true, removeOrphans));
      } else {
        // Remove branch
        delete this.branches[ply.branch];
        if (ply.branches.length === 2) {
          ply.branches[0].branches = [];
        } else {
          ply.branches.splice(ply.branches.indexOf(ply), 1);
        }
      }
    }

    // Remove descendents
    if (removeDescendents) {
      const nextPly = this.plies.find(
        nextPly =>
          nextPly &&
          nextPly.branch === ply.branch &&
          nextPly.index === ply.index + 1
      );

      if (nextPly) {
        this._deletePly(nextPly.id, true, removeOrphans);
      }
    }

    // Remove self
    this.removePlyComments(ply.id);
    move.setPly(null, ply.player - 1);
    this.plies[ply.id] = null;

    // Remove move if necessary
    if (move.plies.length === 0 && this.moves.length > 1) {
      this.moves.splice(this.moves.indexOf(move), 1);
    }
    return true;
  }

  deletePly() {
    this.deletePlies.apply(this, arguments);
  }

  _deletePlies(plyIDs, removeDescendents = false, removeOrphans = true) {
    let success = false;
    let i = 0;
    while (
      i < plyIDs.length &&
      (success = this._deletePly(plyIDs[i++], removeDescendents, removeOrphans))
    ) {
      // Delete plies unless there's a problem
    }
    return success;
  }

  deletePlies(plyIDs, recordChange = true) {
    let success = false;
    let ply = this.state.ply;

    if (isArray(plyIDs)) {
      success = this._deletePlies(plyIDs);
    } else {
      success = this._deletePly(plyIDs);
    }

    // Finish up
    if (success) {
      // Pick a new ply to go to if necessary
      if (
        this.state.plyID in this.plies &&
        this.plies[this.state.plyID] === null
      ) {
        if (ply && ply.index < this.state.plies.length) {
          let i = ply.index;
          while (i >= 0 && !(ply = this.state.plies[--i])) {
            // Go back until we've found a ply or we're at the beginning
          }
        }
      }

      const finish = () => {
        if (ply) {
          this.goToPly(ply.id, true);
        } else if (!this.state.ply) {
          if (this.state.plyIsDone) {
            this._undoPly();
          }
          this._setPly(-1, false);
        }
        this._updatePTN();
      };

      if (recordChange) {
        this.recordChange(finish);
      } else {
        finish();
      }
      this.init(this.ptn, { ...this, state: this.minState });
    }
    return success;
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
      if (ply.id === 0) {
        this.branches[ply.branch] = ply;
      }
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
      // Check to see if ply already exists
      let equalPly = null;
      if (this.state.plyIsDone) {
        if (this.state.nextPly && this.state.nextPly.isEqual(ply)) {
          equalPly = this.state.nextPly;
        }
      } else if (this.state.ply) {
        if (this.state.ply.isEqual(ply)) {
          equalPly = this.state.ply;
        } else if (this.state.ply.branches.length) {
          equalPly = this.state.ply.branches.find(branch =>
            branch.isEqual(ply)
          );
        }
      }
      if (equalPly) {
        if (isAlreadyDone) {
          this._setPly(equalPly.id, true);
          this._afterPly(equalPly);
        } else {
          this.goToPly(equalPly.id, true);
        }
        return;
      }

      // New branch
      if (
        !this.state.plyIsDone &&
        this.state.ply &&
        this.state.ply.branches.length
      ) {
        ply.branch = this.newBranchID(
          this.state.ply ? this.state.ply.branches[0].branch : "",
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
      this.state.targetBranch = ply.branch;
      if (!isAlreadyDone) {
        // do ply;
        if (!this.state.ply && ply.id === 0) {
          this._setPly(ply.id, false);
          this._doPly();
        } else {
          this.goToPly(ply.id, true);
        }
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
