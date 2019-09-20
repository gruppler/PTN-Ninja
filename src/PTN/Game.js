import Marray from "marray";
import Diff from "diff-match-patch";

import Tag from "./Tag";
import Comment from "./Comment";
import Linenum from "./Linenum";
import Ply from "./Ply";
import Evaluation from "./Evaluation";
import Result from "./Result";
import Nop from "./Nop";
import Move from "./Move";
import Piece from "./Piece";
import Square from "./Square";

import {
  cloneDeep,
  compact,
  defaults,
  isEmpty,
  last,
  map,
  omit,
  pick,
  times,
  trimStart
} from "lodash";

const pieceCounts = {
  3: { F: 10, C: 0, total: 10 },
  4: { F: 15, C: 0, total: 15 },
  5: { F: 21, C: 1, total: 22 },
  6: { F: 30, C: 1, total: 31 },
  7: { F: 40, C: 2, total: 42 },
  8: { F: 50, C: 2, total: 52 }
};

const diff = new Diff();
const maxHistoryLength = 20;
const MIN_GAME_STATE_PROPS = ["targetBranch", "plyID", "plyIsDone"];

export default class Game {
  constructor(
    notation,
    params = { name: "", state: null, history: [], historyIndex: 0 }
  ) {
    let item, key, ply;
    let branch = null;
    let moveNumber = 1;
    let move = new Move({ game: this, id: 0, index: 0 });

    this.name = params.name;
    this.state = {};
    this.history = params.history || [];
    this.historyIndex = params.historyIndex || 0;
    this.tags = {};
    this.moves = [move];
    this.branches = {};
    this.plies = [];
    this.chatlog = {};
    this.notes = {};

    notation = trimStart(notation);

    // Parse HEAD
    while (notation.length && notation[0] === "[") {
      // Tag
      item = Tag.parse(notation);
      key = item.key.toLowerCase();
      this.tags[key] = item;
      notation = trimStart(notation.substr(item.ptn.length));
      delete item.ptn;
    }

    if (this.tags.date) {
      if (this.tags.time) {
        this.datetime = new Date(
          this.tags.date.value + " " + this.tags.time.value
        );
      } else {
        this.datetime = new Date(this.tags.date.value);
      }
    } else if (this.tags.time) {
      this.datetime = new Date(this.tags.time.value);
    } else {
      this.datetime = new Date();
    }

    if (this.tags.size) {
      this.size = this.tags.size.value;
    } else {
      if (this.tags.tps) {
        this.size = this.tags.tps.value.size;
      } else {
        throw new Error("Missing board size");
      }
    }
    this._state = {
      plyID: 0,
      plyIsDone: false,
      player: 1,
      branch: "",
      targetBranch: "",
      flats: [0, 0],
      squares: new Marray.two(
        this.size,
        this.size,
        (y, x) => new Square(x, y, this.size)
      ),
      pieces: {
        1: { F: [], C: [] },
        2: { F: [], C: [] }
      },
      selectedPieces: []
    };
    this._state.squares.forEach(row => {
      row.forEach(square => {
        if (!square.edges.N) {
          square.neighbors.N = this._state.squares[square.y + 1][square.x];
          square.neighbors.push(square.neighbors.N);
        }
        if (!square.edges.S) {
          square.neighbors.S = this._state.squares[square.y - 1][square.x];
          square.neighbors.push(square.neighbors.S);
        }
        if (!square.edges.E) {
          square.neighbors.E = this._state.squares[square.y][square.x + 1];
          square.neighbors.push(square.neighbors.E);
        }
        if (!square.edges.W) {
          square.neighbors.W = this._state.squares[square.y][square.x - 1];
          square.neighbors.push(square.neighbors.W);
        }
      });
    });

    if (this.tags.tps) {
      this.firstMoveNumber = this.tags.tps.value.linenum;
      this.firstPlayer = this.tags.tps.value.player;
      moveNumber = this.tags.tps.value.linenum;
    } else {
      this.firstMoveNumber = 1;
      this.firstPlayer = 1;
    }

    this.pieceCounts = pieceCounts[this.size];

    // Parse BODY
    while (notation.length) {
      if (notation[0] === "{") {
        // Comment
        item = Comment.parse(notation);
        let plyID = this.plies.length - 1;
        let log = item.player === null ? "notes" : "chatlog";
        if (!this[log][plyID]) {
          this[log][plyID] = [];
        }
        this[log][plyID].push(item);
      } else if (/^[\d-:]+\./.test(notation)) {
        // Line number
        item = Linenum.parse(notation);
        if (!move.linenum) {
          move.linenum = item;
        } else {
          move = new Move({
            game: this,
            id: this.moves.length,
            linenum: item
          });
          this.moves.push(move);
        }
        branch = item.branch;
        moveNumber = item.number;
        ply = null;
      } else if (/^([01RF]|1\/2)-([01RF]|1\/2)/.test(notation)) {
        // Result
        item = Result.parse(notation);
        if (ply) {
          ply.result = item;
        }
      } else if (/^[.-]+/.test(notation)) {
        // Placeholder
        item = Nop.parse(notation);
        if (!move.ply1) {
          move.setPly(item, 1);
        } else if (!move.ply2 && !move.ply1.result) {
          move.setPly(item, 2);
        }
      } else if (/[1-8a-hCSF]/.test(notation[0])) {
        // Ply
        item = ply = Ply.parse(notation, { id: this.plies.length });
        if (
          move.linenum.number === this.firstMoveNumber &&
          this.firstPlayer === 2 &&
          !move.pl1
        ) {
          move.setPly(Nop.parse("--"), 1);
        }
        if (!move.ply1) {
          // Player 1 ply
          ply.player = 1;
          ply.color = moveNumber === 1 ? 2 : 1;
          move.setPly(ply, 1);
        } else if (!move.ply2) {
          // Player 2 ply
          ply.player = 2;
          ply.color = moveNumber === 1 ? 1 : 2;
          if (!move.ply1) {
            move.setPly(Nop.parse("--"), 1);
          }
          move.setPly(ply, 2);
        } else {
          // New move
          moveNumber += 1;
          move = new Move({
            game: this,
            id: this.moves.length,
            linenum: new Linenum(branch + moveNumber + ". "),
            ply1: ply
          });
          this.moves.push(move);
        }
        this.plies.push(ply);
        if (!(ply.branch in this.branches)) {
          this.branches[ply.branch] = ply;
        }
      } else if (/[?!'"]/.test(notation[0])) {
        // Evalutaion
        item = Evaluation.parse(notation);
        if (ply) {
          ply.evaluation = item;
        }
      } else {
        throw new Error("Invalid PTN format: " + notation);
      }

      notation = trimStart(notation.substr(item.ptn.length));
      delete item.ptn;
    }

    if (!this.moves[0].linenum) {
      this.moves[0].linenum = new Linenum(moveNumber + ". ");
    }

    this._updatePTN();

    if (!this.name) {
      this.name = this.generateName();
    }

    if (params.state) {
      this.state.targetBranch = params.state.targetBranch;
    }
    this.updateState();
    if (this.tags.tps) {
      this._doTPS(this.tags.tps.value);
    }
    if (params.state) {
      this.goToPly(params.state.plyID, params.state.plyIsDone);
    }
    window.game = this;
  }

  static parse(notation, { name = "", state = {} }) {
    return new Game(notation, { name, state });
  }

  get minState() {
    return pick(this.state, MIN_GAME_STATE_PROPS);
  }

  _applyPatch(patch, state) {
    const result = diff.patch_apply(patch, this.ptn);
    if (result && result.length) {
      this.state = state;
      Object.assign(
        this,
        omit(Game.parse(result[0], this), ["history", "historyIndex"])
      );
    }
  }

  get canUndo() {
    return this.historyIndex > 0;
  }

  get canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  undo() {
    if (!this.canUndo) {
      return false;
    }
    const history = this.history[this.historyIndex--];
    const state = this.minState;
    this._applyPatch(history.patchesUndo, history.state);
    history.state = state;
    return true;
  }

  redo() {
    if (!this.canRedo) {
      return false;
    }
    const history = this.history[++this.historyIndex];
    const state = this.minState;
    this._applyPatch(history.patchesRedo, history.state);
    history.state = state;
    return true;
  }

  recordChange(mutate) {
    const before = {
      state: this.minState,
      ptn: this.ptn
    };
    mutate();
    if (this.history.length > maxHistoryLength) {
      this.history.shift();
      this.historyIndex = this.history.length - 1;
    }
    this.history.length = this.historyIndex + 1;
    this.history.push({
      state: before.state,
      patchesRedo: diff.patch_make(before.ptn, this.ptn),
      patchesUndo: diff.patch_make(this.ptn, before.ptn)
    });
    this.historyIndex++;
  }

  clearHistory() {
    this.history.length = this.historyIndex = 0;
  }

  _updatePTN(recordChange) {
    if (recordChange && this.ptn) {
      this.recordChange(() => (this.ptn = this.text()));
    } else {
      this.ptn = this.text();
    }
  }

  _setPly(plyID, isDone = false) {
    this.state.plyID = plyID;
    this.state.plyIsDone = isDone;
    this.updateState();
  }

  setTarget(ply) {
    if (this.state.selectedPieces.length) {
      return false;
    }
    this.state.targetBranch = ply.branch;
    if (
      this.state.ply &&
      (ply.branches.includes(this.state.ply) ||
        !this.state.ply.isInBranch(ply.branch))
    ) {
      return this.goToPly(
        ply.id,
        ply.index < this.state.ply.index || this.state.plyIsDone
      );
    } else {
      this.updateState();
      return true;
    }
  }

  // After _setPly, update the rest of the state
  updateState() {
    this.state = defaults(this.state, this._state);

    if (this.state.plyID in this.plies) {
      let newPly = this.plies[this.state.plyID];
      let newMove = newPly.move;
      let newBranch = newPly.branch;
      let newNumber = newMove.linenum.number;
      const isDifferentBranch =
        this.state.branch !== newBranch ||
        this.state.targetBranch !== this.state._targetBranch;

      // Update lists of current branch's plies and moves
      if (isDifferentBranch || !this.state.plies) {
        if (newPly.isInBranch(this.state.targetBranch)) {
          this.state.plies = this.plies.filter(ply =>
            ply.isInBranch(this.state.targetBranch)
          );
        } else {
          this.state.plies = this.plies.filter(ply =>
            ply.isInBranch(this.state.branch)
          );
        }
        this.state.moves = [];
        this.state.plies.forEach(ply => {
          if (ply.player === 2 || !ply.move.ply2) {
            this.state.moves.push(ply.move);
          }
        });
      }

      // Update previous and next plies
      if (isDifferentBranch || this.state.ply !== newPly) {
        this.state.prevPly = newPly.index
          ? this.state.plies[newPly.index - 1]
          : null;
        this.state.nextPly =
          newPly.index < this.state.plies.length - 1
            ? this.state.plies[newPly.index + 1]
            : null;
      }

      this.state._targetBranch = this.state.targetBranch;
      this.state.ply = newPly;
      this.state.move = newMove;
      this.state.branch = newBranch;
      this.state.number = newNumber;

      let flats = [0, 0];
      this.state.squares.forEach(row => {
        row.forEach(square => {
          if (square.length) {
            let piece = last(square);
            flats[piece.color - 1] += !piece.isStanding && !piece.isCapstone;
          }
        });
      });
      this.state.flats = flats;

      this.state.player =
        this.state.plyIsDone && !this.state.ply.result
          ? this.state.ply.player === 1
            ? 2
            : 1
          : this.state.ply.player;
    }
  }

  _doPly() {
    const ply = this.state.plyIsDone ? this.state.nextPly : this.state.ply;
    if (ply && this._doMoveset(ply)) {
      this._setPly(ply.id, true);
      if (ply.result) {
        if (ply.result.type === "R" && !ply.result.roads) {
          ply.result.roads = this.findRoads();
        }
      } else if (ply.index === this.state.plies.length - 1) {
        this.checkGameEnd();
      }
      return true;
    } else {
      return false;
    }
  }

  _undoPly() {
    const ply = this.state.plyIsDone ? this.state.ply : this.state.prevPly;
    if (ply && this._doMoveset(ply, true)) {
      this._setPly(ply.id, false);
      return true;
    } else {
      return false;
    }
  }

  _doMoveset(ply, isUndo = false) {
    let stack = [];
    const moveset = isUndo ? ply.toUndoMoveset() : ply.toMoveset();

    if (moveset[0].errors) {
      console.error(moveset[0].errors);
      return false;
    }

    moveset.forEach(({ action, x, y, count = 1, flatten, type }) => {
      const square = this.state.squares[y][x];

      if (type) {
        if (isUndo) {
          square.pop();
          this.state.pieces[ply.color][ply.pieceType].pop();
        } else {
          let piece = new Piece({
            square,
            color: ply.color,
            isStanding: ply.specialPiece === "S",
            isCapstone: ply.specialPiece === "C"
          });
          square.push(piece);
          this.state.pieces[ply.color][ply.pieceType].push(piece);
        }
      } else if (action === "pop") {
        times(count, () => stack.push(square.pop()));

        if (flatten) {
          last(square).isStanding = true;
        }
      } else {
        if (square.length && last(square).isStanding) {
          if (stack[0].isCapstone) {
            if (!flatten) {
              flatten = ply.wallSmash = "*";
              this._updatePTN();
            }
          } else {
            console.error("Invalid ply");
            return false;
          }
        }
        if (flatten) {
          last(square).isStanding = false;
        }

        times(count, () => {
          let piece = stack.pop();
          if (!piece) {
            console.error("Invalid ply");
            return false;
          }
          Object.assign(piece, {
            square,
            x,
            y,
            z: square.length
          });
          square.push(piece);
        });
      }
    });

    return true;
  }

  _doTPS({ grid }) {
    let stack, square, piece, type;
    grid.forEach((row, y) => {
      row.forEach((col, x) => {
        if (col[0] !== "x") {
          stack = col.split("");
          square = this.state.squares[y][x];
          while ((piece = stack.shift())) {
            if (/[SC]/.test(stack[0])) {
              type = stack.shift();
            } else {
              type = "flat";
            }
            piece = new Piece({
              square,
              z: square.length,
              color: 1 * piece,
              isStanding: type === "S",
              isCapstone: type === "C"
            });
            square.push(piece);
            this.state.pieces[piece.color][piece.isCapstone ? "C" : "F"].push(
              piece
            );
          }
        }
      });
    });
  }

  goToPly(plyID, isDone) {
    const targetPly = this.plies[plyID];
    let switchBranch = this.state.targetBranch !== this.state._targetBranch;

    if (!targetPly || this.state.selectedPieces.length) {
      return false;
    }

    const log = label => {
      console.log(
        label,
        this.state.branch + this.state.number + ".",
        this.state.ply.text(),
        this.state.plyIsDone,
        Object.assign({}, this.state)
      );
    };

    const target = {
      ply: targetPly,
      plyIsDone: isDone,
      move: targetPly.move,
      branch: targetPly.branch,
      number: targetPly.move.linenum.number
    };

    log("started at");

    // Set targetBranch if target is outside of it
    if (!targetPly.isInBranch(this.state.targetBranch)) {
      switchBranch = true;
      this.state.targetBranch = target.branch;
      this.updateState();
    }

    // If current ply is outside target branch...
    let wentBack = false;
    while (
      !this.state.ply.isInBranch(target.branch) &&
      !this.state.ply.hasBranch(target.branch) &&
      this._undoPly()
    ) {
      // ...go back until we're on an ancestor or sibling of the target branch
      wentBack = true;
    }
    if (wentBack) {
      log("went back to");
    }

    if (
      switchBranch &&
      this.state.branch !== target.branch &&
      this.state.ply.hasBranch(target.branch)
    ) {
      if (this.state.plyIsDone) {
        this._undoPly();
      }
      this._setPly(this.state.ply.getBranch(target.branch).id, false);
      log("switched branch to");
    }

    if (this.state.ply.index < target.ply.index) {
      while (this.state.ply.index < target.ply.index && this._doPly()) {
        // Go forward until we reach the target ply
      }
      log("went forward to");
    } else if (this.state.ply.index > target.ply.index) {
      while (this.state.ply.index > target.ply.index && this._undoPly()) {
        // Go backward until we reach the target ply
      }
      log("went back again to");
    }

    // Do or undo the target ply
    if (target.plyIsDone !== this.state.plyIsDone) {
      if (target.plyIsDone) {
        this._doPly();
        log("did ply");
      } else {
        this._undoPly();
        log("undid ply");
      }
    }

    return true;
  }

  first() {
    return this.goToPly(this.state.plies[0].id, false);
  }

  last() {
    return this.goToPly(last(this.state.plies).id, true);
  }

  prev(half = false) {
    if (this.state.selectedPieces.length) {
      return false;
    }
    if (this.state.plyIsDone) {
      return this._undoPly();
    } else if (this.state.prevPly) {
      return this.goToPly(this.state.prevPly.id, half);
    }
    return false;
  }

  next(half = false) {
    if (this.state.selectedPieces.length) {
      return false;
    }
    if (!this.state.plyIsDone) {
      return this._doPly();
    } else if (this.state.nextPly) {
      return this.goToPly(this.state.nextPly.id, !half);
    }
    return false;
  }

  toggleEvaluation(type) {
    const ply = this.state.ply;
    const types = { tak: "'", tinue: '"', "?": "?", "!": "!" };
    if (!ply) {
      return false;
    }
    if (!ply.evaluation) {
      if (!(type in types)) {
        return false;
      }
      ply.evaluation = Evaluation.parse(types[type]);
    } else {
      switch (type) {
        case "tak":
          if (ply.evaluation.tak) {
            ply.evaluation = Evaluation.parse(
              ply.evaluation.text.replace(/[']/g, "")
            );
          } else {
            ply.evaluation = Evaluation.parse(
              ply.evaluation.text.replace(/['"]/g, "") + "'"
            );
          }
          break;
        case "tinue":
          if (ply.evaluation.tinue) {
            ply.evaluation = Evaluation.parse(
              ply.evaluation.text.replace(/['"]/g, "")
            );
          } else {
            ply.evaluation = Evaluation.parse(
              ply.evaluation.text.replace(/[']/g, "") + '"'
            );
          }
          break;
        case "?":
        case "!":
          if (ply.evaluation[type]) {
            ply.evaluation = Evaluation.parse(
              ply.evaluation.text.replace(new RegExp(`[${type}]`, "g"), "")
            );
          } else {
            ply.evaluation = Evaluation.parse(ply.evaluation.text + type);
          }
          break;
        default:
          return false;
      }
    }
    this._updatePTN(true);
  }

  checkGameEnd() {
    let player = this.state.ply.player;
    let pieces = this.state.pieces[player == 1 ? 2 : 1];
    let roads = this.findRoads();
    let result;

    if (!this.state.ply) {
      return false;
    }

    if (roads && roads.length) {
      // Check current player first
      if (roads[player].length) {
        result = player == 1 ? "R-0" : "0-R";
      } else if (roads[player == 1 ? 2 : 1].length) {
        // Completed opponent's road
        result = player == 1 ? "0-R" : "R-0";
      }
    } else if (
      pieces.F.length + pieces.C.length === 0 ||
      !this.state.squares.find(row => row.find(square => !square.length))
    ) {
      // Last empty square or last piece
      if (this.state.flats[0] == this.state.flats[1]) {
        // Draw
        result = "1/2-1/2";
      } else if (this.state.flats[0] > this.state.flats[1]) {
        result = "F-0";
      } else {
        result = "0-F";
      }
    } else if (
      pieces.F.length + pieces.C.length === 0 ||
      !this.state.squares.find(row => row.find(square => !square.length))
    ) {
      // Last empty square or last piece
      if (this.state.flats[0] == this.state.flats[1]) {
        // Draw
        result = "1/2-1/2";
      } else if (this.state.flats[0] > this.state.flats[1]) {
        result = "F-0";
      } else {
        result = "0-F";
      }
    } else if (this.state.ply.result && this.state.ply.result.type != "1") {
      this.state.ply.result = null;
      this._updatePTN();
      return false;
    } else {
      return false;
    }

    result = Result.parse(result);
    if (roads && roads.length) {
      result.roads = roads;
    }
    this.state.ply.result = result;
    this._updatePTN();

    return true;
  }

  findRoads(player) {
    let possibleRoads = { 1: {}, 2: {} };
    let connections = {};
    let players = player ? [player] : [1, 2];

    // Recursively follow a square and return all connected squares and edges
    function _followRoad(square) {
      let squares = {};
      let edges = {};
      let road;
      let player = last(square).color;

      squares[square.coord] = square;
      delete possibleRoads[player][square.coord];

      if (square.isEdge) {
        // Note which edge(s) the road touches
        edges[square.edges[0]] = true;
        if (square.edges[1]) {
          edges[square.edges[1]] = true;
        }
      }

      connections[square.coord].forEach(neighbor => {
        if (neighbor.coord in possibleRoads[player]) {
          // Haven't gone this way yet; find out where it goes
          road = _followRoad(neighbor);
          // Report back squares and edges
          Object.assign(squares, road.squares);
          Object.assign(edges, road.edges);
        }
      });

      return {
        squares: squares,
        edges: edges
      };
    }

    // Remove all deadEnds and their non-junction neighbors from squares
    function _removeDeadEnds(deadEnds, squares, winningEdge) {
      deadEnds = deadEnds.concat();
      while (deadEnds.length) {
        deadEnds.forEach((square, i) => {
          let isWinningEdge =
            (square.isEdge && !winningEdge) || square["is" + winningEdge];
          let nextNeighbors = [];
          connections[square.coord].forEach(neighbor => {
            if (neighbor.coord in squares) {
              nextNeighbors.push(neighbor);
            }
          });

          if (
            nextNeighbors.length < 2 &&
            (!isWinningEdge ||
              (nextNeighbors[0] && nextNeighbors[0]["is" + winningEdge]))
          ) {
            delete squares[square.coord];
            deadEnds[i] = nextNeighbors[0];
          } else {
            deadEnds[i] = undefined;
          }
        });
        deadEnds = compact(deadEnds);
      }
    }

    // Gather player-controlled squares and dead ends
    let possibleDeadEnds = { 1: [], 2: [] },
      deadEnds = [];

    this.state.squares.forEach(row =>
      row.forEach(square => {
        let piece = last(square);
        if (piece && !piece.isStanding) {
          let player = piece.color;
          connections[square.coord] = square.neighbors.filter(neighbor => {
            neighbor = last(neighbor);
            return (
              neighbor && !neighbor.isStanding && neighbor.color === player
            );
          });

          if (connections[square.coord].length === 1) {
            if (square.isEdge) {
              // An edge with exactly one friendly neighbor
              possibleRoads[player][square.coord] = square;
              possibleDeadEnds[player].push(square);
            } else {
              // A non-edge dead end
              deadEnds.push(square);
            }
          } else if (connections[square.coord].length > 1) {
            // An intersection
            possibleRoads[player][square.coord] = square;
          }
        } else {
          connections[square.coord] = [];
        }
      })
    );

    // Remove dead ends not connected to edges
    players.forEach(player => _removeDeadEnds(deadEnds, possibleRoads[player]));

    // Find roads that actually bridge opposite edges
    let roads = {
        1: [],
        2: [],
        squares: {
          1: [],
          2: []
        },
        edges: {
          1: { NS: false, EW: false },
          2: { NS: false, EW: false }
        },
        length: 0
      },
      road;

    function _addRoad(road, player) {
      roads[player].push({
        edges: road.edges,
        squares: Object.keys(road.squares)
      });
      Object.assign(roads.squares[player], road.squares);
      if (road.edges.NS) roads.edges[player].NS = true;
      if (road.edges.EW) roads.edges[player].EW = true;
    }

    players.forEach(player => {
      while (!isEmpty(possibleRoads[player])) {
        // Follow any square to get all connected squares
        road = _followRoad(
          possibleRoads[player][Object.keys(possibleRoads[player])[0]]
        );

        // Find connected opposite edge pair(s)
        road.edges.NS = (road.edges.S && road.edges.N) || false;
        road.edges.EW = (road.edges.W && road.edges.E) || false;

        if (road.edges.NS || road.edges.EW) {
          if (!road.edges.NS || !road.edges.EW) {
            // Remove dead ends connected to the non-winning edges
            _removeDeadEnds(
              possibleDeadEnds[player],
              road.squares,
              road.edges.NS ? "NS" : "EW"
            );
            _addRoad(road, player);
          } else {
            // Double road; split into two separate roads
            let road2 = cloneDeep(road);
            road.edges.EW = false;
            road2.edges.NS = false;
            _removeDeadEnds(possibleDeadEnds[player], road.squares, "NS");
            _removeDeadEnds(possibleDeadEnds[player], road2.squares, "EW");
            _addRoad(road, player);
            _addRoad(road2, player);
          }
        }
      }
      roads.squares[player] = Object.keys(roads.squares[player]) || [];
      roads.length += roads[player].length;
    });

    return roads;
  }

  text() {
    let prevMove = null;
    return (
      map(this.tags, tag => tag.text()).join("\n") +
      "\n\n" +
      (this.notes[-1]
        ? this.notes[-1].map(comment => comment.text()).join("\n") + "\n\n"
        : "") +
      (this.chatlog[-1]
        ? this.chatlog[-1].map(comment => comment.text()).join("\n") + "\n\n"
        : "") +
      map(this.moves, move => {
        let text = move.text(this.getMoveComments(move));
        if (prevMove && prevMove.linenum.branch != move.linenum.branch) {
          text = "\n" + text;
        }
        prevMove = move;
        return text;
      }).join("\n")
    );
  }

  static t = {
    Black: "Black",
    White: "White"
  };

  generateName() {
    const player1 = this.tag("player1", Game.t["White"]);
    const player2 = this.tag("player2", Game.t["Black"]);
    const result = this.tag("result").replace(/\//g, "-");
    const date = this.tag("date");
    const time = this.tag("time").replace(/\D/g, ".");
    return (
      player1 +
      " vs " +
      player2 +
      (result ? " " + result : "") +
      (date ? " " + date : "") +
      (time ? "-" + time : "")
    );
  }

  tag(key, defaultValue) {
    return key in this.tags && this.tags[key].value
      ? this.tags[key].valueText
      : defaultValue !== undefined
      ? defaultValue
      : "";
  }

  setTag(key, value) {
    this.tags = Object.assign(this.tags, {
      [key]: Tag.parse(`[${key} "${value}"]`)
    });
    this._updatePTN(true);
  }

  getMoveComments(move) {
    let comments = [];
    if (move.ply1 && "id" in move.ply1) {
      comments[0] = (this.notes[move.ply1.id] || []).concat(
        this.chatlog[move.ply1.id] || []
      );
    }
    if (move.ply2 && "id" in move.ply2) {
      comments[1] = (this.notes[move.ply2.id] || []).concat(
        this.chatlog[move.ply2.id] || []
      );
    }
    return comments;
  }

  addComment(log, message) {
    message = Comment.parse("{" + message + "}");
    const plyID = this.state.plyID;
    if (!this[log][plyID]) {
      this[log] = Object.assign({ [plyID]: [message] }, this[log]);
    } else {
      this[log][plyID].push(message);
    }
    this._updatePTN(true);
    return message;
  }
  editComment(log, plyID, index, message) {
    if (this[log][plyID] && this[log][plyID][index]) {
      this[log][plyID][index].message = message;
      this._updatePTN(true);
      return this[log][plyID][index];
    }
    return null;
  }
  removeComment(log, plyID, index = this.state.plyID) {
    if (this[log][plyID]) {
      if (this[log][plyID].length > 1) {
        this[log][plyID].splice(index, 1);
      } else {
        this[log] = omit(this[log], plyID);
      }
      this._updatePTN(true);
    }
  }

  addChatMessage(message) {
    return this.addComment("chatlog", message);
  }
  editChatMessage(plyID, index, message) {
    return this.editComment("chatlog", plyID, index, message);
  }
  removeChatMessage(plyID, index) {
    return this.removeComment("chatlog", plyID, index);
  }

  addNote(message) {
    return this.addComment("notes", message);
  }
  editNote(plyID, index, message) {
    return this.editComment("notes", plyID, index, message);
  }
  removeNote(plyID, index) {
    return this.removeComment("notes", plyID, index);
  }

  isValid() {
    this.errors = [];

    return !this.errors.length;
  }
}
