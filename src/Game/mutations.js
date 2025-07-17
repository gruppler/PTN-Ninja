import Linenum from "./PTN/Linenum";
import Result from "./PTN/Result";
import Move from "./PTN/Move";
import Nop from "./PTN/Nop";
import Ply from "./PTN/Ply";
import Tag from "./PTN/Tag";

import { escapeRegExp, flatten, isArray, isFunction, uniqBy } from "lodash";

export default class GameMutations {
  replacePTN(ptn, state = this.minState) {
    this.recordChange(() => {
      this.init({ ...this.params, ptn, state });
    });
  }

  transform(transform) {
    let ptn = this.toString({ transform });
    this.replacePTN(ptn);
    return ptn;
  }

  promoteBranch(branch) {
    let ply = this.branches[branch];
    if (!ply) {
      throw new Error("Invalid branch");
    }
    const index = ply.branches.findIndex((p) => ply.id === p.id);
    if (index === 1) {
      return this.makeBranchMain(branch);
    } else {
      const oldID = ply.id;
      const newID = ply.branches[index - 1].id;
      let length = 0;
      while (ply && ply.isInBranch(branch)) {
        length += 1;
        ply = this.plies[ply.id + 1];
      }
      let plies = [...this.plies];
      let notes = {};
      let branchPlies = plies.splice(oldID, length);
      plies.splice(newID, 0, ...branchPlies);
      for (let id = 0; id < plies.length; id++) {
        if (plies[id].id !== id) {
          notes[id] = this.notes[plies[id].id];
          plies[id].id = id;
        } else {
          notes[id] = this.notes[id];
        }
      }
      this.notes = notes;
      this._updatePTN(true);
      this.init({ ...this.params, ptn: this.ptn });
    }
  }

  _makeBranchMain(branch, recursively) {
    let ply = this.branches[branch];
    if (!ply) {
      throw new Error("Invalid branch");
    }

    const getDescendents = (ply, excludeBranch, includeSiblings) => {
      const branch = ply.branch;
      const descendents = [];
      while (ply && ply.branch === branch) {
        if (!ply.isInBranch(excludeBranch)) {
          descendents.push(ply);
          if (includeSiblings && ply.branches.length) {
            descendents.push(
              ...flatten(
                ply.branches
                  .slice(ply.branches.findIndex((p) => ply.id === p.id) + 1)
                  .map((ply) => getDescendents(ply, excludeBranch, true))
              )
            );
          }
        }
        ply = this.plies[ply.id + 1];
        includeSiblings = true;
      }
      return uniqBy(descendents, "id");
    };

    const oldID = ply.id;
    const newID = ply.branches[0].id;
    const mainBranch = ply.branches[0].branch;

    // Collect branches to be swapped and their descendents
    let newMain = getDescendents(ply);
    let oldMain = getDescendents(this.plies[newID], branch);

    // Rename new main branches
    const oldBranchRegExp = new RegExp(
      "^" + (branch ? escapeRegExp(branch) + "(\\/|$)" : "")
    );
    const newBranchFull = branch && mainBranch ? mainBranch + "$1" : mainBranch;
    let length = 0;
    newMain.forEach((ply) => {
      if (ply.branch === branch) {
        length += 1;
      }
      ply.branch = ply.branch.replace(oldBranchRegExp, newBranchFull);
      ply.linenum.branch = ply.branch;
      if (this.board.plyID === ply.id) {
        this.board.targetBranch = ply.branch;
      }
    });

    // Rename old main branches
    const newBranchRegExp = new RegExp(
      "^" + (branch ? escapeRegExp(mainBranch) + "(\\/|$)" : "")
    );
    let oldBranchFull = branch && mainBranch ? branch + "$1" : branch;
    oldMain.forEach((ply) => {
      if (branch && mainBranch) {
        ply.branch = ply.branch.replace(newBranchRegExp, oldBranchFull);
      } else {
        ply.branch =
          ply.branch === mainBranch ? branch : branch + "/" + ply.branch;
      }
      ply.linenum.branch = ply.branch;
      if (this.board.plyID === ply.id) {
        this.board.targetBranch = ply.branch;
      }
    });

    // Move new main plies into position
    let plies = [...this.plies];
    let notes = {};

    // Swap moves' first plies if necessary
    if (newMain[0].move.ply1.isNop) {
      const nop = newMain[0].move.ply1;
      newMain[0].move.plies[0] = oldMain[0].move.ply1;
      oldMain[0].move.plies[0] = nop;
    }

    newMain = plies.splice(oldID, length);
    plies.splice(newID, 0, ...newMain);
    for (let id = 0; id < plies.length; id++) {
      if (plies[id].id !== id) {
        notes[id] = this.notes[plies[id].id];
        plies[id].id = id;
      } else {
        notes[id] = this.notes[id];
      }
    }
    this.notes = notes;

    // Mark old main as new branch
    oldMain[0].linenum.isRoot = true;

    // Sort siblings
    newMain[0].branches.sort((a, b) => a.id - b.id);
    oldMain[0].branches.sort((a, b) => a.id - b.id);

    // Update game branches
    let branches = {};
    plies.forEach((ply) => {
      ply.children = [];
      if (!(ply.branch in branches)) {
        branches[ply.branch] = ply;
        if (ply.id === 0 && ply.branches.length) {
          ply.children.push(ply);
        }
      } else {
        if (ply.branches.length) {
          ply.branches.parent = branches[ply.branch];
          ply.branches.parent.children.push(ply);
        }
      }
    });

    this.branches = branches;

    if (recursively && mainBranch) {
      this._updatePTN();
      this.init({ ...this.params, ptn: this.ptn });
      this._makeBranchMain(mainBranch, true);
    }

    return true;
  }

