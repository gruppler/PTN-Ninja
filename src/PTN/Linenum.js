import { compact, last } from "lodash";

export default class Linenum {
  constructor(notation, game) {
    const matchData = notation.match(/([^\s{}]+[./])*(\d+\.)\s*/);

    if (!matchData) {
      throw new Error("Invalid line number");
    }

    [this.ptn, this.branch, this.number] = matchData;
    this.number = parseInt(this.number, 10);
    if (this.branch) {
      const ancestors = compact(this.branch.split(/[./]/));
      this.ancestors = ancestors.map((ancestor, i) => {
        return ancestors.slice(0, i + 1).join("/");
      });
      this.branch = this.ancestors.pop();
      this.parentBranch = this.ancestors.length ? last(this.ancestors) : "";
      this.isRoot = !(this.branch in game.branches);
      this.parentNumber = this.isRoot
        ? this.number
        : game.branches[this.branch].move.number;
    } else {
      this.branch = "";
      this.ancestors = [];
    }
    this.move = null;
  }

  static parse(notation, game) {
    return new Linenum(notation, game);
  }

  static validateBranch(notation, allowMultiple) {
    return (allowMultiple ? /^[^\s{}]+$/ : /^[^\s{}./]+$/).test(notation);
  }

  text(showBranch = true) {
    return (
      (showBranch && this.branch ? this.branch + "/" : "") + this.number + "."
    );
  }

  isValid() {
    this.errors = [];

    return !this.errors.length;
  }
}
