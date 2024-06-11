import Aggregation from "aggregation/es6";
import Marray from "marray";

import BoardGameEnd from "./end";
import BoardIX from "./ix";
import BoardNavigation from "./nav";

import Piece from "./Piece";
import Square from "./Square";

import { atoi } from "../PTN/Ply";

import {
  defaults,
  flatten,
  forEach,
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
        piecesPlayed: {},
        piecesRemaining: {},
        flats: null,
      },
      comments: {
        notes: {},
        chatlog: {},
        evaluations: {},
        pvs: {},
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
        sortedMoves: [],
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
      get: memoize(this.getTPS, () => JSON.stringify(this.boardPly)),
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
        chatlog: {},
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
        square.static.neighbors.N =
          this.squares[square.static.y + 1][square.static.x];
      }
      if (!square.static.edges.S) {
        square.static.neighbors.S =
          this.squares[square.static.y - 1][square.static.x];
      }
      if (!square.static.edges.E) {
        square.static.neighbors.E =
          this.squares[square.static.y][square.static.x + 1];
      }
      if (!square.static.edges.W) {
        square.static.neighbors.W =
          this.squares[square.static.y][square.static.x - 1];
      }
      Object.freeze(square.static);
      this.dirty.board.squares[square.static.coord] = true;
    });
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
    this.dirty.comments.chatlog[id] = true;
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
    const output = {};
    forEach(this.dirty.board.pieces, (isDirty, id) => {
      if (isDirty) {
        output[id] = this.getPiece(id).snapshot;
        this.dirty.board.pieces[id] = false;
      }
    });
    const played = {};
    const remaining = {};
    [1, 2].forEach((color) => {
      played[color] = {};
      remaining[color] = {};
      ["flat", "cap"].forEach((type) => {
        played[color][type] = this.pieces.played[color][type].length;
        remaining[color][type] =
          this.game.config.pieceCounts[color][type] - played[color][type];
      });
      played[color].total = played[color].flat + played[color].cap;
      remaining[color].total = remaining[color].flat + remaining[color].cap;
    });
    Object.freeze(played);
    Object.freeze(remaining);
    Object.assign(this.output.board.piecesPlayed, played);
    Object.assign(this.output.board.piecesRemaining, remaining);
    Object.assign(this.output.board.pieces, output);
  }

  updateSquaresOutput() {
    const output = {};
    forEach(this.dirty.board.squares, (isDirty, coord) => {
      if (isDirty) {
        const square = this.getSquare(coord);
        output[coord] = square.snapshot;
        this.dirty.board.squares[coord] = false;
      }
    });
    Object.assign(this.output.board.squares, output);
  }

  updatePTNOutput() {
    const output = { ...this.output.ptn };
    let allPlies = output.allPlies.concat();
    let allMoves = output.allMoves.concat();
    let sortedMoves;

    map(this.dirty.ptn.plies, (isDirty, plyID) => {
      if (isDirty) {
        this.dirty.ptn.plies[plyID] = false;
        let ply = this.game.plies[plyID];
        if (ply) {
          ply = ply.output;
          allPlies[plyID] = ply;
          this.dirty.ptn.moves[ply.move] = true;
        } else {
          delete this.dirty.ptn.plies[plyID];
          allPlies = without(allPlies, plyID);
        }
      }
    });
    map(this.dirty.ptn.moves, (isDirty, moveID) => {
      if (isDirty) {
        this.dirty.ptn.moves[moveID] = false;
        let move = this.game.moves[moveID];
        if (move) {
          move = move.output(allPlies);
          allMoves[moveID] = move;
        } else {
          allMoves = without(allMoves, moveID);
        }
      }
    });

    sortedMoves = this.game.movesSorted.map((move) => allMoves[move.id]);

    output.allPlies = allPlies;
    output.allMoves = allMoves;
    output.sortedMoves = sortedMoves;
    output.branches = zipObject(
      Object.keys(this.game.branches),
      Object.values(this.game.branches).map((ply) => output.allPlies[ply.id])
    );
    output.branchMoves = this.moves.map((move) => output.allMoves[move.id]);
    output.branchPlies = this.plies.map((ply) => output.allPlies[ply.id]);
    output.branchMenu = uniq(
      flatten(
        Object.values(output.branches)
          .sort(this.game.plySort)
          .map((ply) => ply.branches)
      )
    ).map((id) => output.allPlies[id]);

    output.tags = this.updateTagsOutput();

    return Object.assign(this.output.ptn, output);
  }

  updateTagsOutput() {
    let tags = this.game.tagOutput;
    tags.datetime = this.game.datetime;
    return (this.output.ptn.tags = tags);
  }

  updateCommentsOutput() {
    const output = { ...this.output.comments };
    const evaluations = { ...output.evaluations };
    const pvs = { ...output.pvs };
    output.evaluations = evaluations;
    output.pvs = pvs;

    forEach(this.dirty.comments, (log, type) => {
      let logOutput = { ...output[type] };
      forEach(log, (isDirty, plyID) => {
        if (isDirty) {
          this.dirty.comments[type][plyID] = false;
          delete pvs[plyID];
          delete evaluations[plyID];
          let comments = this.game[type][plyID];
          if (comments && comments.length) {
            comments = comments.map((comment) => comment.output);
            logOutput[plyID] = comments;
            if (type === "notes") {
              let comment;
              for (let i = 0; i < comments.length; i++) {
                comment = comments[i];
                if (comment) {
                  if (comment.evaluation !== null && !(plyID in evaluations)) {
                    evaluations[plyID] = comment.evaluation;
                  }
                  if (comment.pv !== null) {
                    if (pvs[plyID]) {
                      pvs[plyID] = pvs[plyID].concat(comment.pv);
                    } else {
                      pvs[plyID] = comment.pv;
                    }
                  }
                }
              }
            }
          } else {
            delete this.dirty.comments[type][plyID];
            logOutput = omit(logOutput, plyID);
          }
        }
      });
      output[type] = logOutput;
    });

    return Object.assign(this.output.comments, output);
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
        tps: this.getTPS(),
        ply: this.ply ? this.output.ptn.allPlies[this.plyID] : null,
        boardPly: this.boardPly,
        move: this.move ? this.output.ptn.allMoves[this.move.id] : null,
        prevPly: this.prevPly
          ? this.output.ptn.allPlies[this.prevPly.id]
          : null,
        nextPly: this.nextPly
          ? this.output.ptn.allPlies[this.nextPly.id]
          : null,
        isGameEnd: this.isGameEnd,
        isGameEndFlats: this.isGameEndFlats,
        isGameEndDefault: this.isGameEndDefault,
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
      moveset: this.selected.moveset.map((moveset) => moveset.count),
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
        if (ply.player === 2 || !ply.move.ply2 || ply.move.ply2.isNop) {
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
      if (!piece.square && flatten) {
        piece.isStanding = false;
      }
    }
    return piece;
  }

  _deselectPieces(pieces) {
    pieces.forEach(() => this._deselectPiece());
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
    const piece =
      this.pieces.all[color][type][this.pieces.played[color][type].length];
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

  getTPS(player = this.turn, number = null) {
    const grid = this.squares
      .map((row) =>
        row
          .map((square) =>
            square.pieces.length
              ? square.pieces
                  .map((piece) => piece.color + piece.typeCode)
                  .join("")
              : "x"
          )
          .join(",")
      )
      .reverse()
      .join("/")
      .replace(/x((,x)+)/g, (spaces) => "x" + (1 + spaces.length) / 2);

    if (number === null) {
      const boardPly = this.boardPly;
      const ply = boardPly ? this.game.plies[boardPly.id] : null;
      number = ply
        ? ply.move.number + 1 * (ply.player === 2 && boardPly.isDone)
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
    return { id: ply.id, isDone, ptn: ply.toString() };
  }

  get minState() {
    return {
      targetBranch: this.targetBranch,
      plyIndex: this.ply ? this.ply.index : 0,
      plyIsDone: this.plyIsDone,
      tps: this.tps,
      ply: this.ply ? this.ply.toString() : "",
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

  get isGameEndDefault() {
    return Boolean(
      this.ply &&
        this.plyIsDone &&
        this.ply.result &&
        this.ply.result.type === "1"
    );
  }

  get isGameEndFlats() {
    return (
      !(this.roads && this.roads.length) &&
      (Object.keys(this.pieces.played).some(
        (player) =>
          this.pieces.played[player].flat.length +
            this.pieces.played[player].cap.length ===
          this.game.pieceCounts[player].total
      ) ||
        !this.squares.some((row) =>
          row.some((square) => !square.pieces.length)
        ))
    );
  }

  get isGameEnd() {
    if (this.ply) {
      return this.plyIsDone && Boolean(this.ply.result);
    } else if (this.game.hasTPS) {
      return this.roads.length > 0 || this.isGameEndFlats;
    }
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
      return this.plyIsDone ? (this.ply.player === 1 ? 2 : 1) : this.ply.player;
    }
    return this.game.firstPlayer;
  }

  get player() {
    if (this.game.config.isOnline) {
      return this.game.config.player;
    } else {
      return this.turn;
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
    return this.getPrevPly();
  }

  getPrevPly(times = 1) {
    return this.ply && this.ply.index > 0
      ? this.plies[Math.max(0, this.ply.index - times)]
      : null;
  }

  get nextPly() {
    return this.getNextPly();
  }

  getNextPly(times = 1) {
    return this.ply && this.ply.index < this.plies.length - 1
      ? this.plies[Math.min(this.plies.length - 1, this.ply.index + times)]
      : null;
  }

  get flats() {
    let flats = [0, 0];
    this.forEachSquare((square) => {
      if (square.color && square.piece.isFlat) {
        flats[square.color - 1]++;
      }
    });
    const komi = this.game.config.komi;
    if (komi) {
      flats[1 * (komi > 0)] += Math.abs(komi);
    }
    return flats;
  }
}
