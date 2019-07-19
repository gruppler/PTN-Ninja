import Ptn from "ptn";

export default class Ply extends Ptn {
  constructor(
    notation,
    {
      id = 0,
      player = 1,
      color = 1,
      evaluation = null,
      result = null,
      branches = []
    }
  ) {
    super(notation);
    this.pieceType = this.specialPiece === "C" ? "C" : "F";
    this.specialPiece = this.specialPiece === "F" ? "" : this.specialPiece;
    if (this.isMovement()) {
      this.minDistribution =
        this.pieceCount === this.distribution ? "" : this.distribution;
      this.minPieceCount = this.pieceCount === "1" ? "" : this.pieceCount;
    }
    this.id = id;
    this.player = player;
    this.color = color;
    this.evaluation = evaluation;
    this.result = result;
    this.branches = branches;
    this.squares = [this.column + this.row];
    if (this.isMovement()) {
      const [xOffset, yOffset] = this.directionModifier();
      let x = this.x;
      let y = this.y;
      let i = this.distribution.length;
      while (i--) {
        x += xOffset;
        y += yOffset;
        this.squares.push(Ply.itoa(x, y));
      }
    }
  }

  static parse(notation, params = {}) {
    return new Ply(notation, params);
  }

  static atoi(row, col) {
    return {
      x: "abcdefgh".indexOf(col),
      y: parseInt(row, 10) - 1
    };
  }

  static itoa(x, y) {
    return "abcdefgh"[x] + (y + 1);
  }

  branch(targetBranch = "") {
    const branches = this.branches.map(ply => ply.move.linenum.branch);
    if (branches.length) {
      return branches.find(branch => targetBranch.startsWith(branch)) || this;
    } else {
      return this;
    }
  }

  text() {
    return (
      (this.minPieceCount || "") +
      (this.specialPiece || "") +
      this.column +
      this.row +
      (this.direction || "") +
      (this.minDistribution || "") +
      (this.wallSmash || "") +
      (this.evaluation ? this.evaluation.text : "") +
      (this.result ? " " + this.result.text : "")
    );
  }
}
