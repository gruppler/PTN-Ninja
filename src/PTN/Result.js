export default class Result {
  constructor(notation) {
    const matchData = notation.match(/((1\/2|[01RF])-(1\/2|[01RF]))?/);

    if (!matchData) {
      throw new Error("Invalid result");
    }

    [this.ptn, , this.player1, this.player2] = matchData;
    this.text = this.ptn;
    if (this.player1 === "1/2") {
      this.player1 = "½";
      this.player2 = "½";
      this.isTie = true;
      this.winner = 0;
      this.type = "tie";
    } else {
      this.isTie = false;
      this.winner = this.player2 === "0" ? 1 : 2;
      this.type = this["player" + this.winner];
    }
    this.roads = null;
  }

  static parse(notation) {
    return new Result(notation);
  }
}
