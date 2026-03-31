import Linenum from "./PTN/Linenum";
import Result from "./PTN/Result";
import Move from "./PTN/Move";
import Nop from "./PTN/Nop";
import Ply from "./PTN/Ply";
import Tag from "./PTN/Tag";

import { escapeRegExp, flatten, isArray, isFunction, uniqBy } from "lodash";

// Default branch name pattern: {moveNumber}{player}{index} e.g., "3w1", "14b2"
// Also handles nested branches like "3w1/4w1"
const DEFAULT_BRANCH_PATTERN = /^(\d+[wb]\d+)(\/\d+[wb]\d+)*$/;

export default class GameMutations {
  // Check if a branch name is a default auto-generated name
  _isDefaultBranchName(branchName) {
    if (!branchName) return true; // Main branch (empty string) is "default"
    return DEFAULT_BRANCH_PATTERN.test(branchName);
  }

  // Get the leaf segment of a branch name (last part after /)
  _getBranchLeaf(branchName) {
    if (!branchName) return "";
    const parts = branchName.split("/");
    return parts[parts.length - 1];
  }

  // Get the parent path of a branch name (everything before last /)
  _getBranchParent(branchName) {
    if (!branchName) return "";
    const lastSlash = branchName.lastIndexOf("/");
    return lastSlash >= 0 ? branchName.substring(0, lastSlash) : "";
  }

  // Generate a default branch name for a ply
  _generateDefaultBranchName(ply, index) {
    const moveNum = ply.move.number;
    const player = ply.player === 1 ? "w" : "b";
    return `${moveNum}${player}${index}`;
  }

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
    // Sort siblings by ID before determining index
    if (ply.branches.length) {
      ply.branches.sort((a, b) => a.id - b.id);
    }
    const index = ply.branches.findIndex((p) => ply.id === p.id);
    if (index === 1) {
      return this.makeBranchMain(branch);
    } else {
      this.recordChange(() => {
        // Save position using serializable path (survives init)
        const currentPly = this.board.ply;
        const plyIsDone = this.board.plyIsDone;
        const path = currentPly ? currentPly.getSerializablePath() : null;

        // Get the sibling we're swapping with
        const siblingPly = ply.branches[index - 1];
        const siblingBranch = siblingPly.branch;

        // Determine if branches have default names
        const promotedIsDefault = this._isDefaultBranchName(
          this._getBranchLeaf(branch)
        );
        const siblingIsDefault = this._isDefaultBranchName(
          this._getBranchLeaf(siblingBranch)
        );

        // Calculate new branch names based on whether they're default or custom
        let newPromotedBranch = branch;
        let newSiblingBranch = siblingBranch;

        // After promotion:
        // - Promoted branch moves from position `index` to `index - 1` in branches array
        // - Sibling moves from position `index - 1` to `index` in branches array
        // Branch name suffix = array position (1-indexed, since branches[0] is main)
        // So promoted gets suffix `index - 1`, sibling gets suffix `index`
        if (promotedIsDefault && siblingIsDefault) {
          // Both default: swap names (they just exchange positions)
          newPromotedBranch = siblingBranch;
          newSiblingBranch = branch;
        } else if (promotedIsDefault && !siblingIsDefault) {
          // Promoted is default, sibling is custom: generate new default name
          // Promoted moves to position index-1, so suffix is index-1
          const parentPath = this._getBranchParent(branch);
          const newLeaf = this._generateDefaultBranchName(ply, index - 1);
          newPromotedBranch = parentPath ? `${parentPath}/${newLeaf}` : newLeaf;
        } else if (!promotedIsDefault && siblingIsDefault) {
          // Promoted is custom, sibling is default: generate new default name
          // Sibling moves to position index, so suffix is index
          const parentPath = this._getBranchParent(siblingBranch);
          const newLeaf = this._generateDefaultBranchName(siblingPly, index);
          newSiblingBranch = parentPath ? `${parentPath}/${newLeaf}` : newLeaf;
        }
        // If both are custom, both keep their names

        const oldID = ply.id;
        const newID = ply.branches[index - 1].id;
        let length = 0;
        let tempPly = ply;
        while (tempPly && tempPly.branch === branch) {
          length += 1;
          tempPly = this.plies[tempPly.id + 1];
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

        // Apply branch renames if needed (use temp name to avoid conflicts)
        if (
          newPromotedBranch !== branch ||
          newSiblingBranch !== siblingBranch
        ) {
          const tempBranch = `__temp_${Date.now()}__`;
          const currentTargetBranch = this.board.targetBranch;

          // First pass: rename promoted branch to temp
          if (newPromotedBranch !== branch) {
            plies.forEach((p) => {
              if (p.branch === branch) {
                p.branch = tempBranch;
                p.linenum.branch = tempBranch;
              } else if (p.branch.startsWith(branch + "/")) {
                p.branch = tempBranch + p.branch.substring(branch.length);
                p.linenum.branch = p.branch;
              }
            });
          }

          // Second pass: rename sibling branch to its new name
          if (newSiblingBranch !== siblingBranch) {
            plies.forEach((p) => {
              if (p.branch === siblingBranch) {
                p.branch = newSiblingBranch;
                p.linenum.branch = newSiblingBranch;
              } else if (p.branch.startsWith(siblingBranch + "/")) {
                p.branch =
                  newSiblingBranch + p.branch.substring(siblingBranch.length);
                p.linenum.branch = p.branch;
              }
            });
          }

          // Third pass: rename temp to final promoted name
          if (newPromotedBranch !== branch) {
            plies.forEach((p) => {
              if (p.branch === tempBranch) {
                p.branch = newPromotedBranch;
                p.linenum.branch = newPromotedBranch;
              } else if (p.branch.startsWith(tempBranch + "/")) {
                p.branch =
                  newPromotedBranch + p.branch.substring(tempBranch.length);
                p.linenum.branch = p.branch;
              }
            });
          }

          // Update targetBranch if it was affected by the rename
          if (currentTargetBranch === branch) {
            this.board.targetBranch = newPromotedBranch;
          } else if (currentTargetBranch.startsWith(branch + "/")) {
            this.board.targetBranch =
              newPromotedBranch + currentTargetBranch.substring(branch.length);
          } else if (currentTargetBranch === siblingBranch) {
            this.board.targetBranch = newSiblingBranch;
          } else if (currentTargetBranch.startsWith(siblingBranch + "/")) {
            this.board.targetBranch =
              newSiblingBranch +
              currentTargetBranch.substring(siblingBranch.length);
          }
        }

        // Sort ALL siblings arrays after ID changes
        plies.forEach((ply) => {
          if (ply.branches.length) {
            ply.branches.sort((a, b) => a.id - b.id);
          }
        });

        // Rebuild branches object and branches.parent references
        let branches = {};
        plies.forEach((ply) => {
          if (!(ply.branch in branches)) {
            branches[ply.branch] = ply;
          }
          if (ply.branches.length) {
            ply.branches.parent = branches[ply.branch];
          }
        });
        this.branches = branches;
        this.plies = plies;

        // Let init() rebuild the tree structure (children arrays)
        this._updatePTN();
        this.init({ ...this.params, ptn: this.ptn });

        // Restore position using the path
        if (path) {
          const targetPly = this.findPlyFromPath(path);
          if (targetPly) {
            this.board.goToPly(targetPly.id, plyIsDone);
          }
        }
      });
    }
  }

