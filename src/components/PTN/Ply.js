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
  }

  static parse(notation, params = {}) {
    return new Ply(notation, params);
  }

  text() {
    return (
      (this.minPieceCount || "") +
      (this.specialPiece || "") +
      this.column +
      this.row +
      (this.direction || "") +
      (this.minDistribution || "") +
      (this.evaluation ? this.evaluation.text : "") +
      (this.result ? " " + this.result.text : "")
    );
  }
}
