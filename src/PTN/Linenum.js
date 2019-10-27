export default class Linenum {
  constructor(notation, game) {
    const matchData = notation.match(/((?:\d+(?:[-:]\d+)?\.+)*)(\d+\.)\s*/);

    if (!matchData) {
      throw new Error("Invalid line number");
    }

    [this.ptn, this.branch, this.number] = matchData;
    this.number = parseInt(this.number, 10);
    if (this.branch) {
      const parentRegex = /(\d+)(-\d+)?\.(0?\.)*$/;
      this.parentBranch = this.branch.replace(parentRegex, "");
      this.isRoot = !(this.branch in game.branches);
      this.parentNumber = this.isRoot
        ? this.number
        : game.branches[this.branch].move.number;
    }
    this.move = null;
  }

  static parse(notation, game) {
    return new Linenum(notation, game);
  }

  text(showBranch = true) {
    return ((showBranch && this.branch) || "") + this.number + ".";
  }

  isValid() {
    this.errors = [];

    return !this.errors.length;
  }
}
