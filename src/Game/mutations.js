import Linenum from "./PTN/Linenum";
import Move from "./PTN/Move";
import Nop from "./PTN/Nop";
import Ply from "./PTN/Ply";
import Tag from "./PTN/Tag";

import { escapeRegExp, isArray } from "lodash";

export default class GameMutations {
  replacePTN(ptn, state = this.minState) {
    this.recordChange(() => {
      this.init(ptn, { ...this.params, state });
    });
  }

  _renameBranch(oldBranch, newBranch, force = false) {
    if (oldBranch === newBranch) {
      return false;
    }

    const oldBranchRegExp = new RegExp(
      "^" + (oldBranch ? escapeRegExp(oldBranch) + "(\\/|$)" : "")
    );
    const newBranchFull = newBranch ? newBranch + "$1" : "";

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
    this.moves.forEach((move) => {
      move.branch = move.branch.replace(oldBranchRegExp, newBranchFull);
    });

    // Update branches
    let branches = {};
    Object.values(this.branches).forEach((ply) => {
      if (ply) {
        if (
          !(ply.branch in branches) ||
          ply.index < branches[ply.branch].index
        ) {
          branches[ply.branch] = ply;
        }
      }
    });
    this.branches = branches;

    // Update targetBranch
    this.board.targetBranch = this.board.targetBranch.replace(
      oldBranchRegExp,
      newBranchFull
    );

    return true;
  }

  renameBranch(oldBranch, newBranch) {
    this.recordChange(() => {
      if (this._renameBranch(oldBranch, newBranch)) {
        this._updatePTN();
      }
    });
    this.board.updatePTNOutput();
    this.board.updatePositionOutput();
  }

  _trimToPly() {
    if (this.board.plyIsDone && !this.board.nextPly) {
      this._trimToBoard();
      return true;
    }

    this.tags.tps = new Tag(false, "tps", this.board.tps);

    const boardPlyInfo = this.board.boardPly;
    const boardPly = this.plies[boardPlyInfo.id];
    const newPly = boardPlyInfo.isDone
      ? this.board.plies[boardPly.index + 1]
      : boardPly;

    if (!newPly) {
      return false;
    }

    if (newPly.branch) {
      // Remove preceeding and non-descendent plies
      newPly.children = this.branches[newPly.branch].children.filter(
        (ply) => ply.index >= newPly.index
      );
      this._deletePlies(
        this.plies
          .filter(
            (ply) =>
              ply.index < newPly.index ||
              (!newPly.isInBranch(ply.branch) && !newPly.hasBranch(ply.branch))
          )
          .map((ply) => ply.id)
      );

      // Remove original descendents
      if (newPly.branches.length && newPly.branches[0].branch === "") {
        this._deletePlies(
          this.plies
            .filter(
              (ply) => ply && ply.index >= newPly.index && ply.branch === ""
            )
            .map((ply) => ply.id)
        );
      }

      this.branches[newPly.branch] = newPly;

      // Make branch primary
      this._renameBranch(newPly.branch, "", true);
    } else {
      // Remove preceeding plies
      this._deletePlies(
        this.board.plies.slice(0, newPly.index).map((ply) => ply.id),
        false,
        true
      );
    }

    this.board._setPly(newPly.id, false);

    this._updatePTN();
    this.init(this.ptn, { ...this.params, state: null });
    return true;
  }

  trimToPly() {
    if (!this.board.ply || (!this.board.plyID && !this.board.plyIsDone)) {
      return;
    }
    this.recordChange(this._trimToPly);
  }

  _trimToBoard() {
    this.init(this.headerText(), {
      ...this.params,
      state: null,
      tags: {
        ...this.tags,
        tps: new Tag(false, "tps", this.board.tps),
      },
    });
  }

  trimToBoard() {
    if (!this.board.ply) {
      return;
    }
    this.recordChange(this._trimToBoard);
  }

  trimBranches() {
    if (Object.keys(this.branches).length === 1) {
      return;
    }
    this.recordChange(() => {
      this.init(this.toString(false), {
        ...this.params,
        state: { ...this.minState, targetBranch: "" },
      });
    });
  }

