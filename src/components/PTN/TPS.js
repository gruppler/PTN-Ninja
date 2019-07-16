export default class TPS {
  constructor(notation) {
    const matchData = notation.match(
      /(((x[1-8]?|[12]+[SC]?|,)+\/?)+)\s+([12])\s+(\d+)/
    );

    if (!matchData) {
      throw new Error("Invalid TPS");
    }

    [this.text, this.grid, , , this.player, this.linenum] = matchData;

    this.grid = this.grid
      .split("/")
      .reverse()
      .map(row => row.split(","));
    this.size = this.grid.length;
    this.player *= 1;
    this.linenum *= 1;
  }

  toMoveset() {
    if (!this.isValid()) return [{ errors: this.errors }];

    let moves = [];

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        if (this.grid[y][x][0] === "x") {
          if (/\d/.test(this.grid[y][x][1])) {
            x += 1 * this.grid[y][x][1] - 1;
          } else {
            continue;
          }
        } else {
          let stack = this.grid[y][x].split("");
          let piece, type;
          while ((piece = stack.shift())) {
            if (/[SC]/.test(stack[0])) {
              type = stack.shift();
            } else {
              type = "flat";
            }
            moves.push({
              action: "push",
              color: 1 * piece,
              x,
              y,
              type
            });
          }
        }
      }
    }

    return moves;
  }

  static parse(notation) {
    return new TPS(notation);
  }

  isValid() {
    this.errors = [];

    return !this.errors.length;
  }
}
