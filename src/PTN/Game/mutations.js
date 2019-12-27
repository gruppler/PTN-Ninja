import Linenum from "../Linenum";
import Move from "../Move";
import Nop from "../Nop";
import Ply from "../Ply";
import Tag from "../Tag";

import { isArray } from "lodash";

export default class GameMutations {
  _renameBranch(oldBranch, newBranch, force = false) {
    if (oldBranch === newBranch) {
      return false;
    }
    if (!force) {
      if (!Linenum.validateBranch(newBranch, true)) {
        throw new Error("Invalid branch name");
      }
      if (!(oldBranch in this.branches)) {
        throw new Error("Invalid branch");
      }
      if (newBranch in this.branches) {
        throw new Error("Branch already exists");
      }
    }

    // Update moves/linenums
    this.moves.forEach(move => {
      if (move.branch === oldBranch) {
        move.branch = newBranch;
      } else if (move.branch.startsWith(oldBranch + "/")) {
        move.branch = move.branch.replace(oldBranch + "/", newBranch);
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
    if (this.state.targetBranch === oldBranch) {
      this.state.targetBranch = newBranch;
    } else if (this.state.targetBranch.startsWith(oldBranch + "/")) {
      this.state.targetBranch = this.state.targetBranch.replace(
        oldBranch + "/",
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
    if (this.state.plyIsDone && !this.state.nextPly) {
      this._trimToBoard();
      return true;
    }

    this.tags.tps = new Tag(false, "tps", this.state.tps);

    const boardPlyInfo = this.state.boardPly;
    const boardPly = this.plies[boardPlyInfo.id];
    const newPly = boardPlyInfo.isDone
      ? this.state.plies[boardPly.index + 1]
      : boardPly;

    if (!newPly) {
      return false;
    }

    if (newPly.branch) {
      // Remove preceeding and non-descendent plies
      newPly.children = this.branches[newPly.branch].children.filter(
        ply => ply.index >= newPly.index
      );
      this._deletePlies(
        this.plies
          .filter(
            ply =>
              ply.index < newPly.index ||
              (!newPly.isInBranch(ply.branch) && !newPly.hasBranch(ply.branch))
          )
          .map(ply => ply.id),
        false,
        false
      );

      // Remove original descendents
      if (newPly.branches.length && newPly.branches[0].branch === "") {
        this._deletePlies(
          this.plies
            .filter(
              ply => ply && ply.index >= newPly.index && ply.branch === ""
            )
            .map(ply => ply.id),
          false,
          false
        );
      }

      this.branches[newPly.branch] = newPly;

      // Make branch primary
      this._renameBranch(newPly.branch, "", true);
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
    if (!this.state.ply || (!this.state.plyID && !this.state.plyIsDone)) {
      return;
    }
    this.recordChange(this._trimToPly);
  }

  _trimToBoard() {
    this.tags.tps = new Tag(false, "tps", this.state.tps);
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

  trimBranches() {
    if (Object.keys(this.branches).length === 1) {
      return;
    }
    this.recordChange(() => {
      this.init(this.text(false), {
        ...this,
        state: { ...this.minState, targetBranch: "" }
      });
    });
  }

  _deletePly(plyID, removeDescendents = false, removeOrphans = true) {
    const ply = this.plies[plyID];
    if (!ply) {
      return false;
    }
    const move = ply.move;

    // Go backward if deleting current ply
    if (this.state.plyID === plyID) {
      if (this.state.plyIsDone) {
        this._undoPly();
      }
      const prevPly = this.state.prevPly;
      if (prevPly) {
        if (ply.branch !== prevPly.branch) {
          this.state.targetBranch = prevPly.branch;
        }
        this._setPly(prevPly.id, true);
      }
    }

    // Remove branch(es)
    if (ply.branches && ply.branches.length > 1) {
      if (removeOrphans && ply.branches[0] === ply) {
        // Remove all branches if original
        ply.branches
          .slice(1)
          .forEach(ply => this._deletePly(ply.id, true, removeOrphans));
      } else {
        ply.branches[0].removeBranch(ply);
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

    // Make sure target branch exists
    if (!(this.state.targetBranch in this.branches)) {
      this.state.targetBranch = this.state.ply.branch;
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

  deletePlies(
    plyIDs,
    recordChange = true,
    removeDescendents = false,
    removeOrphans = true
  ) {
    let success = false;

    const mutate = () => {
      if (isArray(plyIDs)) {
        success = this._deletePlies(plyIDs, removeDescendents, removeOrphans);
      } else {
        success = this._deletePly(plyIDs, removeDescendents, removeOrphans);
      }
      if (success) {
        this._updatePTN();
      }
    };

    if (recordChange) {
      this.recordChange(mutate);
    } else {
      mutate();
    }

    this.init(this.ptn, { ...this, state: this.minState });
    return success;
  }

  deleteBranch(branch, recordChange = true) {
    if (!(branch in this.branches)) {
      throw new Error("Invalid branch");
    }
    this.deletePly(this.branches[branch].id, recordChange, true);
  }

  insertPly(ply, isAlreadyDone = false, replaceCurrent = false) {
    if (ply.constructor !== Ply) {
      ply = Ply.parse(ply, {
        id:
          replaceCurrent && !this.state.nextPly
            ? this.state.plyID
            : this.plies.length
      });
    }
    if (replaceCurrent && !this.state.plyIsDone && this.state.prevPly) {
      this._setPly(this.state.prevPly.id, true);
    } else if (!replaceCurrent && this.state.plyIsDone && this.state.nextPly) {
      this._setPly(this.state.nextPly.id, false);
    }

    let move = this.state.move;

    ply.color = replaceCurrent ? this.state.ply.color : this.state.color;
    ply.player = replaceCurrent ? this.state.ply.player : this.state.turn;

    if (!move.plies[ply.player - 1]) {
      // Next ply in the move
      move.setPly(ply, ply.player - 1);
      if (ply.id === 0) {
        this.branches[ply.branch] = ply;
      }
    } else if (
      !move ||
      (!replaceCurrent &&
        ply.player === 1 &&
        !this.state.nextPly &&
        this.state.plyIsDone)
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
          linenum: new Linenum(number + ". ", this, this.state.branch),
          ply1: ply
        });
        this.moves.push(move);
      }
    } else {
      // Check to see if ply already exists
      let equalPly = null;
      if (this.state.plyIsDone && !replaceCurrent) {
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
          if (replaceCurrent && !this.state.nextPly) {
            // Delete newly formed branch
            this.recordChange(() => {
              if (this.state.plyIsDone) {
                this._undoPly();
              }
              let plyID = this.state.plyID;
              this.goToPly(equalPly.id, true);
              this.deletePly(plyID, false);
            });
          } else {
            this.goToPly(equalPly.id, true);
          }
        }
        return;
      }

      if (replaceCurrent && !this.state.nextPly) {
        // Replace ply
        move.setPly(ply, ply.player - 1);
      } else {
        // New branch
        if (
          (replaceCurrent || !this.state.plyIsDone) &&
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
          linenum: new Linenum(this.state.number + ". ", this, ply.branch)
        });

        if (ply.player === 2) {
          move.ply1 = Nop.parse("--");
        }
        move.setPly(ply, ply.player - 1);
        this.moves.push(move);
        this.branches[ply.branch] = ply;
      }
    }

    if (
      move.number === this.firstMoveNumber &&
      this.firstPlayer === 2 &&
      !move.ply1
    ) {
      move.ply1 = Nop.parse("--");
    }

    if (ply.id === this.state.plyID) {
      this.plies.splice(ply.id, 1, ply);
      this.state.plies.splice(ply.index, 1, ply);
    } else {
      this.plies.push(ply);
    }

    this.recordChange(() => {
      this.state.targetBranch = ply.branch;

      if (!isAlreadyDone) {
        // do ply;
        if (!this.state.ply && ply.id === 0) {
          this._setPly(ply.id, false);
          this._doPly();
        } else if (replaceCurrent && ply.id === this.state.plyID) {
          this._undoPly();
          this._doPly();
        } else {
          this.goToPly(ply.id, true);
        }
      } else {
        this._setPly(ply.id, true);
      }

      if (ply.id === 0 && !this.tag("date")) {
        // Record date and time
        this.setTags(Tag.now(), false, false);
      }

      if (this.checkGameEnd(false)) {
        if (ply.branch === "" || !this.tag("result")) {
          // Record result
          this.setTags({ result: ply.result.text }, false, false);
        }
      }

      this._updatePTN();
    });
  }

  newBranchID(branch, number) {
    const prefix = branch ? branch + "/" : "";
    let i = 1;
    do {
      branch = prefix + number + "-" + i++;
    } while (branch in this.branches);
    return branch;
  }
}
