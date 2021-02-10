import { pick } from "lodash";

const outputProps = [
  "text",
  "player1",
  "player2",
  "isTie",
  "winner",
  "type",
  "roads",
];

export default class Result {
  constructor(notation) {
    const matchData = notation.match(/(1\/2|[01RF])\s*-\s*(1\/2|[01RF])/);

    if (!matchData || !Result.validate(notation)) {
      throw new Error("Invalid result");
    }

    [this.ptn, this.player1, this.player2] = matchData;
    this.text = this.ptn.trim();
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

  get output() {
    return Object.freeze(pick(this, outputProps));
  }

  static test(notation) {
    return /^\s*([01RF]|1\/2)\s*-\s*([01RF]|1\/2)/.test(notation);
  }

  static validate(notation) {
    return /^R-0|0-R|F-0|0-F|1-0|0-1|1\/2-1\/2/.test(
      notation.replace(/\s/g, "")
    );
  }

  static parse(notation) {
    return new Result(notation);
  }
}
