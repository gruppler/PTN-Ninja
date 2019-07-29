export default class Comment {
  constructor(notation) {
    const matchData = notation.match(/\{(\+[0-9]+:)?([12]:)?([^}]*)\}/);

    if (!matchData) {
      throw new Error("Invalid comment");
    }

    [this.ptn, this.time, this.player, this.message] = matchData;

    this.time = this.time ? 1 * this.time : null;
    this.player = 1 * this.player || null;
  }

  static parse(notation) {
    return new Comment(notation);
  }

  text() {
    return (
      "{" +
      (this.time === null ? "" : `+${this.time}:`) +
      (this.player ? this.player + ":" : "") +
      (this.time !== null || this.player ? " " : "") +
      this.message +
      "}"
    );
  }

  isValid() {
    this.errors = [];

    return !this.errors.length;
  }
}