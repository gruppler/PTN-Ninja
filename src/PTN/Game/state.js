import Marray from "marray";

import Piece from "../Piece";
import Square from "../Square";

import { defaults, last, memoize, pick } from "lodash";

export default class GameState {
  constructor(game, state = null) {
    this.game = game;

    defaults(this, state, {
      targetBranch: "",
      plyID: 0,
      plyIsDone: false
    });

    Object.defineProperty(this, "plies", {
      get: memoize(this.getPlies, this.branchKey)
    });
    Object.defineProperty(this, "moves", {
      get: memoize(this.getMoves, this.branchKey)
    });
    Object.defineProperty(this, "ply", {
      get: memoize(this.getPly, () => this.plyID)
    });
    Object.defineProperty(this, "move", {
      get: memoize(this.getMove, () => this.plyID)
    });
    Object.defineProperty(this, "branch", {
      get: memoize(this.getBranch, () => this.plyID)
    });
    Object.defineProperty(this, "number", {
      get: memoize(this.getNumber, () => this.plyID)
    });
    Object.defineProperty(this, "board", {
      get: memoize(this.getBoard, () => this.boardPly),
      set: this.setBoard
    });

    this.selected = {
      pieces: [],
      squares: [],
      moveset: [],
      initialCount: 0
    };

    this.pieces = {
      1: { flat: [], cap: [] },
      2: { flat: [], cap: [] }
    };

    this.squares = new Marray.two(
      this.game.size,
      this.game.size,
      (y, x) => new Square(x, y, this.game.size)
    );
    this.squares.forEach(row => {
      row.forEach(square => {
        if (!square.edges.N) {
          square.neighbors.N = this.squares[square.y + 1][square.x];
          square.neighbors.push(square.neighbors.N);
        }
        if (!square.edges.S) {
          square.neighbors.S = this.squares[square.y - 1][square.x];
          square.neighbors.push(square.neighbors.S);
        }
        if (!square.edges.E) {
          square.neighbors.E = this.squares[square.y][square.x + 1];
          square.neighbors.push(square.neighbors.E);
        }
        if (!square.edges.W) {
          square.neighbors.W = this.squares[square.y][square.x - 1];
          square.neighbors.push(square.neighbors.W);
        }
      });
    });
  }

  branchKey() {
    if (this.plyID in this.game.plies) {
      return `${this.targetBranch}${this.ply &&
        this.ply.isInBranch(this.targetBranch)}`;
    } else {
      return this.plyID;
    }
  }

  getPlies() {
    if (!this.ply) {
      return null;
    }
    if (this.ply.isInBranch(this.targetBranch)) {
      return this.game.plies.filter(ply => ply.isInBranch(this.targetBranch));
    } else {
      return this.game.plies.filter(ply => ply.isInBranch(this.branch));
    }
  }

  getMoves() {
    if (!this.plies) {
      return null;
    }
    let moves = [];
    this.plies.forEach(ply => {
      if (ply.player === 2 || !ply.move.ply2) {
        moves.push(ply.move);
      }
    });
    return moves;
  }

  getPly() {
    return this.plyID in this.game.plies ? this.game.plies[this.plyID] : null;
  }

  getMove() {
    return this.ply ? this.ply.move : null;
  }

  getBranch() {
    return this.ply ? this.ply.branch : "";
  }

  getNumber() {
    return this.move && this.move.linenum ? this.move.linenum.number : "";
  }

  getBoard() {
    return {
      1: {
        flat: this.pieces[1].flat.map(piece => piece.state),
        cap: this.pieces[1].cap.map(piece => piece.state)
      },
      2: {
        flat: this.pieces[2].flat.map(piece => piece.state),
        cap: this.pieces[2].cap.map(piece => piece.state)
      }
    };
  }

  setBoard(pieces, plyID, plyIsDone) {
    this.squares.forEach(row =>
      row.forEach(square => square.splice(0, square.length))
    );
    [1, 2].forEach(color =>
      ["flat", "cap"].forEach(type => {
        this.pieces[color][type] = pieces[color][type].map(state => {
          const piece = new Piece({ game: this.game, color, type, state });
          this.squares[piece.y][piece.x][piece.z] = piece;
          return piece;
        });
      })
    );
    this.plyID = plyID;
    this.plyIsDone = plyIsDone;
  }

  get boardPly() {
    let ply = !this.plyIsDone && this.prevPly ? this.prevPly : this.ply;
    if (!ply) {
      return null;
    }
    if (!this.plyIsDone && ply.branches.length) {
      ply = ply.branches[0];
    }
    return { id: ply.id, isDone: this.plyIsDone && ply === this.ply };
  }

  get min() {
    return pick(this, ["targetBranch", "plyID", "plyIsDone"]);
  }

  get isGameEnd() {
    return this.plyIsDone && !!this.ply.result;
  }

  get isFirstMove() {
    return (
      this.number === 1 && (!this.ply || this.ply.index < 1 || !this.plyIsDone)
    );
  }

  get turn() {
    if (this.ply) {
      if (this.isGameEnd) {
        return this.ply.player;
      } else {
        return this.plyIsDone
          ? this.ply.player === 1
            ? 2
            : 1
          : this.ply.player;
      }
    }
    return this.game.firstPlayer;
  }

  get player() {
    if (this.game.isLocal) {
      return this.turn;
    }
    return 1;
  }

  get color() {
    if (this.isFirstMove) {
      return this.turn === 1 ? 2 : 1;
    } else {
      return this.turn;
    }
  }

  get prevPly() {
    return this.ply && this.ply.index ? this.plies[this.ply.index - 1] : null;
  }

  get nextPly() {
    return this.ply && this.ply.index < this.plies.length - 1
      ? this.plies[this.ply.index + 1]
      : null;
  }

  get flats() {
    let flats = [0, 0];
    this.squares.forEach(row => {
      row.forEach(square => {
        if (square.length) {
          const piece = last(square);
          flats[piece.color - 1] += piece.isFlat;
        }
      });
    });
    return flats;
  }
}
