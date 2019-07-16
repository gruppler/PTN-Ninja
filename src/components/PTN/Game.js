import Marray from "marray";

import Tag from "./Tag";
import Comment from "./Comment";
import Linenum from "./Linenum";
import Ply from "./Ply";
import Evaluation from "./Evaluation";
import Result from "./Result";
import Nop from "./Nop";
import Move from "./Move";
import Piece from "../Board/Piece.js";

import { map, times, trimStart } from "lodash";

const pieceCounts = {
  3: { F: 10, C: 0, total: 10 },
  4: { F: 15, C: 0, total: 15 },
  5: { F: 21, C: 1, total: 22 },
  6: { F: 30, C: 1, total: 31 },
  7: { F: 40, C: 2, total: 42 },
  8: { F: 50, C: 2, total: 52 }
};

const top = stack => stack[stack.length - 1];

export default class Game {
  constructor(notation, { name, state }) {
    let item, key, ply;
    let branch = "";
    let moveNumber = 1;
    let move = new Move({ game: this });

    this.name = name;
    this.state = { plyID: 0, plyIsDone: false };
    this.tags = {};
    this.moves = [move];
    this.plies = [];
    this.chatlog = {};
    this.notes = {};

    notation = trimStart(notation);

    while (notation.length) {
      if (notation[0] === "[") {
        // Tag
        item = Tag.parse(notation);
        key = item.key.toLowerCase();
        this.tags[key] = item;
        if (key === "tps") {
          moveNumber = item.value.number;
          if (item.value.player === 2) {
            move.setPly(new Nop(), 1);
          }
        }
      } else if (notation[0] === "{") {
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
          move.setPly(ply, 2);
        } else {
          // New move
          moveNumber += 1;
          move = new Move({
            game: this,
            id: this.moves.length,
            linenum: new Linenum(branch + moveNumber),
            ply1: ply
          });
          this.moves.push(move);
        }
        this.plies.push(ply);
      } else if (/[?!'"]/.test(notation[0])) {
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

    this.pieceCounts = pieceCounts[this.size];
    this.updateState();
    this.goToPly(state.plyID, state.plyIsDone);
  }

  static parse(notation, { name = "", state = {} }) {
    return new Game(notation, { name, state });
  }

  _setPly(plyID, isDone) {
    this.state.plyID = plyID;
    this.state.plyIsDone = isDone || false;
    this.updateState();
  }

  // After _setPly, update the rest of the state
  updateState() {
    let newPly = this.plies[this.state.plyID];
    let newMove = newPly.move;
    let newBranch = newMove.linenum.branch;

    if (!this.state.squares) {
      this.state.squares = new Marray.two(this.size, this.size, () => []);
    }

    if (!this.state.pieces) {
      this.state.pieces = {
        1: { F: [], C: [] },
        2: { F: [], C: [] }
      };
    }

    if (this.state.branch !== newBranch || !this.state.plies) {
      this.state.plies = this.plies.filter(
        ply =>
          newBranch === ply.move.linenum.branch ||
          (newBranch.startsWith(ply.move.linenum.branch) &&
            ply.move.linenum.number <= newMove.linenum.number)
      );
      this.state.plies.forEach((ply, index) => (ply.index = index));

      this.state.moves = this.moves.filter(
        move =>
          newBranch === move.linenum.branch ||
          (newBranch.startsWith(move.linenum.branch) &&
            move.linenum.number <= newMove.linenum.number)
      );
      this.state.moves.forEach((move, index) => (move.index = index));
    }

    if (this.state.ply !== newPly) {
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

    this.state.player =
      this.state.plyIsDone && this.state.nextPly
        ? this.state.nextPly.player
        : this.state.ply.player;

    // TODO: Trigger mutation event
  }

  _doPly(ply) {
    if (this._doMoveset(ply)) {
      this._setPly(ply.id, true);
      return true;
    } else {
      return false;
    }
  }

  _undoPly(ply) {
    if (this._doMoveset(ply, true)) {
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
          top(square).isStanding = true;
        }
      } else {
        if (square.length && top(square).isStanding) {
          if (stack[0].isCapstone) {
            if (!flatten) {
              flatten = ply.wallSmash = "*";
              // TODO: Trigger mutation event mutation event
            }
          } else {
            console.error("Illegal ply");
            return false;
          }
        }
        if (flatten) {
          top(square).isStanding = false;
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

  goToPly(plyID, isDone) {
    const targetPly = this.plies[plyID];

    if (!targetPly) {
      return false;
    }

    const targetState = {
      ply: targetPly,
      plyIsDone: isDone,
      branch: targetPly.move.linenum.branch
    };

    this.state.targetBranch = targetState.branch;

    // Go back until we find a common branch
    while (!targetState.branch.startsWith(this.state.branch)) {
      this._undoPly(this.state.plyIsDone ? this.state.ply : this.state.prevPly);
    }

    // Go forward until we reach the target ply
    while (this.state.ply.index < targetState.ply.index) {
      this._doPly(this.state.plyIsDone ? this.state.nextPly : this.state.ply);
    }

    // Go backward until we reach the target ply
    while (this.state.ply.index > targetState.ply.index) {
      this._undoPly(this.state.plyIsDone ? this.state.ply : this.state.prevPly);
    }

    // Do or undo the target ply
    if (targetState.plyIsDone !== this.state.plyIsDone) {
      if (targetState.plyIsDone) {
        this._doPly(this.state.ply);
      } else {
        this._undoPly(this.state.ply);
      }
    }

    return true;
  }

  first() {
    return this.goToPly(0, false);
  }

  last() {
    return this.goToPly(top(this.state.plies).id, true);
  }

  prev() {
    if (this.state.plyIsDone) {
      return this._undoPly(this.state.ply);
    } else if (this.state.prevPly) {
      return this.goToPly(this.state.prevPly.id, false);
    }
    return false;
  }

  next() {
    if (!this.state.plyIsDone) {
      return this._doPly(this.state.ply);
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

  generateName(player1Default = "1", player2Default = "2") {
    const player1 = this.tag("player1", player1Default);
    const player2 = this.tag("player2", player2Default);
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
      ? this.tags[key].value.text
        ? this.tags[key].value.text
        : this.tags[key].value
      : defaultValue
      ? defaultValue
      : "";
  }

  getMoveComments(move) {
    let comments = [];
    if (move.ply1 && "index" in move.ply1) {
      comments[0] = (this.notes[move.ply1.index] || []).concat(
        this.chatlog[move.ply1.index] || []
      );
    }
    if (move.ply2 && "index" in move.ply2) {
      comments[1] = (this.notes[move.ply2.index] || []).concat(
        this.chatlog[move.ply2.index] || []
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