  _makeBranchMain(branch, recursively) {
    let ply = this.branches[branch];
    if (!ply) {
      throw new Error("Invalid branch");
    }

    // Ensure branches array is sorted before we start
    if (ply.branches.length) {
      ply.branches.sort((a, b) => a.id - b.id);
    }

    const getDescendents = (startPly, excludeBranch, includeSiblings) => {
      const branch = startPly.branch;
      const descendents = [];
      const isInExcludedSubtree = (ply) => {
        if (!excludeBranch) return false;
        return (
          ply.branch === excludeBranch ||
          ply.branch.startsWith(excludeBranch + "/")
        );
      };
      // Iterate through all plies to find ones in this branch (they may not be contiguous)
      for (let i = startPly.id; i < this.plies.length; i++) {
        const ply = this.plies[i];
        if (!ply) continue;
        // Check if this ply is in the target branch or a child of it
        if (ply.branch === branch || ply.branch.startsWith(branch + "/")) {
          if (!isInExcludedSubtree(ply)) {
            // Only include plies directly in this branch, or child branches if includeSiblings
            if (ply.branch === branch) {
              descendents.push(ply);
              // After the first ply, include siblings
              if (includeSiblings && ply.branches.length) {
                descendents.push(
                  ...flatten(
                    ply.branches
                      .slice(ply.branches.findIndex((p) => ply.id === p.id) + 1)
                      .map((p) => getDescendents(p, excludeBranch, true))
                  )
                );
              }
              includeSiblings = true;
            } else if (includeSiblings) {
              // Child branch - include it
              descendents.push(ply);
            }
          }
        }
      }
      return uniqBy(descendents, "id");
    };

    const promotedIndex = ply.branches.findIndex((p) => ply.id === p.id);
    const oldID = ply.id;
    const newID = ply.branches[0].id;
    const mainBranch = ply.branches[0].branch;

    // Collect intermediate siblings (between main and promoted) for renaming
    const intermediateSiblings = [];
    for (let si = 1; si < promotedIndex; si++) {
      intermediateSiblings.push({
        ply: ply.branches[si],
        oldBranch: ply.branches[si].branch,
        oldIndex: si,
        newIndex: si + 1,
      });
    }

    // Collect branches to be swapped and their descendents
    let newMain = getDescendents(ply);
    let oldMain = getDescendents(this.plies[newID], branch);

    // Rename new main branches
    const oldBranchRegExp = new RegExp(
      "^" + (branch ? escapeRegExp(branch) + "(\\/|$)" : "")
    );
    const newBranchFull = branch && mainBranch ? mainBranch + "$1" : mainBranch;
    newMain.forEach((ply) => {
      ply.branch = ply.branch.replace(oldBranchRegExp, newBranchFull);
      ply.linenum.branch = ply.branch;
      if (this.board.plyID === ply.id) {
        this.board.targetBranch = ply.branch;
      }
    });

    // Rename intermediate siblings to temp names FIRST to avoid conflicts
    // with old main rename (old main may get a name that matches an intermediate sibling)
    const parentPath = this._getBranchParent(branch);
    const currentTargetBranch = this.board.targetBranch;
    const tempRenames = [];
    for (const sib of intermediateSiblings) {
      const sibIsDefault = this._isDefaultBranchName(
        this._getBranchLeaf(sib.oldBranch)
      );
      if (!sibIsDefault) continue; // Custom names stay as-is

      const newLeaf = this._generateDefaultBranchName(sib.ply, sib.newIndex);
      const newBranch = parentPath ? `${parentPath}/${newLeaf}` : newLeaf;
      if (newBranch === sib.oldBranch) continue;

      const tempBranch = `__temp_sib_${sib.oldIndex}__`;
      tempRenames.push({
        oldBranch: sib.oldBranch,
        tempBranch,
        newBranch,
      });
    }

    // First pass: rename intermediate siblings to temp names
    for (const rename of tempRenames) {
      this.plies.forEach((p) => {
        if (p.branch === rename.oldBranch) {
          p.branch = rename.tempBranch;
          p.linenum.branch = rename.tempBranch;
        } else if (p.branch.startsWith(rename.oldBranch + "/")) {
          p.branch =
            rename.tempBranch + p.branch.substring(rename.oldBranch.length);
          p.linenum.branch = p.branch;
        }
      });
    }

    // Rename old main branches — old main goes to index 1
    const oldMainNewLeaf = this._generateDefaultBranchName(
      this.plies[newID],
      1
    );
    const oldMainNewBranch = parentPath
      ? `${parentPath}/${oldMainNewLeaf}`
      : oldMainNewLeaf;

    const newBranchRegExp = new RegExp(
      "^" + (branch ? escapeRegExp(mainBranch) + "(\\/|$)" : "")
    );
    const oldBranchFull =
      branch && mainBranch ? oldMainNewBranch + "$1" : oldMainNewBranch;
    oldMain.forEach((ply) => {
      if (branch && mainBranch) {
        ply.branch = ply.branch.replace(newBranchRegExp, oldBranchFull);
      } else {
        ply.branch =
          ply.branch === mainBranch
            ? oldMainNewBranch
            : oldMainNewBranch + "/" + ply.branch;
      }
      ply.linenum.branch = ply.branch;
      if (this.board.plyID === ply.id) {
        this.board.targetBranch = ply.branch;
      }
    });

    // Second pass: rename intermediate siblings from temp to final names
    for (const rename of tempRenames) {
      this.plies.forEach((p) => {
        if (p.branch === rename.tempBranch) {
          p.branch = rename.newBranch;
          p.linenum.branch = rename.newBranch;
        } else if (p.branch.startsWith(rename.tempBranch + "/")) {
          p.branch =
            rename.newBranch + p.branch.substring(rename.tempBranch.length);
          p.linenum.branch = p.branch;
        }
      });
    }
    // Update targetBranch if affected by intermediate sibling renames
    if (tempRenames.length) {
      for (const rename of tempRenames) {
        if (currentTargetBranch === rename.oldBranch) {
          this.board.targetBranch = rename.newBranch;
          break;
        } else if (currentTargetBranch.startsWith(rename.oldBranch + "/")) {
          this.board.targetBranch =
            rename.newBranch +
            currentTargetBranch.substring(rename.oldBranch.length);
          break;
        }
      }
    }

    // Move new main plies into position
    let plies = [...this.plies];
    let notes = {};

    // Swap moves' first plies if necessary
    if (newMain[0].move.ply1.isNop) {
      const nop = newMain[0].move.ply1;
      newMain[0].move.plies[0] = oldMain[0].move.ply1;
      oldMain[0].move.plies[0] = nop;
    }

    // Get only the plies directly in the branch being promoted (not child branches)
    // These are the plies that need to be moved to the main position
    // After renaming, plies that were in `branch` are now in `mainBranch`
    const branchPlies = newMain.filter((p) => p.branch === mainBranch);

    // Remove branch plies from their current positions (they may not be contiguous)
    const branchPlyIds = new Set(branchPlies.map((p) => p.id));
    plies = plies.filter((p) => !branchPlyIds.has(p.id));
    // Find the new insertion point - it's where the main branch ply now is
    // (its index shifted if we removed plies before it)
    const mainBranchPly = ply.branches[0];
    const insertIndex = plies.indexOf(mainBranchPly);
    // Insert them at the new position (sorted by their original index to maintain order)
    branchPlies.sort((a, b) => a.index - b.index);
    plies.splice(insertIndex, 0, ...branchPlies);
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

    // Sort ALL siblings arrays after ID changes
    plies.forEach((ply) => {
      if (ply.branches.length) {
        ply.branches.sort((a, b) => a.id - b.id);
      }
    });

    // Rebuild branches object and branches.parent references
    let branches = {};
    plies.forEach((ply) => {
      if (!(ply.branch in branches)) {
        branches[ply.branch] = ply;
      }
      if (ply.branches.length) {
        ply.branches.parent = branches[ply.branch];
      }
    });

    this.branches = branches;
    this.plies = plies;

    if (recursively && mainBranch) {
      this._updatePTN();
      this.init({ ...this.params, ptn: this.ptn });
      this._makeBranchMain(mainBranch, true);
    }

    return true;
  }

