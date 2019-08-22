export default class Nop {
  constructor(notation = "") {
    const matchData = notation.match(/([.-]+)/);

    if (matchData) {
      [this.ptn] = matchData;
      this.raw = this.ptn || "...";
      this.isNop = true;
    }
  }

  static parse(notation) {
    return new Nop(notation);
  }

  text() {
    return this.raw || "...";
  }
}
