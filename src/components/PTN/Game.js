import Marray from "marray";

import Tag from "./Tag";
import Comment from "./Comment";
import Linenum from "./Linenum";
import Ply from "./Ply";
import Evaluation from "./Evaluation";
import Result from "./Result";
import Nop from "./Nop";
import Move from "./Move";

import { defaults, last, map, times, trimStart } from "lodash";

const pieceCounts = {
  3: { F: 10, C: 0, total: 10 },
  4: { F: 15, C: 0, total: 15 },
  5: { F: 21, C: 1, total: 22 },
  6: { F: 30, C: 1, total: 31 },
  7: { F: 40, C: 2, total: 42 },
  8: { F: 50, C: 2, total: 52 }
};

class Piece {
  constructor(params) {
    this.x = params.x;
    this.y = params.y;
    this.z = params.z || 0;
    this.stackHeight = params.stackHeight || 1;
    this.color = params.color;
    this.isStanding = params.isStanding || false;
    this.isCapstone = params.isCapstone || false;
  }
}

export default class Game {
  constructor(notation, params = { name: "", state: null }) {
    let item, key, ply;
    let branch = null;
    let moveNumber = 1;
    let move = new Move({ game: this, id: 0, index: 0 });

    this.name = params.name;
    this.state = {};
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

    if (this.tags.tps) {
      this.firstMoveNumber = this.tags.tps.value.linenum;
      this.firstPlayer = this.tags.tps.value.player;
      moveNumber = this.tags.tps.value.number;
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
        if (branch !== item.branch && this.firstPlayer === 2) {
          move.setPly(Nop.parse("--"), 1);
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
        } else if (!move.ply2) {
          move.setPly(item, 2);
        }
      } else if (/[1-8a-hCSF]/.test(notation[0])) {
        // Ply
        item = ply = Ply.parse(notation, { id: this.plies.length });
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
  }

  static parse(notation, { name = "", state = {} }) {
    return new Game(notation, { name, state });
  }

  _setPly(plyID, isDone) {
    this.state.plyID = plyID;
    this.state.plyIsDone = isDone || false;
    this.updateState();
  }

  setTarget(ply) {
    this.state.targetBranch = ply.branch;
    if (
      ply.branches.includes(this.state.ply) ||
      !this.state.ply.isInBranch(this.state.targetBranch)
    ) {
      this.goToPly(ply.id, this.state.plyIsDone);
    } else {
      this.updateState(true);
    }
  }

  // After _setPly, update the rest of the state
  updateState(forceUpdate = false) {
    this.state = defaults(this.state, {
      plyID: 0,
      plyIsDone: false,
      player: 1,
      branch: "",
      targetBranch: "",
      squares: new Marray.two(this.size, this.size, () => []),
      pieces: {
        1: { F: [], C: [] },
        2: { F: [], C: [] }
      }
    });

    if (this.state.plyID in this.plies) {
      let newPly = this.plies[this.state.plyID];
      let newMove = newPly.move;
      let newBranch = newPly.branch;
      let newNumber = newMove.linenum.number;
      let ply;

      // Update lists of current branch's plies and moves
      if (
        forceUpdate ||
        !this.state.plies ||
        (this.state.branch !== newBranch &&
          newPly.isInBranch(this.state.targetBranch))
      ) {
        this.state.plies = [];
        this.state.moves = [];
        for (let id = 0; id < this.plies.length; id++) {
          ply = this.plies[id].getBranch(this.state.targetBranch);
          if (
            this.state.plies.includes(ply) ||
            (this.state.moves.length &&
              (ply.move.linenum.number <
                last(this.state.moves).linenum.number ||
                !ply.move.linenum.branch.startsWith(
                  last(this.state.moves).linenum.branch
                )))
          ) {
            break;
          }
          id = ply.id;
          this.state.plies.push(ply);
          if (ply.player === 2 || !ply.move.ply2) {
            this.state.moves.push(ply.move);
          }
          if (ply.result) {
            break;
          }
        }
      }

      // Update previous and next plies
      if (forceUpdate || this.state.ply !== newPly) {
        this.state.prevPly = newPly.index
          ? this.state.plies[newPly.index - 1]
          : null;
        this.state.nextPly =
          newPly.index < this.state.plies.length - 1
            ? this.state.plies[newPly.index + 1]
            : null;
      }

      this.state.ply = newPly;
      this.state.move = newMove;
      this.state.branch = newBranch;
      this.state.number = newNumber;

      this.state.player =
        this.state.plyIsDone && this.state.nextPly
          ? this.state.nextPly.player
          : this.state.ply.player;
    }

    // TODO: Trigger state mutation event
  }

  _doPly() {
    const ply = this.state.plyIsDone ? this.state.nextPly : this.state.ply;
    if (ply && this._doMoveset(ply)) {
      this._setPly(ply.id, true);
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
            x,
            y,
            color: ply.color,
            isStanding: ply.specialPiece === "S",
            isCapstone: ply.specialPiece === "C"
          });
          square.push(piece);
          this.state.pieces[ply.color][ply.pieceType].push(piece);
        }
      } else if (action === "pop") {
        times(count, () => stack.push(square.pop()));
        square.forEach(piece => (piece.stackHeight = square.length));

        if (flatten) {
          last(square).isStanding = true;
        }
      } else {
        if (square.length && last(square).isStanding) {
          if (stack[0].isCapstone) {
            if (!flatten) {
              flatten = ply.wallSmash = "*";
              // TODO: Trigger ptn mutation event mutation event
            }
          } else {
            console.error("Illegal ply");
            return false;
          }
        }
        if (flatten) {
          last(square).isStanding = false;
          square.forEach(piece => (piece.stackHeight = square.length));
        }

        times(count, () => {
          let piece = stack.pop();
          Object.assign(piece, {
            x,
            y,
            z: square.length
          });
          square.push(piece);
        });
        square.forEach(piece => (piece.stackHeight = square.length));
      }
    });

    return true;
  }

  _doTPS({ grid }) {
    let stack, square, piece, type, stackHeight;
    grid.forEach((row, y) => {
      row.forEach((col, x) => {
        if (col[0] !== "x") {
          stack = col.split("");
          square = this.state.squares[y][x];
          stackHeight = col.match(/[12]/g).length;
          while ((piece = stack.shift())) {
            if (/[SC]/.test(stack[0])) {
              type = stack.shift();
            } else {
              type = "flat";
            }
            piece = new Piece({
              x,
              y,
              z: square.length,
              stackHeight,
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

    if (!targetPly) {
      return false;
    }

    const log = label => {
      console.log(
        label,
        this.state.branch + this.state.number + ".",
        this.state.ply.text(),
        this.state.plyIsDone,
        this.state
      );
    };

    const target = {
      ply: targetPly,
      plyIsDone: isDone,
      move: targetPly.move,
      branch: targetPly.move.linenum.branch,
      number: targetPly.move.linenum.number
    };

    if (
      !this.state.targetBranch.startsWith(target.branch) ||
      target.index >= this.state.ply.index
    ) {
      this.state.targetBranch = target.branch;
    }

    log("started at");

    if (this.state.branch !== target.branch || this.state.plyID > plyID) {
      while (
        (!target.branch.startsWith(this.state.branch) ||
          this.state.number > target.number ||
          this.state.ply.index > target.ply.index ||
          this.state.plyIsDone) &&
        this._undoPly()
      ) {
        // Go back until we're on a common branch and before the target ply
      }
      log("went back to");
    }

    if (this.state.branch !== target.branch) {
      this._setPly(this.state.ply.getBranch(target.branch).id);
      log("switched branch to");
    }

    if (
      this.state.number < target.number ||
      this.state.ply.index < target.ply.index
    ) {
      while (
        (this.state.number < target.number ||
          this.state.ply.index < target.ply.index) &&
        this._doPly()
      ) {
        // Go forward until we reach the target ply
      }
      log("went forward to");
    } else if (
      this.state.number > target.number ||
      this.state.ply.index > target.ply.index
    ) {
      while (
        (this.state.number > target.number ||
          this.state.ply.index > target.ply.index) &&
        this._undoPly()
      ) {
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

  prev() {
    if (this.state.plyIsDone) {
      return this._undoPly();
    } else if (this.state.prevPly) {
      return this.goToPly(this.state.prevPly.id, false);
    }
    return false;
  }

  next() {
    if (!this.state.plyIsDone) {
      return this._doPly();
    } else if (this.state.nextPly) {
      return this.goToPly(this.state.nextPly.id, true);
    }
    return false;
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

  static importLang(t) {
    Game.t = Object.keys(Game.t).map(t);
  }

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
    let plyID = this.state.plyID;
    if (!this[log][plyID]) {
      this[log][plyID] = [];
    }
    this[log][plyID].push(message);
    return message;
  }

  addChatMessage(message) {
    return this.addComment("chatlog", message);
  }

  addNote(message) {
    return this.addComment("notes", message);
  }

  isValid() {
    this.errors = [];

    return !this.errors.length;
  }
}
