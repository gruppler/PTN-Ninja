import Linenum from "../Linenum";
import Move from "../Move";
import Nop from "../Nop";
import Ply from "../Ply";

export default class GameMutations {
  insertPly(ply, isAlreadyDone = false) {
    if (ply.constructor !== Ply) {
      ply = Ply.parse(ply, { id: this.plies.length });
    }
    if (this.state.plyIsDone && this.state.nextPly) {
      this._setPly(this.state.nextPly.id, false);
    }

    let move = this.state.move;

    ply.color = this.state.color;
    ply.player = this.state.turn;

    if (!move.plies[ply.player - 1]) {
      // Next ply in the move
      move.setPly(ply, ply.player - 1);
    } else if (
      !move ||
      (ply.player === 1 && !this.state.nextPly && this.state.plyIsDone)
    ) {
      // Next move in the branch
      const number = this.state.number + 1;
      move = this.moves.find(
        ({ linenum }) =>
          linenum.branch === this.state.branch && linenum.number === number
      );
      if (move) {
        move.ply1 = ply;
      } else {
        // New move
        move = new Move({
          game: this,
          id: this.moves.length,
          linenum: new Linenum(this.state.branch + number + ". ", this),
          ply1: ply
        });
        this.moves.push(move);
      }
    } else {
      // New branch
      if (!this.state.plyIsDone && this.state.ply.branches.length) {
        ply.branch = this.newBranchID(
          this.state.ply.branches[0].branch,
          this.state.number
        );
      } else {
        ply.branch = this.newBranchID(this.state.branch, this.state.number);
      }
      move = new Move({
        game: this,
        id: this.moves.length,
        linenum: new Linenum(ply.branch + this.state.number + ". ", this)
      });
      if (ply.player === 2) {
        move.ply1 = Nop.parse("--");
      }
      move.setPly(ply, ply.player - 1);
      this.moves.push(move);
      this.branches[ply.branch] = ply;
      this.state.targetBranch = ply.branch;
    }

    if (
      move.number === this.firstMoveNumber &&
      this.firstPlayer === 2 &&
      !move.ply1
    ) {
      move.ply1 = Nop.parse("--");
    }

    this.plies.push(ply);

    this.recordChange(() => {
      if (!isAlreadyDone) {
        // do ply;
        this.goToPly(ply.id, true);
      } else {
        this._setPly(ply.id, true);
      }
      if (!this.checkGameEnd()) {
        // Update PTN if checking for game end didn't
        this._updatePTN();
      }
    });
  }

  newBranchID(branch, number) {
    const prefix = branch || "";
    let i = 1;
    do {
      branch = prefix + number + "-" + i++ + ".";
    } while (branch in this.branches);
    return branch;
  }
}
