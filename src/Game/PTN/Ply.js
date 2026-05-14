import Ptn from "./ptn";
import {
  transformBoardXY,
  transformDirection,
} from "../../utils/boardTransform";

import { pick, isEqual, isString } from "lodash";

const minProps = [
  "column",
  "direction",
  "distribution",
  "pieceCount",
  "row",
  "specialPiece",
];

// Standalone function to compare two plies (can be plain objects or Ply instances)
export function pliesEqual(ply1, ply2) {
  if (!ply1 || !ply2) return false;
  const getMin = (ply) =>
    ply instanceof Ply
      ? ply.min
      : isString(ply)
      ? new Ply(ply).min
      : pick(ply, minProps);
  return isEqual(getMin(ply1), getMin(ply2));
}

const outputProps = [
  "branch",
  "color",
  "column",
  "direction",
  "distribution",
  "id",
  "index",
  "minDistribution",
  "minPieceCount",
  "pieceCount",
  "player",
  "row",
  "specialPiece",
  "squares",
  "wallSmash",
  "text",
  "tpsBefore",
  "tpsAfter",
];

export const atoi = (coord) => [
  "abcdefgh".indexOf(coord[0]),
  parseInt(coord[1], 10) - 1,
];
export const itoa = (x, y) => "abcdefgh"[x] + (y + 1);

export default class Ply extends Ptn {
  constructor(
    notation,
    {
      id = 0,
      player = 1,
      color = 1,
      evaluation = null,
      result = null,
      branches = [],
      children = [],
      parent = null,
    } = {}
  ) {
    super(notation);

    if (this.isMovement() && this.pieceCount && !this.distribution) {
      throw new Error("Invalid PTN format");
    }

    // Silenty fix invalid stack distributions by trimming from the end
    while (
      this.isMovement() &&
      !this.isValidStackDistribution() &&
      this.distribution.length
    ) {
      const d = this.distribution.substring(0, this.distribution.length - 1);
      this.ptn = this.ptn.replace(this.distribution, d);
      this.distribution = d;
    }

    this.specialPiece = this.specialPiece === "F" ? "" : this.specialPiece;
    if (this.isMovement()) {
      this.minDistribution =
        this.pieceCount === this.distribution ? "" : this.distribution;
      this.minPieceCount = this.pieceCount === "1" ? "" : this.pieceCount;
    } else {
      // Placements normalize to no explicit pieceCount; the DBS first-move
      // "2" prefix is re-added dynamically by toString so pliesEqual still
      // treats "a1" and "2a1" as the same placement.
      this.pieceCount = undefined;
      this.minPieceCount = "";
    }
    this.id = id;
    this.linenum = null;
    this.player = player;
    this.color = color;
    this.evaluation = evaluation;
    this.result = result;
    this.branches = branches;
    this.children = children;
    this.parent = parent; // Reference to parent ply in tree structure
    this.branch = "";
    this.squares = [this.column + this.row];
    this.tpsBefore = "";
    this.tpsAfter = "";
    if (this.isMovement()) {
      const [xOffset, yOffset] = this.directionModifier();
      let x = this.x;
      let y = this.y;
      let i = this.distribution.length;
      while (i--) {
        x += xOffset;
        y += yOffset;
        this.squares.push(Ply.itoa(x, y));
      }
    }
  }

  static test(notation) {
    return /^\s*[1-8]?[CS]?[a-h][1-8]([<>+-][1-8]*)?\*?/i.test(notation);
  }

  static parse(notation, params = {}) {
    return new Ply(notation, params);
  }

  static atoi = atoi;

  static itoa = itoa;

  transform(size, [rotate, flip]) {
    let ptn = this.toString();
    const { x, y } = transformBoardXY(this.x, this.y, size, [rotate, flip]);
    const direction = transformDirection(this.direction, [rotate, flip]);

    ptn = ptn.replace(itoa(this.x, this.y), itoa(x, y));
    if (direction) {
      ptn = ptn.replace(this.direction, direction);
    }

    return ptn;
  }

  get output() {
    const output = pick(this, outputProps);
    output.branches = this.branches.map((ply) => ply.id);
    // Compute depth from branch name (e.g., "14b1/15b1" has depth 2)
    output.depth = this.branch ? this.branch.split("/").length : 0;
    output.branchPoint =
      this.branches.parent &&
      this.branches.parent.branches &&
      this.branches.parent.branches[0]
        ? this.branches.parent.branches[0].id
        : null;
    output.evaluation = this.evaluation ? this.evaluation.output : null;
    output.result = this.result ? this.result.output : null;
    output.linenum = this.linenum.output;
    output.move = this.move.id;
    return Object.freeze(output);
  }

  get min() {
    return pick(this, minProps);
  }

  getBranch(branch = "") {
    if (this.branches.length) {
      return this.branches.find((ply) => ply.isInBranch(branch)) || this;
    } else {
      return this;
    }
  }

  hasBranch(branch) {
    return Boolean(
      this.branches.length &&
        this.branches.find((ply) => ply.isInBranch(branch))
    );
  }

  addBranch(ply) {
    if (!this.branches.length) {
      this.branches[0] = this;
      this.branches.parent = this.game.branches[this.branch];
    }
    this.branches.push(ply);
    ply.branches = this.branches;
    // Set tree parent - branch ply's parent is the ply before the branch point
    ply.parent = this.parent;
    // Add to parent's children array (branch alternatives come after main continuation)
    if (ply.parent && !ply.parent.children.includes(ply)) {
      ply.parent.children.push(ply);
    }
  }

