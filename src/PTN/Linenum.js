export default class Linenum {
  constructor(notation) {
    const matchData = notation.match(/((?:\d+(?:[-:]\d+)?\.+)*)(\d+\.)\s+/);

    if (!matchData) {
      throw new Error("Invalid line number");
    }

    [this.ptn, this.branch, this.number] = matchData;
    this.number = parseInt(this.number, 10);
    if (this.branch) {
      const parentRegex = /(\d+)(-\d+)?\.(0?\.)*$/;
      this.parentBranch = this.branch.replace(parentRegex, "");
      this.parentNumber = parseInt(this.branch.match(parentRegex, "")[1], 10);
      this.isRoot = this.number === this.parentNumber;
    }
  }

  static parse(notation) {
    return new Linenum(notation);
  }

  text() {
    return (this.branch || "") + this.number + ".";
  }

  isValid() {
    this.errors = [];

    return !this.errors.length;
  }
}
