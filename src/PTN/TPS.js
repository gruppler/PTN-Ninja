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
      .replace(/x(\d)/g, function(x, count) {
        let spaces = ["x"];
        while (spaces.length < count) {
          spaces.push("x");
        }
        return spaces.join(",");
      })
      .split("/")
      .reverse()
      .map(row => row.split(","));
    this.size = this.grid.length;
    this.player *= 1;
    this.linenum *= 1;
  }

  static parse(notation) {
    return new TPS(notation);
  }

  isValid() {
    this.errors = [];

    return !this.errors.length;
  }
}
