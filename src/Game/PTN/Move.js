import { pick } from "lodash";

const outputProps = ["id", "index", "branch"];

export default class Move {
  constructor({ game, id, linenum, index, ply1, ply2 }) {
    this.game = game;
    this.id = id;
    this.linenum = linenum;
    if (this.linenum) {
      this.linenum.move = this;
    }
    this.index =
      index !== undefined
        ? index
        : this.linenum.number - this.game.firstMoveNumber;
    this.plies = [];
    if (ply1) {
      this.ply1 = ply1;
    }
    if (ply2) {
      this.ply2 = ply2;
    }
  }

  output(plies) {
    const output = pick(this, outputProps);
    output.linenum = this.linenum.output;
    output.plies = this.plies.map((ply) =>
      ply.isNop ? ply.output : plies[ply.id]
    );
    output.ply1Original = this.ply1Original
      ? plies[this.ply1Original.id]
      : null;
    output.ply1 = output.plies[0];
    output.ply2 = output.plies[1];
    output.firstPly = this.firstPly ? plies[this.firstPly.id] : null;
    return Object.freeze(output);
  }

  get number() {
    return this.linenum ? this.linenum.number : "";
  }

  get branch() {
    return this.linenum ? this.linenum.branch : "";
  }
  set branch(branch) {
    this.linenum.branch = branch;
    this.plies.forEach((ply) => {
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
    return this.plies.find((ply) => ply && !ply.isNop) || null;
  }

  setPly(ply, index = 0) {
    const oldPly = this.plies[index] || null;
    this.plies[index] = ply;
    this.game.board.dirtyMove(this.id);
    if ((ply && ply.id) || (oldPly && oldPly.id)) {
      this.game.board.dirtyPly(ply ? ply.id : oldPly.id);
    }
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

    // Set tree parent (for non-branch plies; branch plies get parent set in addBranch)
    if (!ply.parent) {
      if (index === 0) {
        // ply1's parent is the last ply of the previous move in the same branch
        const prevMove = this.game.moves.find(
          (m) => m.branch === this.branch && m.number === this.number - 1
        );
        ply.parent =
          prevMove && prevMove.ply2 && !prevMove.ply2.isNop
            ? prevMove.ply2
            : prevMove && prevMove.ply1 && !prevMove.ply1.isNop
            ? prevMove.ply1
            : null;
      } else {
        // ply2's parent is ply1 of the same move
        ply.parent = this.ply1 && !this.ply1.isNop ? this.ply1 : null;
      }
    }
    if (oldPly) {
      if (oldPly.branches.length) {
        ply.branches = oldPly.branches;
        ply.branches.splice(ply.branches.indexOf(oldPly), 1, ply);
        if (
          ply.branches[0] === ply &&
          (!(ply.branch in this.game.branches) ||
            ply.index < this.game.branches[ply.branch].index)
        ) {
          this.game.branches[ply.branch] = ply;
        }
      }
    } else if (
      !ply.isNop &&
      this.linenum &&
      this.linenum.branch &&
      this.linenum.isRoot &&
      (index === 0 || this.ply1.isNop)
    ) {
      // Looks like we're adding a new branch
      const original = this.game.moves.find(
        (move) =>
          move.branch === this.linenum.parentBranch &&
          move.number === this.linenum.parentNumber
      );
      if (original && original.plies[index]) {
        original.plies[index].addBranch(ply);
        this.game.board.dirtyPly(original.plies[index].id);

        // If first ply is placeholder, save reference to its original
        if (this.ply1.isNop) {
          this.ply1Original = original.ply1;
        }
      }
    }
    this.plies = this.plies.concat();
  }

  toString(comments = null, showBranch = true, transform = null) {
    let ply1 = "";
    let ply2 = "";
    let comments1 = "";
    let comments2 = "";

    if (!showBranch && this.ply1Original) {
      ply1 =
        transform && !this.ply1Original.isNop
          ? this.ply1Original.transform(this.game.size, transform)
          : this.ply1Original.toString();
    } else if (this.ply1) {
      ply1 =
        transform && !this.ply1.isNop
          ? this.ply1.transform(this.game.size, transform)
          : this.ply1.toString();
    }
    if (this.ply2) {
      ply2 =
        transform && !this.ply2.isNop
          ? this.ply2.transform(this.game.size, transform)
          : this.ply2.toString();
    }

    if (comments) {
      if (comments[0] && comments[0].length) {
        comments1 = comments[0]
          .map((comment) =>
            comment.toString({ size: this.game.size, transform })
          )
          .join(" ");
      }
      if (comments[1] && comments[1].length) {
        comments2 = comments[1]
          .map((comment) =>
            comment.toString({ size: this.game.size, transform })
          )
          .join(" ");
      }
    }

    return [this.linenum.toString(showBranch), ply1, comments1, ply2, comments2]
      .filter((item) => item)
      .join(" ");
  }
}
