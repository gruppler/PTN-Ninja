import { pick } from "lodash";

const outputProps = [
  "branch",
  "color",
  "id",
  "index",
  "player",
  "text",
  "tpsBefore",
];

export default class Continuation {
  constructor({
    id = 0,
    player = 1,
    color = null,
    branches = [],
    children = [],
    parent = null,
  } = {}) {
    this.ptn = "...";
    this.raw = this.ptn;
    this.isContinuation = true;
    this.id = id;
    this.linenum = null;
    this.player = player;
    this.color = color !== null ? color : player;
    this.branches = branches;
    this.children = children;
    this.parent = parent;
    this.branch = "";
    this.index = 0;
    this.squares = [];
  }

  static test(notation) {
    return /^\s*\.\.\./.test(notation);
  }

  static parse(notation, params = {}) {
    return new Continuation(params);
  }

  get output() {
    const output = pick(this, outputProps);
    output.isContinuation = true;
    output.squares = [];
    output.branches = this.branches.map((ply) => ply.id);
    output.depth = this.branch ? this.branch.split("/").length : 0;
    output.branchPoint =
      this.branches.parent &&
      this.branches.parent.branches &&
      this.branches.parent.branches[0]
        ? this.branches.parent.branches[0].id
        : null;
    output.linenum = this.linenum ? this.linenum.output : null;
    output.move = this.move ? this.move.id : null;
    return Object.freeze(output);
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
      this.branches.parent.children.push(this);
      this.branches.parent.children.sort(this.game.plySort);
    }
    this.branches.push(ply);
    ply.branches = this.branches;
    ply.parent = this.parent;
    if (ply.parent && !ply.parent.children.includes(ply)) {
      ply.parent.children.push(ply);
    }
  }

  removeBranch(ply) {
    delete this.game.branches[ply.branch];
    if (ply.parent && ply.parent.children.includes(ply)) {
      ply.parent.children.splice(ply.parent.children.indexOf(ply), 1);
    }
    if (this.branches.length === 2) {
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
      return false;
    } else if (this.branch === branch) {
      return true;
    } else if (this.branch.startsWith(branch)) {
      return false;
    } else if (branch.startsWith(this.branch)) {
      let ply = this.game.branches[branch].branches[0];
      while (ply && ply.index && ply.branch !== this.branch) {
        ply = this.game.branches[ply.branch].branches[0];
      }
      if (ply && ply.branch === this.branch) {
        return this.index < ply.index;
      }
    }
    return false;
  }

  get text() {
    return this.toString();
  }

  isEqual(ply) {
    // Continuation is never equal to any actual ply
    return false;
  }

  toMoveset() {
    return [];
  }

  toUndoMoveset() {
    return [];
  }

  get nextPly() {
    return this.children.length > 0 ? this.children[0] : null;
  }

  get prevPly() {
    return this.parent;
  }

  get siblings() {
    if (!this.branches.length) return [];
    return this.branches.filter((p) => p !== this);
  }

  toString() {
    return "...";
  }

  // Get a serializable path representation that survives init() and promotion
  getSerializablePath() {
    const path = [];
    let current = this;
    while (current) {
      if (current.branches && current.branches.length > 1) {
        path.unshift({
          moveNumber: current.move ? current.move.number : 0,
          player: current.player,
          moveText: current.toString ? current.toString() : "...",
        });
      }
      current = current.parent;
    }
    // Add final position
    path.push({
      moveNumber: this.move ? this.move.number : 0,
      player: this.player,
      moveText: "...",
    });
    return path;
  }
}
