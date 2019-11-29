export default class Move {
  constructor(parts = {}) {
    this.game = parts.game;
    this.id = parts.id;
    this.linenum = parts.linenum;
    if (this.linenum) {
      this.linenum.move = this;
    }
    this.index =
      parts.index !== undefined
        ? parts.index
        : this.linenum.number - this.game.firstMoveNumber;
    this.plies = [];
    if (parts.ply1) {
      this.ply1 = parts.ply1;
    }
    if (parts.ply2) {
      this.ply2 = parts.ply2;
    }
  }

  get number() {
    return this.linenum.number;
  }

  get branch() {
    return this.linenum.branch;
  }
  set branch(branch) {
    this.linenum.branch = branch;
    this.plies.forEach(ply => {
      if (ply && !ply.isNop) {
        ply.branch = branch;
      }
    });
  }

  get ply1() {
    return this.plies[0] || null;
  }
  set ply1(ply) {
    return this.setPly(ply, 0);
  }

  get ply2() {
    return this.plies[1] || null;
  }
  set ply2(ply) {
    return this.setPly(ply, 1);
  }

  get firstPly() {
    return this.plies.find(ply => ply && !ply.isNop) || null;
  }

  setPly(ply, index = 0) {
    const oldPly = this.plies[index] || null;
    this.plies[index] = ply;
    if (!ply) {
      if (index === 1 || this.plies.length === 1) {
        this.plies.length--;
      }
      if (this.plies.length === 1 && (!this.plies[0] || this.plies[0].isNop)) {
        this.plies.length--;
      }
      return;
    }
    ply.game = this.game;
    ply.move = this;
    ply.linenum = this.linenum;
    ply.branch = this.branch;
    ply.index = this.index * 2 + index - this.game.firstPlayer + 1;
    if (oldPly) {
      if (oldPly.branches.length) {
        ply.branches = oldPly.branches;
        ply.branches.splice(ply.branches.indexOf(oldPly), 1, ply);
        if (ply.branches[0] === ply) {
          this.game.branches[ply.branch] = ply;
        }
        delete this.game.boards[ply.id];
      }
    } else if (
      !ply.isNop &&
      this.linenum.branch &&
      this.linenum.isRoot &&
      (index === 0 || this.ply1.isNop)
    ) {
      // Looks like we're adding a new branch
      const original = this.game.moves.find(
        move =>
          move.branch === this.linenum.parentBranch &&
          move.number === this.linenum.parentNumber
      );
      if (original && original.plies[index]) {
        original.plies[index].addBranch(ply);

        // If first ply is placeholder, save reference to its original
        if (this.ply1.isNop) {
          this.ply1Original = original.ply1;
        }
      }
    }
    this.plies = this.plies.concat();
  }

  text(comments = null, showBranch = true) {
    let ply1 = "";
    let ply2 = "";
    let comments1 = "";
    let comments2 = "";

    if (!showBranch && this.ply1Original) {
      ply1 = this.ply1Original.text();
    } else if (this.ply1) {
      ply1 = this.ply1.text();
    }
    if (this.ply2) {
      ply2 = this.ply2.text();
    }

    if (comments) {
      if (comments[0] && comments[0].length) {
        comments1 = comments[0].map(comment => comment.text()).join(" ");
      }
      if (comments[1] && comments[1].length) {
        comments2 = comments[1].map(comment => comment.text()).join(" ");
      }
    }

    return [this.linenum.text(showBranch), ply1, comments1, ply2, comments2]
      .filter(item => item)
      .join(" ");
  }
}
