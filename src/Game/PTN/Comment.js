export default class Comment {
  constructor(notation) {
    const matchData = notation.match(/\{(([+-][0-9]+:)?([12]:)?([^}]*))\}/);

    if (!matchData) {
      throw new Error("Invalid comment");
    }

    [this.ptn, this.contents, this.time, this.player, this.message] = matchData;

    this.time = this.time ? 1 * this.time : null;
    this.player = 1 * this.player || null;
  }

  static test(notation) {
    return /^\s*\{/.test(notation);
  }

  static parse(notation) {
    return new Comment(notation);
  }

  toString() {
    return (
      "{" +
      (this.time === null ? "" : `+${this.time}:`) +
      (this.player ? this.player + ":" : "") +
      (this.time !== null || this.player ? " " : "") +
      this.message +
      "}"
    );
  }
}