  removeBranch(ply) {
    delete this.game.branches[ply.branch];
    // Remove from parent's children array
    if (ply.parent && ply.parent.children.includes(ply)) {
      ply.parent.children.splice(ply.parent.children.indexOf(ply), 1);
    }
    if (this.branches.length === 2) {
      // Remove our last branch
      this.branches = [];
    } else {
      this.branches.splice(this.branches.indexOf(ply), 1);
    }
  }

  // Promote this ply to be the main continuation (first child of parent)
  promoteToMainChild() {
    if (!this.parent) return false;
    const children = this.parent.children;
    const index = children.indexOf(this);
    if (index <= 0) return false; // Already main or not found
    // Remove from current position and insert at front
    children.splice(index, 1);
    children.unshift(this);
    return true;
  }

  // Swap position with another sibling in parent's children array
  swapWithSibling(sibling) {
    if (!this.parent || this.parent !== sibling.parent) return false;
    const children = this.parent.children;
    const myIndex = children.indexOf(this);
    const siblingIndex = children.indexOf(sibling);
    if (myIndex < 0 || siblingIndex < 0) return false;
    // Swap positions
    children[myIndex] = sibling;
    children[siblingIndex] = this;
    return true;
  }

  isInBranch(branch) {
    if (!(branch in this.game.branches)) {
      // Nonexistent branch
      return false;
    }
    if (this.branch === branch) {
      // In same branch
      return true;
    }

    // Branch names are hierarchical with "/" as the segment separator.
    const isAncestor = (ancestor, descendant) =>
      ancestor === "" || descendant.startsWith(ancestor + "/");

    if (isAncestor(branch, this.branch)) {
      // this is in a descendant of branch — not in branch itself
      return false;
    }

    if (isAncestor(this.branch, branch)) {
      // branch is a descendant of this.branch — find the immediate child of
      // this.branch along the path to branch, then check if `this` precedes
      // that fork point.
      let childBranch = branch;
      while (childBranch) {
        const slashIdx = childBranch.lastIndexOf("/");
        const parent = slashIdx >= 0 ? childBranch.substring(0, slashIdx) : "";
        if (parent === this.branch) {
          const childPly = this.game.branches[childBranch];
          return childPly ? this.index < childPly.index : false;
        }
        if (parent === childBranch) break;
        childBranch = parent;
      }
    }
    return false;
  }

  isEqual(ply) {
    ply =
      ply instanceof Ply
        ? ply.min
        : isString(ply)
        ? new Ply(ply).min
        : pick(ply, minProps);
    return isEqual(this.min, ply);
  }

  get text() {
    return this.toString(true);
  }

  // Tree traversal helpers
  get nextPly() {
    // Next ply is the first child (main continuation)
    return this.children.length > 0 ? this.children[0] : null;
  }

  get prevPly() {
    // Previous ply is our parent
    return this.parent;
  }

  get siblings() {
    // Other plies that share the same parent (branch alternatives)
    if (!this.branches.length) return [];
    return this.branches.filter((p) => p !== this);
  }

  // Get the path from root to this ply as an array of plies
  getPath() {
    const path = [];
    let current = this;
    while (current) {
      path.unshift(current);
      current = current.parent;
    }
    return path;
  }

  // Get the depth of this ply in the tree (0 = root)
  get depth() {
    let depth = 0;
    let current = this.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  // Get a serializable path representation that survives init() and promotion
  // Returns array of {moveNumber, player, moveText} for each branch point
  // Uses moveText instead of branchIndex since indices change during promotion
  getSerializablePath() {
    const path = [];
    let current = this;
    while (current) {
      if (current.branches.length > 1) {
        // This is a branch point - record the move text to identify which branch
        path.unshift({
          moveNumber: current.move.number,
          player: current.player,
          moveText: current.toString(true), // Use move text as stable identifier
        });
      }
      current = current.parent;
    }
    // Add final position
    path.push({
      moveNumber: this.move.number,
      player: this.player,
      moveText: this.toString(true),
    });
    return path;
  }

  toString(plyOnly = false) {
    // Render the implicit "2" prefix on a DBS first-move placement so full
    // PTN output normalizes "a1" to "2a1". We only do this in non-plyOnly
    // mode (i.e. PTN export via Game/Move.toString); ply.text stays "a1"
    // so internal consumers (PlayTak replay comparison, TPS-Ninja GIF/PNG
    // renderers) keep round-tripping against legacy notation. Engines
    // never see the DBS first move either way — TEI substitutes
    // `position tps` for that ply.
    let pieceCount = this.minPieceCount || "";
    if (
      !plyOnly &&
      !pieceCount &&
      !this.isMovement() &&
      this.player === 1 &&
      this.linenum &&
      this.linenum.number === 1 &&
      this.game &&
      this.game.openingDoubleBlackStack
    ) {
      pieceCount = "2";
    }
    return (
      pieceCount +
      (this.specialPiece || "") +
      this.column +
      this.row +
      (this.direction || "") +
      (this.minDistribution || "") +
      (this.wallSmash || "") +
      (!plyOnly && this.evaluation ? this.evaluation.text : "") +
      (!plyOnly && this.result ? " " + this.result.text : "")
    );
  }
}