  _deletePly(plyID, removeDescendents = false, removeOrphans = false) {
    const ply = this.plies[plyID];
    if (!ply) {
      return false;
    }
    const move = ply.move;
    const plyWasDone = this.board.plyIsDone;

    // Go backward if deleting current ply
    if (this.board.plyID === plyID) {
      if (plyWasDone) {
        this.board._undoPly();
      }
      if (!removeOrphans && ply.branches && ply.branches.length > 1) {
        if (ply.branches[0] === ply) {
          this.board._setPly(ply.branches[1].id, plyWasDone);
        } else {
          this.board._setPly(ply.branches[0].id, plyWasDone);
        }
      } else {
        const prevPly = this.board.prevPly;
        if (prevPly) {
          if (ply.branch !== prevPly.branch) {
            this.board.targetBranch = prevPly.branch;
          }
          this.board._setPly(prevPly.id, true);
        }
      }
    }

    // Remove descendents
    if (removeDescendents) {
      const nextPly = this.plies.find(
        (nextPly) =>
          nextPly &&
          nextPly.branch === ply.branch &&
          nextPly.index === ply.index + 1
      );

      if (nextPly) {
        this._deletePly(nextPly.id, true, true);
      }
    }

    // Remove branch(es)
    if (ply.branches && ply.branches.length > 1) {
      if (ply.branches[0] === ply) {
        // Remove primary branch
        if (removeOrphans) {
          // Remove all branches
          ply.branches
            .slice(1)
            .forEach((ply) => this._deletePly(ply.id, true, removeOrphans));
        } else {
          // Replace with next branch
          const nextBranchPly = ply.branches[1];
          const nextBranch = nextBranchPly.branch;

          // Remove ply
          this.plies[ply.id] = null;

          // Replace or merge with next branch
          this.moves.splice(this.moves.indexOf(nextBranchPly.move), 1);
          if (ply.player === 1) {
            move.ply2 = nextBranchPly.move.ply2;
            move.ply1 = nextBranchPly;
          } else {
            move.ply2 = nextBranchPly;
          }

          // Make next branch primary
          this._renameBranch(nextBranch, ply.branch, true);
        }
      } else {
        ply.branches[0].removeBranch(ply);
      }
    }

    // Remove ply
    this.removePlyComments(ply.id);
    if (move.plies[ply.player - 1] === ply) {
      // Remove from move if not replaced
      move.setPly(null, ply.player - 1);
    }
    this.plies[ply.id] = null;

    // Remove move if necessary
    if (move.plies.length === 0 && this.moves.length > 1) {
      this.moves.splice(this.moves.indexOf(move), 1);
    }

    // Make sure target branch exists
    if (!(this.board.targetBranch in this.branches)) {
      this.board.targetBranch = this.board.ply.branch;
    }

    return true;
  }

  deletePly() {
    this.deletePlies.apply(this, arguments);
  }