  makeBranchMain(branch, recursively = false) {
    this.recordChange(() => {
      if (this._makeBranchMain(branch, recursively)) {
        this._updatePTN();
      }
      this.init({ ...this.params, ptn: this.ptn });
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
      this.board.dirtyMove(move.id);
      move.plies.forEach((ply) => {
        if (ply) {
          this.board.dirtyPly(ply.id);
        }
      });
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
        this.board.updatePTNOutput();
        this.board.updatePositionOutput();
      }
    });
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
    this.init({ ...this.params, ptn: this.ptn, state: { plyIndex: 0 } });
    return true;
  }

  trimToPly() {
    if (!this.board.ply || (!this.board.plyID && !this.board.plyIsDone)) {
      return;
    }
    this.recordChange(this._trimToPly);
  }

  _trimToBoard() {
    this.init({
      ...this.params,
      ptn: this.headerText(),
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
      this.init({
        ...this.params,
        ptn: this.toString({ showAllBranches: false }),
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

    // If deleting current ply...
    if (this.board.plyID === plyID) {
      // Undo current ply
      if (plyWasDone) {
        this.board._undoPly();
      }
      // If deleting a ply with branches/siblings...
      if (!removeOrphans && ply.branches && ply.branches.length > 1) {
        let index = ply.branches.findIndex((p) => ply.id === p.id);
        if (index < ply.branches.length - 1) {
          // Go to the next sibling
          index += 1;
        } else {
          // ...unless it's the last one; then go to the previous one
          index -= 1;
        }
        this.board._setPly(ply.branches[index].id, plyWasDone);
      } else {
        // Go to the previous ply if there is one
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

    this.init(this.params);
    return success;
  }

  deleteBranch(branch, recordChange = true) {
    if (!(branch in this.branches)) {
      throw new Error("Invalid branch");
    }
    this.deletePly(this.branches[branch].id, recordChange, true);
  }

  _insertPly(ply, isAlreadyDone = false, replaceCurrent = false) {
    let boardPly = this.board.ply;
    const tps = this.board.tps;

    if (ply.constructor !== Ply) {
      if (Linenum.test(ply) || Result.test(ply)) {
        // Silently ignore line numbers and results
        return;
      }

      ply = Ply.parse(ply, {
        id:
          replaceCurrent && boardPly && !this.board.nextPly
            ? boardPly.id
            : this.plies.length,
        color: replaceCurrent && boardPly ? boardPly.color : this.board.color,
        player: replaceCurrent && boardPly ? boardPly.player : this.board.turn,
        beforeTPS: tps,
      });
    } else {
      ply.beforeTPS = tps;
    }
    ply.tpsBefore = this.board.tps;

    // Validate
    if (
      this.board.isGameEnd &&
      !this.board.isGameEndDefault &&
      !isAlreadyDone
    ) {
      throw new Error("The game has ended");
    }
    if (ply.pieceCount > this.size) {
      throw new Error("Ply violates carry limit");
    }
    if (!ply.isValid) {
      throw new Error("Invalid ply");
    }
    if (
      this.board.isFirstMove &&
      this.openingSwap &&
      (ply.specialPiece || ply.movement)
    ) {
      throw new Error("Invalid first move");
    }
    if (!isAlreadyDone) {
      if (replaceCurrent && this.board.plyIsDone) {
        this.board._undoMoveset(boardPly.toMoveset(), boardPly.color, boardPly);
      }
      this.board._doMoveset(ply.toMoveset(), ply.color, ply);
      this.board._undoMoveset(ply.toMoveset(), ply.color, ply);
      if (replaceCurrent && this.board.plyIsDone) {
        this.board._doMoveset(boardPly.toMoveset(), boardPly.color, boardPly);
      }
    }

    this.board.dirtyPly(ply.id);
    if (replaceCurrent && !this.board.plyIsDone && this.board.prevPly) {
      this.board._setPly(this.board.prevPly.id, true);
    } else if (!replaceCurrent && this.board.plyIsDone && this.board.nextPly) {
      this.board._setPly(this.board.nextPly.id, false);
    }

    boardPly = this.board.ply;
    let move = this.board.move;

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
      } else if (boardPly) {
        if (boardPly.isEqual(ply)) {
          equalPly = boardPly;
        } else if (boardPly.branches.length) {
          equalPly = boardPly.branches.find((branch) => branch.isEqual(ply));
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
          this.board.updatePTNBranchOutput();
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
          boardPly &&
          boardPly.branches.length
        ) {
          ply.branch = this.newBranchID(
            boardPly ? boardPly.branches[0].branch : "",
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
        ply.branches.forEach((ply) => {
          this.board.dirtyPly(ply.id);
        });
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

    // Mutate

    this.board.targetBranch = ply.branch;

    if (!isAlreadyDone) {
      // do ply;
      if (!boardPly && ply.id === 0) {
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
      if (ply.branch === "" && !this.tag("result")) {
        // Record result
        this.setTags({ result: ply.result.text }, false, false);
      }
      this.board.dirtyPly(ply.id);
      this.board.setRoads(ply.result.roads || null);
    }
    ply.tpsAfter = this.board.tps;

    return ply;
  }

  insertPly(ply, isAlreadyDone = false, replaceCurrent = false) {
    return this.recordChange(() => {
      if (this._insertPly.apply(this, arguments)) {
        this._updatePTN();
        this.board.updatePTNOutput();
        this.board.updatePositionOutput();
        this.board.updateBoardOutput();
        if (isFunction(this.onInsertPly)) {
          if (ply.constructor === Ply) {
            ply = ply.text;
          } else {
            ply = new Ply(ply, {}).text;
          }
          this.onInsertPly(this, ply);
        }
        return true;
      }
    });
  }

  insertPlies(plies, prev = 0) {
    const returnedPlies = [];
    return this.recordChange(() => {
      for (let i = 0; i < plies.length; i++) {
        try {
          const ply = this._insertPly(plies[i]);
          if (ply) {
            returnedPlies.push(ply);
          }
        } catch (error) {
          console.error(error);
          break;
        }
      }
      if (prev) {
        this.board.prev(false, prev);
      }
      this._updatePTN();
      this.board.updatePTNOutput();
      this.board.updatePositionOutput();
      this.board.updateBoardOutput();
      return returnedPlies;
    });
  }

  newBranchID(branch, number, player) {
    const prefix = branch ? branch + "/" : "";
    player = player ? (player === 2 ? "b" : "w") : "";
    let i = 1;
    do {
      branch = prefix + number + player + i++;
    } while (branch in this.branches);
    return branch;
  }
}
