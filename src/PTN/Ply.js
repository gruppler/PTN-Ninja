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

  getBranch(branch = "") {
    if (this.branches.length) {
      return this.branches.find(ply => ply.isInBranch(branch)) || this;
    } else {
      return this;
    }
  }

  hasBranch(branch) {
    return (
      this.branches.length && this.branches.find(ply => ply.isInBranch(branch))
    );
  }

  isInBranch(branch) {
    if (!(branch in this.game.branches)) {
      // Nonexistent branch
      return false;
    } else if (this.branch === branch) {
      // In same branch
      return true;
    } else if (this.branch.startsWith(branch)) {
      // In a descendant or sibling branch
      return false;
    } else if (branch.startsWith(this.branch)) {
      // In an ancestor branch
      let ply = this.game.branches[branch].branches[0];
      while (ply.index && ply.branch !== this.branch) {
        // Ascend the tree to find a common branch
        ply = this.game.branches[ply.branch].branches[0];
      }
      if (ply && ply.branch === this.branch) {
        // Check whether branch descended from this
        return this.index < ply.index;
      }
    }
    return false;
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