  makeBranchMain(branch, recursively = false) {
    this.recordChange(() => {
      // Save position using serializable path (survives init)
      const currentPly = this.board.ply;
      const plyIsDone = this.board.plyIsDone;
      const path = currentPly ? currentPly.getSerializablePath() : null;

      if (this._makeBranchMain(branch, recursively)) {
        this._updatePTN();
      }

      this.init({ ...this.params, ptn: this.ptn });

      // Restore position using the path
      if (path) {
        const targetPly = this.findPlyFromPath(path);
        if (targetPly) {
          this.board.goToPly(targetPly.id, plyIsDone);
        }
      }
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
      this.board.targetBranch = this.board.ply ? this.board.ply.branch : "";
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

  appendPly(ply) {
    const wasAtEnd = this.board.ply
      ? !this.board.ply.branch && !this.board.nextPly && this.board.plyIsDone
      : this.plies.length === 0;
    const restorePlyID = this.board.plyID;
    const restorePlyIsDone = this.board.plyIsDone;

    const restoreBoardPosition = () => {
      if (restorePlyID >= 0) {
        this.board.goToPly(restorePlyID, restorePlyIsDone);
      } else if (this.plies.length) {
        this.board.goToPly(this.plies[0].id, false);
      }
    };

    return this.recordChange(() => {
      if (!wasAtEnd) {
        this.board.goToEndOfMainBranch();
      }
      try {
        if (this._insertPly(ply)) {
          this._updatePTN();
          this.board.updatePTNOutput();
          this.board.updatePositionOutput();
          this.board.updateBoardOutput();
          if (isFunction(this.onAppendPly)) {
            if (ply.constructor === Ply) {
              ply = ply.text;
            } else {
              ply = new Ply(ply, {}).text;
            }
            this.onAppendPly(this, ply);
          }
          if (!wasAtEnd) {
            restoreBoardPosition();
          }
          return true;
        } else if (!wasAtEnd) {
          restoreBoardPosition();
        }
      } catch (error) {
        console.error(error);
        if (!wasAtEnd) {
          restoreBoardPosition();
        }
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
