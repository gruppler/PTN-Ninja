import Comment from "../Comment";
import Evaluation from "../Evaluation";
import Linenum from "../Linenum";
import Move from "../Move";
import Nop from "../Nop";
import Ply from "../Ply";
import Result from "../Result";
import Tag from "../Tag";

import GameState from "./state";

import { each, flatten, map, trimStart } from "lodash";
import memoize from "./memoize";

const pieceCounts = {
  3: { flat: 10, cap: 0, total: 10 },
  4: { flat: 15, cap: 0, total: 15 },
  5: { flat: 21, cap: 1, total: 22 },
  6: { flat: 30, cap: 1, total: 31 },
  7: { flat: 40, cap: 2, total: 42 },
  8: { flat: 50, cap: 2, total: 52 }
};

export default class GameBase {
  static t = {
    Black: "Black",
    White: "White"
  };

  constructor(notation, params) {
    this.init(notation, params);
  }

  init(
    notation,
    params = { name: "", state: null, history: [], historyIndex: 0 }
  ) {
    Object.defineProperty(this, "movesGrouped", {
      get: memoize(this.getMovesGrouped, () => this.moves.length),
      configurable: true
    });
    Object.defineProperty(this, "movesSorted", {
      get: memoize(this.getMovesSorted, () => this.moves.length),
      configurable: true
    });

    let item, key, ply;
    let branch = null;
    let moveNumber = 1;
    let move = new Move({ game: this, id: 0, index: 0 });

    this.isLocal = true;
    this.name = params.name;
    this.state = null;
    this.history = params.history ? params.history.concat() : [];
    this.historyIndex = params.historyIndex || 0;
    this.tags = {};
    this.moves = [move];
    this.boards = {};
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

    // Initialize game state
    this.state = new GameState(this);

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
        item = Linenum.parse(notation, this);
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
          move.ply1 = item;
        } else if (!move.ply2 && !move.ply1.result) {
          move.ply2 = item;
        }
      } else if (/[1-8a-hCSF]/.test(notation[0])) {
        // Ply
        item = ply = Ply.parse(notation, { id: this.plies.length });
        if (
          move.number === this.firstMoveNumber &&
          this.firstPlayer === 2 &&
          !move.ply1
        ) {
          move.ply1 = Nop.parse("--");
        }
        if (!move.ply1) {
          // Player 1 ply
          ply.player = 1;
          ply.color = moveNumber === 1 ? 2 : 1;
          move.ply1 = ply;
        } else if (!move.ply2) {
          // Player 2 ply
          ply.player = 2;
          ply.color = moveNumber === 1 ? 1 : 2;
          move.ply2 = ply;
        } else {
          // New move
          moveNumber += 1;
          move = new Move({
            game: this,
            id: this.moves.length,
            linenum: Linenum.parse(branch + moveNumber + ". ", this),
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
      this.moves[0].linenum = Linenum.parse(moveNumber + ". ", this);
    }

    this._updatePTN();

    if (!this.name) {
      this.name = this.generateName();
    }

    if (this.tags.tps) {
      this._doTPS(this.tags.tps.value);
    }

    this.saveBoardState();

    if (params.state) {
      this.state.targetBranch = params.state.targetBranch;
      ply = this.state.plies[params.state.plyIndex];
      if (ply) {
        if (ply.id || params.state.plyIsDone) {
          this.goToPly(ply.id, params.state.plyIsDone);
        } else {
          this.state.plyID = ply.id;
        }
      }
    }
  }

  get minState() {
    return this.state.min;
  }

  static sortPlies(a, b) {
    return a.branch === b.branch
      ? a.index - b.index
      : a.branch.substr(0, a.branch.length - 1) <
        b.branch.substr(0, b.branch.length - 1)
      ? -1
      : 1;
  }

  getMovesGrouped() {
    const moves = Object.values(this.branches)
      .sort(GameBase.sortPlies)
      .map(ply =>
        this.moves
          .filter(move => move.branch === ply.branch)
          .sort(move => move.index)
      );
    return moves.length ? moves : [this.moves];
  }

  getMovesSorted() {
    return flatten(this.movesGrouped);
  }

  generateName(tags = {}) {
    const player1 = tags.player1 || this.tag("player1", GameBase.t["White"]);
    const player2 = tags.player2 || this.tag("player2", GameBase.t["Black"]);
    const result = (tags.result || this.tag("result")).replace(/\//g, "-");
    const date = tags.date || this.tag("date");
    const time = (tags.time || this.tag("time")).replace(/\D/g, ".");
    const size = ` ${this.size}x${this.size}`;
    return (
      player1 +
      " vs " +
      player2 +
      size +
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

  _saveBoardState(board, plyID, plyIsDone) {
    if (!(plyID in this.boards)) {
      this.boards[plyID] = { [plyIsDone]: board };
    } else if (!(plyIsDone in this.boards[plyID])) {
      this.boards[plyID][plyIsDone] = board;
    }
  }

  saveBoardState() {
    let ply = this.state.ply;
    // Save board state if it's not already saved
    if (
      ply &&
      ply.id in this.boards &&
      this.state.plyIsDone in this.boards[ply.id]
    ) {
      return;
    }

    const board = this.state.board;
    this._saveBoardState(board, ply ? ply.id : 0, this.state.plyIsDone);

    if (!ply) {
      return;
    }

    // Set aliases too
    if (!this.state.plyIsDone) {
      if (ply.branches.length) {
        // Siblings
        ply.branches.forEach(ply => this._saveBoardState(board, ply.id, false));
      }
      // Previous ply
      ply = this.state.prevPly;
      if (ply) {
        this._saveBoardState(board, ply.id, true);
      }
    } else {
      // Next ply, plus all its siblings
      ply = this.state.nextPly;
      if (ply) {
        if (ply.branches.length) {
          ply.branches.forEach(ply => {
            this._saveBoardState(board, ply.id, false);
          });
        } else {
          this._saveBoardState(board, ply.id, false);
        }
      }
    }
  }

  _updatePTN(recordChange = false) {
    if (recordChange && this.ptn) {
      this.recordChange(() => (this.ptn = this.text()));
    } else {
      this.ptn = this.text();
    }
  }

  text() {
    return (
      map(this.tags, tag => tag.text()).join("\n") +
      "\n\n" +
      (this.notes[-1]
        ? this.notes[-1].map(comment => comment.text()).join("\n") + "\n\n"
        : "") +
      (this.chatlog[-1]
        ? this.chatlog[-1].map(comment => comment.text()).join("\n") + "\n\n"
        : "") +
      this.movesGrouped
        .map(moves =>
          moves.map(move => move.text(this.getMoveComments(move))).join("\n")
        )
        .join("\n\n")
    );
  }

  isValid() {
    this.errors = [];

    return !this.errors.length;
  }
}
