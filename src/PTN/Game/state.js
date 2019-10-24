import Marray from "marray";

import Piece from "../Piece";
import Square from "../Square";

import { defaults, last } from "lodash";
import memoize from "./memoize";

export default class GameState {
  constructor(game, state = null) {
    this.game = game;

    defaults(this, state, {
      targetBranch: "",
      plyID: -1,
      plyIsDone: false
    });

    Object.defineProperty(this, "plies", {
      get: memoize(this.getPlies, this.branchKey)
    });
    Object.defineProperty(this, "plyIDs", {
      get: memoize(this.getPlyIDs, this.branchKey)
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
      get: memoize(this.getBoard, () => JSON.stringify(this.boardPly)),
      set: this.setBoard
    });
    Object.defineProperty(this, "tps", {
      get: memoize(this.getTPS, () => JSON.stringify(this.boardPly))
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
    if (this.ply) {
      return (
        `${this.targetBranch}${this.game.plies.length}` +
        this.ply.isInBranch(this.targetBranch)
      );
    } else {
      return this.plyID;
    }
  }

  getPlies() {
    if (!this.game.plies.length) {
      return [];
    } else if (!this.ply) {
      return this.game.plies;
    } else if (
      (!this.ply.id && !this.plyIsDone) ||
      this.ply.isInBranch(this.targetBranch)
    ) {
      return this.game.plies.filter(
        ply => ply && ply.isInBranch(this.targetBranch)
      );
    } else {
      return this.game.plies.filter(ply => ply && ply.isInBranch(this.branch));
    }
  }

  getPlyIDs() {
    return this.plies.map(ply => ply.id);
  }

  getMoves() {
    let moves = [];
    if (this.plies) {
      this.plies.forEach(ply => {
        if (ply.player === 2 || !ply.move.ply2) {
          moves.push(ply.move);
        }
      });
    }
    return moves.length ? moves : this.game.moves;
  }

  getPly() {
    return this.plyID in this.game.plies
      ? this.game.plies[this.plyID]
      : this.game.plies[0] || null;
  }

  getMove() {
    return this.ply ? this.ply.move : this.moves[0];
  }

  getBranch() {
    return this.ply ? this.ply.branch : "";
  }

  getNumber() {
    return this.ply ? this.ply.move.number : this.game.firstMoveNumber;
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

  getTPS() {
    const grid = this.squares
      .map(row => {
        return row
          .map(square => {
            if (square.length) {
              return square.map(piece => piece.color + piece.typeCode).join("");
            } else {
              return "x";
            }
          })
          .join(",");
      })
      .reverse()
      .join("/")
      .replace(/x((,x)+)/g, spaces => "x" + (1 + spaces.length) / 2);

    const ply = this.game.plies[this.boardPly.id];
    const number = ply.move.number + 1 * (ply.player === 2);

    return `${grid} ${this.turn} ${number}`;
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
    let ply = this.ply;
    let isDone = this.plyIsDone;
    if (!this.plyIsDone && this.prevPly) {
      ply = this.prevPly;
      isDone = true;
    }
    if (!ply) {
      return null;
    }
    if (!isDone && ply.branches.length) {
      ply = ply.branches[0];
    }
    return { id: ply.id, isDone };
  }

  get min() {
    return {
      targetBranch: this.targetBranch,
      plyIndex: this.ply ? this.ply.index : 0,
      plyIsDone: this.plyIsDone
    };
  }

  get plyIndex() {
    return this.ply ? this.ply.index : -1;
  }

  set plyIndex(index) {
    if (this.plies.length > index) {
      this.plyID = this.plies[index].id;
    }
  }

  get isGameEnd() {
    return this.ply && this.plyIsDone && !!this.ply.result;
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
