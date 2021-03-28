import Aggregation from "aggregation/es6";
import Marray from "marray";

import BoardGameEnd from "./End";
import BoardIX from "./IX";
import BoardNavigation from "./Navigation";

import Piece from "./Piece";
import Square from "./Square";

import render from "./render";
import { atoi, itoa } from "../PTN/Ply";

import {
  defaults,
  flatten,
  isArray,
  isString,
  map,
  omit,
  pick,
  uniq,
  without,
  zipObject,
} from "lodash";
import memoize from "../memoize";

export default class Board extends Aggregation(
  BoardGameEnd,
  BoardIX,
  BoardNavigation
) {
  constructor(game, state = null) {
    super();
    this.game = game;
    this.size = game.size;

    defaults(this, state, {
      plyID: -1,
      plyIsDone: false,
      targetBranch: "",
    });

    this.output = {
      board: {
        ply: null,
        squares: {},
        pieces: {},
        flats: null,
      },
      comments: {
        notes: {},
        chatlog: {},
      },
      position: {
        isGameEnd: false,
        isFirstMove: true,
        move: null,
        nextPly: false,
        ply: null,
        plyID: -1,
        plyIndex: -1,
        plyIsDone: false,
        prevPly: false,
        targetBranch: "",
        turn: 1,
        color: 1,
      },
      ptn: {
        allMoves: [],
        allPlies: [],
        branchMenu: {},
        branchMoves: {},
        branchPlies: {},
        branches: {},
        tags: {},
      },
      selected: {
        squares: null,
        pieces: null,
      },
    };

    Object.defineProperty(this, "plies", {
      get: memoize(this._getPlies, this.branchKey),
    });
    Object.defineProperty(this, "plyIDs", {
      get: memoize(this._getPlyIDs, this.branchKey),
    });
    Object.defineProperty(this, "moves", {
      get: memoize(this._getMoves, this.branchKey),
    });
    Object.defineProperty(this, "move", {
      get: memoize(this._getMove, () => this.plyID),
    });
    Object.defineProperty(this, "branch", {
      get: memoize(this._getBranch, () => this.plyID),
    });
    Object.defineProperty(this, "number", {
      get: memoize(this._getNumber, () => this.plyID),
    });
    Object.defineProperty(this, "snapshot", {
      get: memoize(this._getSnapshot, () => JSON.stringify(this.boardPly)),
      set: this.setBoard,
    });
    Object.defineProperty(this, "tps", {
      get: memoize(this._getTPS, () => JSON.stringify(this.boardPly)),
    });

    this.roads = null;

    this.selected = {
      pieces: [],
      squares: [],
      moveset: [],
      initialCount: 0,
    };

    this.dirty = {
      board: {
        pieces: {},
        squares: {},
        squareConnections: {},
      },
      comments: {
        chat: {},
        notes: {},
      },
      ptn: {
        moves: {},
        plies: {},
      },
    };

    // Create pieces
    this.pieces = {
      all: {
        1: { flat: [], cap: [] },
        2: { flat: [], cap: [] },
        byID: {},
      },
      played: {
        1: { flat: [], cap: [] },
        2: { flat: [], cap: [] },
      },
    };
    [1, 2].forEach((color) => {
      ["flat", "cap"].forEach((type) => {
        for (
          let index = 0;
          index < this.game.pieceCounts[color][type];
          index++
        ) {
          const id = color + type[0] + (index + 1);
          const piece = new Piece({
            board: this,
            id,
            index,
            color,
            type,
          });
          this.pieces.all[color][type][index] = piece;
          this.pieces.all.byID[id] = piece;
          this.dirty.board.pieces[id] = true;
        }
      });
    });

    // Create squares
    this.squares = new Marray.two(
      this.size,
      this.size,
      (y, x) => new Square(x, y, this)
    );
    this.forEachSquare((square) => {
      if (!square.static.edges.N) {
        square.static.neighbors.N = this.squares[square.static.y + 1][
          square.static.x
        ];
      }
      if (!square.static.edges.S) {
        square.static.neighbors.S = this.squares[square.static.y - 1][
          square.static.x
        ];
      }
      if (!square.static.edges.E) {
        square.static.neighbors.E = this.squares[square.static.y][
          square.static.x + 1
        ];
      }
      if (!square.static.edges.W) {
        square.static.neighbors.W = this.squares[square.static.y][
          square.static.x - 1
        ];
      }
      Object.freeze(square.static);
      this.dirty.board.squares[square.static.coord] = true;
    });
  }

  render(options) {
    return render(this, options);
  }

  forEachSquare(f) {
    this.squares.forEach((row, y) =>
      row.forEach((square, x) => f(square, x, y))
    );
    return this;
  }

  mapSquares(f) {
    return this.squares.map((row) => row.map(f));
  }

  getSquare(square) {
    if (square instanceof Square) {
      return square;
    } else if (isString(square)) {
      const coord = atoi(square);
      return this.squares[coord[1]][coord[0]];
    } else if (square.static) {
      return this.squares[square.static.y][square.static.x];
    }
  }

  getPiece(piece) {
    if (piece instanceof Piece) {
      return piece;
    } else if (isString(piece)) {
      return this.pieces.all.byID[piece];
    } else if (piece.id) {
      return this.pieces.all.byID[piece.id];
    }
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

  dirtyMove(id) {
    this.dirty.ptn.moves[id] = true;
  }

  dirtyPly(id) {
    this.dirty.ptn.plies[id] = true;
  }

  dirtyPiece(id) {
    this.dirty.board.pieces[id] = true;
  }

  dirtySquare(coord, connections = false) {
    this.dirty.board.squares[coord] = true;
    if (connections) {
      this.dirty.board.squareConnections[coord] = true;
    }
  }

  dirtySquares(coords, connections = false) {
    coords.forEach((coord) => this.dirtySquare(coord, connections));
  }

  dirtyComment(type, id) {
    this.dirty.comments[type][id] = true;
  }

  dirtyChat(id) {
    this.dirty.comments.chat[id] = true;
  }

  dirtyNote(id) {
    this.dirty.comments.notes[id] = true;
  }

  updateSquareConnections() {
    map(this.dirty.board.squareConnections, (isDirty, coord) => {
      if (isDirty) {
        this.getSquare(coord).updateConnected();
        this.dirty.board.squareConnections[coord] = false;
      }
    });
  }

  updateOutput() {
    this.updateBoardOutput();
    this.updatePTNOutput();
    this.updateCommentsOutput();
    this.updatePositionOutput();
    this.updateSelectedOutput();
  }

  updateBoardOutput() {
    this.updateSquareConnections();
    this.updatePiecesOutput();
    this.updateSquaresOutput();

    return Object.assign(this.output.board, {
      ply: { ...this.boardPly },
      flats: this.flats.concat(),
    });
  }

  updatePiecesOutput() {
    return map(this.dirty.board.pieces, (isDirty, id) => {
      if (isDirty) {
        this.output.board.pieces[id] = this.getPiece(id).snapshot;
        this.dirty.board.pieces[id] = false;
      }
    });
  }

  updateSquaresOutput() {
    return map(this.dirty.board.squares, (isDirty, coord) => {
      if (isDirty) {
        const square = this.getSquare(coord);
        this.output.board.squares[coord] = square.snapshot;
        this.dirty.board.squares[coord] = false;
      }
    });
  }

  updatePTNOutput() {
    const output = { ...this.output.ptn };

    map(this.dirty.ptn.plies, (isDirty, plyID) => {
      if (isDirty) {
        this.dirty.ptn.plies[plyID] = false;
        let ply = this.game.plies[plyID];
        if (ply) {
          ply = ply.output;
          output.allPlies[plyID] = ply;
          this.dirty.ptn.moves[ply.move] = true;
        } else {
          delete this.dirty.ptn.plies[plyID];
          output.allPlies = omit(this.output.allPlies, plyID);
        }
      }
    });
    map(this.dirty.ptn.moves, (isDirty, moveID) => {
      if (isDirty) {
        this.dirty.ptn.moves[moveID] = false;
        let move = this.game.moves[moveID];
        if (move) {
          move = move.output(output.allPlies);
          output.allMoves[moveID] = move;
        } else {
          output.allMoves = omit(this.output.allMoves, moveID);
        }
      }
    });

    output.branches = zipObject(
      Object.keys(this.game.branches),
      Object.values(this.game.branches).map((ply) => output.allPlies[ply.id])
    );
    output.branchMoves = this.moves.map((move) => output.allMoves[move.id]);
    output.branchPlies = this.plies.map((ply) => output.allPlies[ply.id]);
    output.branchMenu = uniq(
      flatten(Object.values(output.branches).map((ply) => ply.branches))
    ).map((id) => output.allPlies[id]);

    output.tags = this.updateTagsOutput();

    return Object.assign(this.output.ptn, output);
  }

  updateTagsOutput() {
    return Object.assign(
      this.output.ptn.tags,
      zipObject(
        Object.keys(this.game.tags),
        Object.values(this.game.tags).map((tag) => tag.output)
      )
    );
  }

  updateCommentsOutput() {
    return map(this.dirty.comments, (log, type) => {
      map(log, (isDirty, plyID) => {
        if (isDirty) {
          this.dirty.comments[type][plyID] = false;
          let comments = this.game[type][plyID];
          if (comments && comments.length) {
            comments = comments.map((comment) => comment.output);
            this.output.comments[type][plyID] = comments;
          } else {
            delete this.dirty.comments[type][plyID];
            this.output.comments[type] = omit(
              this.output.comments[type],
              plyID
            );
          }
        }
      });
    });
  }

  updatePTNBranchOutput() {
    return Object.assign(this.output.ptn, {
      branchMoves: this.moves.map((move) => this.output.ptn.allMoves[move.id]),
      branchPlies: this.plies.map((ply) => this.output.ptn.allPlies[ply.id]),
    });
  }

  updatePositionOutput() {
    return Object.assign(
      this.output.position,
      pick(
        this,
        without(
          Object.keys(this.output.position),
          "ply",
          "move",
          "prevPly",
          "nextPly"
        )
      ),
      {
        ply: this.ply ? this.output.ptn.allPlies[this.plyID] : null,
        move: this.move ? this.output.ptn.allMoves[this.move.id] : null,
        prevPly: Boolean(this.prevPly),
        nextPly: Boolean(this.nextPly),
      }
    );
  }

  updateSelectedOutput() {
    return Object.assign(this.output.selected, {
      pieces: this.selected.pieces.map(
        (piece) => this.output.board.pieces[piece.id]
      ),
      squares: this.selected.squares.map(
        (square) => this.output.board.squares[square.static.coord]
      ),
    });
  }

  _getPlies() {
    if (!this.game.plies.length) {
      return [];
    } else if (!this.ply) {
      return this.game.plies;
    } else if (
      (!this.ply.id && !this.plyIsDone) ||
      this.ply.isInBranch(this.targetBranch)
    ) {
      return this.game.plies.filter(
        (ply) => ply && ply.isInBranch(this.targetBranch)
      );
    } else {
      return this.game.plies.filter(
        (ply) => ply && ply.isInBranch(this.branch)
      );
    }
  }

  _getPlyIDs() {
    return this.plies.map((ply) => ply.id);
  }

  _getMoves() {
    let moves = [];
    if (this.plies) {
      this.plies.forEach((ply) => {
        if (ply.player === 2 || !ply.move.ply2) {
          moves.push(ply.move);
        }
      });
    }
    return moves.length ? moves : this.game.moves;
  }

  get ply() {
    return this.game.plies[this.plyID] || this.game.plies[0] || null;
  }

  _getMove() {
    return this.ply ? this.ply.move : this.moves[0];
  }

  _getBranch() {
    return this.move ? this.move.branch : "";
  }

  _getNumber() {
    return this.move ? this.move.number : this.game.firstMoveNumber;
  }

  _selectPiece(piece) {
    if (isString(piece)) {
      piece = this.getPiece(piece);
    }
    this.selected.pieces.push(piece);
    piece.isSelected = true;
  }

  _selectPieces(pieces) {
    pieces.forEach((piece) => this._selectPiece(piece));
  }

  _reselectPiece(piece) {
    this.selected.pieces.unshift(piece);
    piece.isSelected = true;
  }

  _deselectPiece(flatten = false) {
    const piece = this.selected.pieces.shift();
    if (piece) {
      piece.isSelected = false;
      if (flatten) {
        piece.isStanding = false;
      }
    }
    return piece;
  }

  _deselectAllPieces(flatten = false) {
    while (this.selected.pieces.length) {
      this._deselectPiece(flatten);
    }
  }

  _selectSquare(square) {
    square = this.getSquare(square);
    this.selected.squares.push(square);
    square.isSelected = true;
    this.dirtySquare(square.static.coord);
  }

  _deselectSquare() {
    const square = this.selected.squares.shift();
    if (square) {
      square.isSelected = false;
      this.dirtySquare(square.static.coord);
    }
    return square;
  }

  _deselectAllSquares() {
    while (this.selected.squares.length) {
      this._deselectSquare();
    }
  }

  playPiece(color, type, square) {
    const isStanding = /S|wall/.test(type);
    if (!(type in this.game.pieceCounts[1])) {
      type = type === "C" ? "cap" : "flat";
    }
    const piece = this.pieces.all[color][type][
      this.pieces.played[color][type].length
    ];
    if (piece) {
      piece.isStanding = isStanding;
      this.pieces.played[color][type].push(piece);
      if ("z" in square) {
        // Set via piece state
        this.squares[square.y][square.x].setStackPiece(square.z, piece);
      } else {
        // Set via square
        square.pushPiece(piece);
      }
      return piece;
    }
    return null;
  }

  unplayPiece(square) {
    const piece = square.popPiece(true);
    if (piece) {
      piece.isStanding = false;
      const pieces = this.pieces.played[piece.color][piece.type];
      if (piece.index !== pieces.length - 1) {
        // Swap indices with the top of the stack
        const lastPiece = pieces.pop();
        pieces.splice(piece.index, 1, lastPiece);
        [piece.index, lastPiece.index] = [lastPiece.index, piece.index];
        this.pieces.all[piece.color][piece.type][piece.index] = piece;
        this.pieces.all[piece.color][piece.type][lastPiece.index] = lastPiece;
      } else {
        this.pieces.played[piece.color][piece.type].pop();
      }
      return piece;
    }
    return null;
  }

  clearBoard() {
    this.forEachSquare((square) => {
      square.clear();
    });
    this.pieces.played[1].flat.length = 0;
    this.pieces.played[1].cap.length = 0;
    this.pieces.played[2].flat.length = 0;
    this.pieces.played[2].cap.length = 0;
  }

  _getSnapshot() {
    return {
      1: {
        flat: this.pieces.played[1].flat.map((piece) => piece.state),
        cap: this.pieces.played[1].cap.map((piece) => piece.state),
      },
      2: {
        flat: this.pieces.played[2].flat.map((piece) => piece.state),
        cap: this.pieces.played[2].cap.map((piece) => piece.state),
      },
    };
  }

  _getTPS(player = this.turn, number = null) {
    const grid = this.squares
      .map((row) => {
        return row
          .map((square) => {
            if (square.pieces.length) {
              return square.pieces
                .map((piece) => piece.color + piece.typeCode)
                .join("");
            } else {
              return "x";
            }
          })
          .join(",");
      })
      .reverse()
      .join("/")
      .replace(/x((,x)+)/g, (spaces) => "x" + (1 + spaces.length) / 2);

    if (number === null) {
      const ply = this.boardPly ? this.game.plies[this.boardPly.id] : null;
      number = ply
        ? ply.move.number + 1 * (ply.player === 2 && this.plyIsDone)
        : this.game.firstMoveNumber;
    }

    return `${grid} ${player} ${number}`;
  }

  setBoard(pieces, plyID, plyIsDone) {
    this.clearBoard();
    [1, 2].forEach((color) =>
      ["flat", "cap"].forEach((type) => {
        pieces[color][type].forEach((state) => {
          this.playPiece(color, state.type, state, true);
        });
      })
    );
    this.plyID = plyID;
    this.plyIsDone = plyIsDone;
    const ply = this.ply;
    this.updateSquareConnections();
    this.setRoads(ply && ply.result ? ply.result.roads : null);
    this.updateBoardOutput();
    this.updatePositionOutput();
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

  get minState() {
    return {
      targetBranch: this.targetBranch,
      plyIndex: this.ply ? this.ply.index : 0,
      plyIsDone: this.plyIsDone,
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

  setRoads(roads) {
    if (this.roads) {
      this.roads.squares[1].concat(this.roads.squares[2]).forEach((coord) => {
        coord = atoi(coord);
        this.squares[coord[1]][coord[0]].setRoad(null);
      });
    }

    if (roads) {
      this.updateSquareConnections();
      roads[1].concat(roads[2]).forEach((road) => {
        road.squares.forEach((coord) => {
          coord = atoi(coord);
          this.squares[coord[1]][coord[0]].setRoad(road);
        });
      });
    }

    this.roads = roads || null;
  }

  get isFirstMove() {
    return (
      (!this.game.hasTPS ||
        !(
          this.pieces.played[1].flat.length && this.pieces.played[2].flat.length
        )) &&
      this.number === 1 &&
      (!this.ply || this.ply.index < 1 || !this.plyIsDone)
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
    } else {
      return this.game.config.player;
    }
  }

  get color() {
    if (this.isFirstMove && this.game.openingSwap) {
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
    this.forEachSquare((square) => {
      if (square.color && square.piece.isFlat) {
        flats[square.color - 1]++;
      }
    });
    const komi = this.game.tag("komi");
    if (komi) {
      flats[1 * (komi > 0)] += Math.abs(komi);
    }
    return flats;
  }
}
