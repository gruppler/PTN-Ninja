export default class Move {
  constructor(parts = {}) {
    this.game = parts.game;
    this.id = parts.id;
    this.linenum = parts.linenum;
    this.ply1 = null;
    this.ply2 = null;
    if (parts.ply1) {
      this.setPly(parts.ply1, 1);
    }
    if (parts.ply2) {
      this.setPly(parts.ply2, 2);
    }
    this.index =
      parts.index !== undefined
        ? parts.index
        : this.linenum.number - this.game.firstMoveNumber;
  }

  setPly(ply, player = 1) {
    const key = "ply" + player;
    this[key] = ply;
    ply.game = this.game;
    ply.move = this;
    ply.branch = this.linenum.branch;
    ply.index = this.index * 2 + player - this.game.firstPlayer;
    if (
      !ply.isNop &&
      this.linenum.branch &&
      this.linenum.isRoot &&
      (player === 1 || this.ply1.isNop)
    ) {
      // Looks like we're adding a new branch
      const original = this.game.moves.find(
        move =>
          move.linenum.branch === this.linenum.parentBranch &&
          move.linenum.number === this.linenum.parentNumber
      );
      if (original && original[key]) {
        // Add this ply to the original ply's branch list,
        // making sure the first one is the original itself
        original[key].branches[0] = original[key];
        original[key].branches.push(ply);
        this[key].branches = original[key].branches;

        if (this.ply1.isNop) {
          // If first ply is placeholder, save reference to its original
          this.ply1Original = original.ply1;
        }
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
