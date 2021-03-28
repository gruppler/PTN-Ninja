import { pick } from "lodash";

const outputProps = ["grid", "linenum", "player", "size", "text"];

export default class TPS {
  constructor(notation) {
    this.errors = [];

    const matchData = notation.match(
      /(((x[1-8]?|[12]+[SC]?|,)+\/?)+)\s+([12])\s+(\d+)/
    );

    if (!matchData) {
      this.errors.push(new Error("Invalid TPS notation"));
      return;
    }

    [this.text, this.grid, , , this.player, this.linenum] = matchData;

    this.grid = this.grid
      .replace(/x(\d)/g, function (x, count) {
        let spaces = ["x"];
        while (spaces.length < count) {
          spaces.push("x");
        }
        return spaces.join(",");
      })
      .split("/")
      .reverse()
      .map((row) => row.split(","));
    this.size = this.grid.length;
    this.player *= 1;
    this.linenum *= 1;

    if (this.grid.find((row) => row.length !== this.size)) {
      this.errors.push(new Error("Invalid TPS grid"));
    }
  }

  get output() {
    return Object.freeze(pick(this, outputProps));
  }

  static parse(notation) {
    return new TPS(notation);
  }

  get isValid() {
    return !this.errors.length;
  }
}
