import { cloneDeep, pick, zip } from "lodash";

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

  transform([rotate, flip]) {
    rotate = rotate % 4;
    flip = flip % 2;
    let grid = cloneDeep(this.grid);

    if (rotate === 1) {
      grid = zip(...grid.map((row) => row.reverse()));
    } else if (rotate === 2) {
      grid = grid.map((row) => row.reverse()).reverse();
    } else if (rotate === 3) {
      grid = zip(...grid).map((row) => row.reverse());
    }

    if (flip) {
      grid = grid.map((row) => row.reverse());
    }

    return (
      grid
        .reverse()
        .map((row) => row.join(","))
        .join("/")
        .replace(/x((,x)+)/g, (spaces) => "x" + (1 + spaces.length) / 2) +
      ` ${this.player} ${this.linenum}`
    );
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
