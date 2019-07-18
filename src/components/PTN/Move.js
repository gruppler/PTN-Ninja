export default class Move {
  constructor(parts = {}) {
    this.game = parts.game;
    this.id = parts.id || 0;
    this.index = parts.index || 0;
    this.linenum = parts.linenum;
    this.ply1 = parts.ply1 || null;
    this.ply2 = parts.ply2 || null;
    if (this.ply1) {
      this.ply1.move = this;
    }
    if (this.ply2) {
      this.ply2.move = this;
    }
  }

  setPly(ply, player = 1) {
    const key = "ply" + player;
    this[key] = ply;
    ply.move = this;
    if (
      !ply.isNop &&
      this.linenum.branch &&
      this.linenum.isRoot &&
      (player === 1 || this.ply1.isNop)
    ) {
      const original = this.game.moves.find(
        move =>
          move.linenum.branch === this.linenum.parentBranch &&
          move.linenum.number === this.linenum.parentNumber
      );
      if (original && original[key]) {
        original[key].branches[0] = original[key];
        original[key].branches.push(ply);
        this[key].branches = original[key].branches;
      }
    }
  }

  text(comments) {
    let ply1 = "";
    let ply2 = "";
    let comments1 = "";
    let comments2 = "";

    if (this.ply1) {
      ply1 = this.ply1.text() + " ";
    }
    if (this.ply2) {
      ply2 = this.ply2.text() + " ";
    }

    if (comments) {
      if (comments[0] && comments[0].length) {
        comments1 = comments[0].map(comment => comment.text()).join(" ") + " ";
      }
      if (comments[1] && comments[1].length) {
        comments2 = comments[1].map(comment => comment.text()).join(" ");
      }
    }

    return this.linenum.text() + " " + ply1 + comments1 + ply2 + comments2;
  }
}
