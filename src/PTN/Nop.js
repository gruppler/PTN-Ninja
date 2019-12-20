export default class Nop {
  constructor(notation = "") {
    const matchData = notation.match(/([.-]+)/);

    if (matchData) {
      [this.ptn] = matchData;
    } else {
      this.ptn = "--";
    }
    this.raw = this.ptn;
    this.isNop = true;
  }

  static test(notation) {
    return /^\s*[.-]+/.test(notation);
  }

  static parse(notation) {
    return new Nop(notation);
  }

  text() {
    return this.raw || "--";
  }
}
