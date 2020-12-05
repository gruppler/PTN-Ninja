const { itoa } = require("./Square");

const directionModifier = {
  "+": [0, 1],
  "-": [0, -1],
  ">": [1, 0],
  "<": [-1, 0]
};

exports.Ply = class {
  constructor(notation) {
    const matchData = notation.match(
      /(\d)?([CS])?([a-h])([1-8])(([<>+-])([1-8]+)?(\*)?)?/i
    );

    if (!matchData) {
      throw new Error("Invalid Ply");
    }

    [
      ,
      this.pieceCount,
      ,
      this.column,
      this.row,
      this.movement,
      this.direction,
      this.distribution
    ] = matchData;

    this.pieceType = this.specialPiece === "C" ? "cap" : "flat";

    this.y = parseInt(this.row, 10) - 1;
    this.x = "abcdefgh".indexOf(this.column);

    if (this.movement && !this.pieceCount) {
      this.pieceCount = String(this.distribution || 1);
    }

    if (this.movement && !this.distribution) {
      this.distribution = String(this.pieceCount || 1);
    }
    this.squares = [this.column + this.row];

    if (this.movement) {
      const [xOffset, yOffset] = directionModifier[this.direction];
      let x = this.x;
      let y = this.y;
      let i = this.distribution.length;
      while (i--) {
        x += xOffset;
        y += yOffset;
        this.squares.push(itoa(x, y));
      }
    }
  }
}
