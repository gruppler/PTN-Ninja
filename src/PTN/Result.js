export default class Result {
  constructor(notation) {
    const matchData = notation.match(/(([01RF]|1\/2)-([01RF]|1\/2))?/);

    if (!matchData) {
      throw new Error("Invalid result");
    }

    [this.ptn, , this.player1, this.player2] = matchData;
    this.text = this.ptn;
  }

  static parse(notation) {
    return new Result(notation);
  }
}
