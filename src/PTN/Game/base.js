import Marray from "marray";

import Comment from "../Comment";
import Evaluation from "../Evaluation";
import Linenum from "../Linenum";
import Move from "../Move";
import Nop from "../Nop";
import Ply from "../Ply";
import Result from "../Result";
import Square from "../Square";
import Tag from "../Tag";

import { defaults, each, last, map, pick, trimStart } from "lodash";

const pieceCounts = {
  3: { flat: 10, cap: 0, total: 10 },
  4: { flat: 15, cap: 0, total: 15 },
  5: { flat: 21, cap: 1, total: 22 },
  6: { flat: 30, cap: 1, total: 31 },
  7: { flat: 40, cap: 2, total: 42 },
  8: { flat: 50, cap: 2, total: 52 }
};

const MIN_GAME_STATE_PROPS = ["targetBranch", "plyID", "plyIsDone"];

export default class GameBase {
  static t = {
    Black: "Black",
    White: "White"
  };

  constructor(
    notation,
    params = { name: "", state: null, history: [], historyIndex: 0 }
  ) {
    let item, key, ply;
    let branch = null;
    let moveNumber = 1;
    let move = new Move({ game: this, id: 0, index: 0 });

    this.isLocal = true;
    this.name = params.name;
    this.state = {};
    this.history = params.history ? params.history.concat() : [];
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
      isGameEnd: false,
      isFirstMove: false,
      turn: 1,
      player: 1,
      color: 1,
      branch: "",
      targetBranch: "",
      flats: [0, 0],
      squares: new Marray.two(
        this.size,
        this.size,
        (y, x) => new Square(x, y, this.size)
      ),
      pieces: {
        1: { flat: [], cap: [] },
        2: { flat: [], cap: [] }
      },
      selected: {
        pieces: [],
        squares: [],
        moveset: [],
        initialCount: 0
      }
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
    Object.assign(this.state, this._state);

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
          !move.ply1
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

    if (this.tags.tps) {
      this._doTPS(this.tags.tps.value);
      this.updateState();
    }

    if (
      params.state &&
      (params.state.plyID !== this.state.plyID || params.state.plyIsDone)
    ) {
      this.state.targetBranch = params.state.targetBranch;
      this.updateState();
      this.state._targetBranch = "";
      this.goToPly(params.state.plyID, params.state.plyIsDone);
    } else if (!this.state.ply) {
      this.updateState();
    }

    window.game = this;
  }

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
    }

    let flats = [0, 0];
    this.state.squares.forEach(row => {
      row.forEach(square => {
        if (square.length) {
          let piece = last(square);
          flats[piece.color - 1] += piece.isFlat;
        }
      });
    });
    this.state.flats = flats;

    this.state.isFirstMove =
      this.state.number === 1 &&
      (!this.state.ply || this.state.ply.index < 1 || !this.state.plyIsDone);

    if (this.state.ply) {
      this.state.isGameEnd = this.state.plyIsDone && !!this.state.ply.result;
      if (this.state.isGameEnd) {
        this.state.turn = this.state.ply.player;
      } else {
        this.state.turn = this.state.plyIsDone
          ? this.state.ply.player === 1
            ? 2
            : 1
          : this.state.ply.player;
      }
    } else {
      this.state.turn = this.firstPlayer;
    }

    if (this.state.isFirstMove) {
      this.state.color = this.state.turn === 1 ? 2 : 1;
    } else {
      this.state.color = this.state.turn;
    }

    if (this.isLocal) {
      this.state.player = this.state.turn;
    }
  }

  get minState() {
    return pick(this.state, MIN_GAME_STATE_PROPS);
  }

  generateName(tags = {}) {
    const player1 = tags.player1 || this.tag("player1", GameBase.t["White"]);
    const player2 = tags.player2 || this.tag("player2", GameBase.t["Black"]);
    const result = (tags.result || this.tag("result")).replace(/\//g, "-");
    const date = tags.date || this.tag("date");
    const time = (tags.time || this.tag("time")).replace(/\D/g, ".");
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

  setTags(tags) {
    each(tags, (tag, key) => {
      tags[key] = Tag.parse(`[${key} "${tag}"]`);
    });
    Object.assign(this.tags, tags);
    this._updatePTN(true);
  }

  _updatePTN(recordChange = false) {
    if (recordChange && this.ptn) {
      this.recordChange(() => (this.ptn = this.text()));
    } else {
      this.ptn = this.text();
    }
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

  isValid() {
    this.errors = [];

    return !this.errors.length;
  }
}