  _deletePlies(plyIDs, removeDescendents = false, removeOrphans = false) {
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
    removeOrphans = false
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

    this.init(this.ptn, this.params);
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
          replaceCurrent && !this.board.nextPly
            ? this.board.plyID
            : this.plies.length,
      });
    }
    this.board.dirtyPly(ply.id);
    if (replaceCurrent && !this.board.plyIsDone && this.board.prevPly) {
      this.board._setPly(this.board.prevPly.id, true);
    } else if (!replaceCurrent && this.board.plyIsDone && this.board.nextPly) {
      this.board._setPly(this.board.nextPly.id, false);
    }

    let move = this.board.move;

    ply.color = replaceCurrent ? this.board.ply.color : this.board.color;
    ply.player = replaceCurrent ? this.board.ply.player : this.board.turn;

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
        !this.board.nextPly &&
        this.board.plyIsDone)
    ) {
      // Next move in the branch
      const number = this.board.number + 1;
      move = this.moves.find(
        ({ linenum }) =>
          linenum.branch === this.board.branch && linenum.number === number
      );
      if (move) {
        move.ply1 = ply;
      } else {
        // New move
        move = new Move({
          game: this,
          id: this.moves.length,
          linenum: new Linenum(number + ". ", this, this.board.branch),
          ply1: ply,
        });
        this.moves.push(move);
        this.board.dirtyMove(move.id);
      }
    } else {
      // Check to see if ply already exists
      let equalPly = null;
      if (this.board.plyIsDone && !replaceCurrent) {
        if (this.board.nextPly && this.board.nextPly.isEqual(ply)) {
          equalPly = this.board.nextPly;
        }
      } else if (this.board.ply) {
        if (this.board.ply.isEqual(ply)) {
          equalPly = this.board.ply;
        } else if (this.board.ply.branches.length) {
          equalPly = this.board.ply.branches.find((branch) =>
            branch.isEqual(ply)
          );
        }
      }
      if (equalPly) {
        if (isAlreadyDone) {
          if (!this.board.targetBranch.startsWith(equalPly.branch + "/")) {
            this.board.targetBranch = equalPly.branch;
          }
          this.board._setPly(equalPly.id, true);
          this.board._afterPly(equalPly, true);
          this.board.setRoads(equalPly.result ? equalPly.result.roads : null);
        } else {
          if (replaceCurrent && !this.board.nextPly) {
            // Delete newly formed branch
            this.recordChange(() => {
              if (this.board.plyIsDone) {
                this.board._undoPly();
              }
              let plyID = this.board.plyID;
              this.board.goToPly(equalPly.id, true);
              this.deletePly(plyID, false);
            });
          } else {
            this.board.goToPly(equalPly.id, true);
          }
        }
        return this.board.updatePositionOutput();
      }

      if (replaceCurrent && !this.board.nextPly) {
        // Replace ply
        move.setPly(ply, ply.player - 1);
      } else {
        // New branch
        if (
          (replaceCurrent || !this.board.plyIsDone) &&
          this.board.ply &&
          this.board.ply.branches.length
        ) {
          ply.branch = this.newBranchID(
            this.board.ply ? this.board.ply.branches[0].branch : "",
            this.board.number,
            ply.player
          );
        } else {
          ply.branch = this.newBranchID(
            this.board.branch,
            this.board.number,
            ply.player
          );
        }

        move = new Move({
          game: this,
          id: this.moves.length,
          linenum: new Linenum(this.board.number + ". ", this, ply.branch),
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

    if (ply.id === this.board.plyID) {
      this.plies.splice(ply.id, 1, ply);
      this.board.plies.splice(ply.index, 1, ply);
    } else {
      this.plies.push(ply);
    }

    this.recordChange(() => {
      this.board.targetBranch = ply.branch;

      if (!isAlreadyDone) {
        // do ply;
        if (!this.board.ply && ply.id === 0) {
          this.board._setPly(ply.id, false);
          this.board._doPly();
        } else if (replaceCurrent && ply.id === this.board.plyID) {
          this.board._undoPly();
          this.board._doPly();
        } else {
          this.board.goToPly(ply.id, true);
        }
      } else {
        this.board._setPly(ply.id, true);
      }

      if (ply.id === 0 && !this.tag("date")) {
        // Record date and time
        this.setTags(Tag.now(), false, false);
      }

      this.board.updateSquareConnections();
      if (this.board.checkGameEnd(false)) {
        if (ply.branch === "" || !this.tag("result")) {
          // Record result
          this.setTags({ result: ply.result.text }, false, false);
        }
        this.board.dirtyPly(ply.id);
        this.board.setRoads(ply.result.roads || null);
      }

      this._updatePTN();
      this.board.updatePTNOutput();
      this.board.updatePositionOutput();
    });
  }

  newBranchID(branch, number, player) {
    const prefix = branch ? branch + "/" : "";
    player = player ? (player === 2 ? "b" : "a") : "";
    let i = 1;
    do {
      branch = prefix + number + player + i++;
    } while (branch in this.branches);
    return branch;
  }
}
