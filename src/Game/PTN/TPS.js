import { pick } from "lodash";

const outputProps = ["grid", "linenum", "player", "size", "text"];

export default class TPS {
  constructor(notation) {
    this.errors = [];

    const matchData = notation.match(/^([x1-8SC,\/-]+)\s+([12])\s+(\d+)$/);

    if (!matchData) {
      this.errors.push(new Error("Invalid TPS notation"));
      return;
    }

    [this.text, this.grid, this.player, this.linenum] = matchData;

    this.grid = this.grid
      .replace(/x(\d+)/g, function (x, count) {
        let spaces = ["x"];
        while (spaces.length < count) {
          spaces.push("x");
        }
        return spaces.join(",");
      })
      .split(/[\/-]/)
      .reverse()
      .map((row) => row.split(","));
    this.size = this.grid.length;
    this.player = Number(this.player);
    this.linenum = Number(this.linenum);

    const validCell = /^(x|[12]+[SC]?)$/;
    if (
      this.grid.find(
        (row) =>
          row.length !== this.size || row.find((cell) => !validCell.test(cell))
      )
    ) {
      this.errors.push(new Error("Invalid TPS notation"));
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
