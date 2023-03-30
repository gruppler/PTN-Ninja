import Ptn from "./ptn";

import { pick, isEqual } from "lodash";

const minProps = [
  "column",
  "direction",
  "distribution",
  "pieceCount",
  "row",
  "specialPiece",
];

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
    }
  ) {
    super(notation);

    if (this.pieceCount && !this.distribution) {
      throw new Error("Invalid PTN format");
    }

    // Silenty fix invalid stack distributions by trimming from the end
    while (!this.isValidStackDistribution() && this.distribution.length) {
      const d = this.distribution.substr(0, this.distribution.length - 1);
      this.ptn = this.ptn.replace(this.distribution, d);
      this.distribution = d;
    }

    this.specialPiece = this.specialPiece === "F" ? "" : this.specialPiece;
    if (this.isMovement()) {
      this.minDistribution =
        this.pieceCount === this.distribution ? "" : this.distribution;
      this.minPieceCount = this.pieceCount === "1" ? "" : this.pieceCount;
    }
    this.id = id;
    this.linenum = null;
    this.player = player;
    this.color = color;
    this.evaluation = evaluation;
    this.result = result;
    this.branches = branches;
    this.children = children;
    this.branch = "";
    this.squares = [this.column + this.row];
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
    rotate = rotate % 4;
    flip = flip % 2;

    let ptn = this.toString();
    let x = this.x;
    let y = this.y;
    let direction = this.direction;

    if (rotate === 1) {
      [x, y] = [y, size - 1 - x];
      if (direction) {
        direction = { "+": ">", "-": "<", ">": "-", "<": "+" }[direction];
      }
    } else if (rotate === 2) {
      x = size - 1 - x;
      y = size - 1 - y;
      if (direction) {
        direction = { "+": "-", "-": "+", ">": "<", "<": ">" }[direction];
      }
    } else if (rotate === 3) {
      [x, y] = [size - 1 - y, x];
      if (direction) {
        direction = { "+": "<", "-": ">", ">": "+", "<": "-" }[direction];
      }
    }

    if (flip) {
      x = size - 1 - x;
      if (direction) {
        direction = { ">": "<", "<": ">" }[direction] || direction;
      }
    }

    ptn = ptn.replace(itoa(this.x, this.y), itoa(x, y));
    if (direction) {
      ptn = ptn.replace(this.direction, direction);
    }

    return ptn;
  }

  get output() {
    const output = pick(this, outputProps);
    output.branches = this.branches.map((ply) => ply.id);
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
    return (
      this.branches.length &&
      this.branches.find((ply) => ply.isInBranch(branch))
    );
  }

  addBranch(ply) {
    if (!this.branches.length) {
      this.branches[0] = this;
      this.branches.parent = this.game.branches[this.branch];
      this.branches.parent.children.push(this);
      this.branches.parent.children.sort(this.game.plySort);
    }
    this.branches.push(ply);
    ply.branches = this.branches;
  }

  removeBranch(ply) {
    delete this.game.branches[ply.branch];
    if (this.branches.length === 2) {
      // Remove our last branch
      this.branches.parent.children.splice(
        this.branches.parent.children.indexOf(this),
        1
      );
      this.branches = [];
    } else {
      this.branches.splice(this.branches.indexOf(ply), 1);
    }
  }

  isInBranch(branch) {
    if (!(branch in this.game.branches)) {
      // Nonexistent branch
      return false;
    } else if (this.branch === branch) {
      // In same branch
      return true;
    } else if (this.branch.startsWith(branch)) {
      // In a descendant or sibling branch
      return false;
    } else if (branch.startsWith(this.branch)) {
      // In an ancestor branch
      let ply = this.game.branches[branch].branches[0];
      while (ply && ply.index && ply.branch !== this.branch) {
        // Ascend the tree to find a common branch
        ply = this.game.branches[ply.branch].branches[0];
      }
      if (ply && ply.branch === this.branch) {
        // Check whether branch descended from this
        return this.index < ply.index;
      }
    }
    return false;
  }

  isEqual(ply) {
    return isEqual(this.min, ply.min);
  }

  toString(plyOnly = false) {
    return (
      (this.minPieceCount || "") +
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
