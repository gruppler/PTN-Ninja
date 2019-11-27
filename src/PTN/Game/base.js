import Comment from "../Comment";
import Evaluation from "../Evaluation";
import Linenum from "../Linenum";
import Move from "../Move";
import Nop from "../Nop";
import Ply from "../Ply";
import Result from "../Result";
import Tag from "../Tag";

import GameState from "./state";

import { each, flatten, intersection, map } from "lodash";
import memoize from "./memoize";

const pieceCounts = {
  3: { flat: 10, cap: 0, total: 10 },
  4: { flat: 15, cap: 0, total: 15 },
  5: { flat: 21, cap: 1, total: 22 },
  6: { flat: 30, cap: 1, total: 31 },
  7: { flat: 40, cap: 2, total: 42 },
  8: { flat: 50, cap: 2, total: 52 }
};

export const generateName = (tags = {}, game) => {
  const tag = key =>
    (key in tags ? tags[key] : game ? game.tag(key) : "") || "";
  const player1 = tag("player1") || GameBase.t["White"];
  const player2 = tag("player2") || GameBase.t["Black"];
  const result = tag("result").replace(/1\/2/g, "50");
  const date = tag("date");
  const time = tag("time").replace(/\D/g, ".");
  const size = tag("size");
  return (
    player1 +
    " vs " +
    player2 +
    ` ${size}x${size}` +
    (result ? " " + result : "") +
    (date ? " " + date : "") +
    (time ? (date ? "-" : " ") + time : "")
  );
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
    let isDoubleBreak = false;
    const startsWithDoubleBreak = /^\s*(\r?\n|\r){2,}\s*/;

    this.isLocal = true;
    this.hasTPS = false;
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

    // Parse HEAD
    notation = notation.trimStart();
    while (notation.length && notation[0] === "[") {
      // Tag
      item = Tag.parse(notation);
      key = item.key.toLowerCase();
      this.tags[key] = item;
      notation = notation.substr(item.ptn.length).trimStart();
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
      this.hasTPS = true;
      this.firstMoveNumber = this.tags.tps.value.linenum;
      this.firstPlayer = this.tags.tps.value.player;
      moveNumber = this.tags.tps.value.linenum;
    } else {
      this.firstMoveNumber = 1;
      this.firstPlayer = 1;
    }

    // Initialize game state
    this.pieceCounts = pieceCounts[this.size];
    this.state = new GameState(this);

    // Parse BODY
    while (notation.length) {
      if (Comment.test(notation)) {
        // Comment
        item = Comment.parse(notation);
        if (
          isDoubleBreak &&
          Linenum.test(notation.trimStart().substr(item.ptn.length))
        ) {
          // Branch identifier
          branch = item.contents;
        } else {
          // Comment
          let plyID = this.plies.length - 1;
          let log = item.player === null ? "notes" : "chatlog";
          if (!this[log][plyID]) {
            this[log][plyID] = [];
          }
          this[log][plyID].push(item);
        }
      } else if (Linenum.test(notation)) {
        // Line number
        item = Linenum.parse(notation, this);
        if (branch && !item.branch) {
          // Persist branch
          item.branch = branch;
          item.parseBranch(this);
        }
        if (!move.linenum) {
          move.linenum = item;
        } else {
          move = new Move({
            game: this,
            id: this.moves.length,
            linenum: item
          });
          this.moves[move.id] = move;
        }
        branch = item.branch;
        moveNumber = item.number + 1;
        ply = null;
      } else if (Result.test(notation)) {
        // Result
        item = Result.parse(notation);
        if (ply) {
          ply.result = item;
        }
      } else if (Nop.test(notation)) {
        // Placeholder
        item = Nop.parse(notation);
        if (!move.ply1) {
          move.ply1 = item;
        } else if (!move.ply2 && !move.ply1.result) {
          move.ply2 = item;
        }
      } else if (Ply.test(notation)) {
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
          ply.color = move.number === 1 && !this.hasTPS ? 2 : 1;
          move.ply1 = ply;
        } else if (!move.ply2) {
          // Player 2 ply
          ply.player = 2;
          ply.color = move.number === 1 && !this.hasTPS ? 1 : 2;
          move.ply2 = ply;
        } else {
          // New move
          move = new Move({
            game: this,
            id: this.moves.length,
            linenum: Linenum.parse(branch + moveNumber + ". ", this),
            ply1: ply
          });
          this.moves.push(move);
          moveNumber += 1;
        }
        this.plies.push(ply);
        if (!(ply.branch in this.branches)) {
          this.branches[ply.branch] = ply;
        }
      } else if (Evaluation.test(notation[0])) {
        // Evalutaion
        item = Evaluation.parse(notation);
        if (ply) {
          ply.evaluation = item;
        }
      } else {
        throw new Error("Invalid PTN format: " + notation);
      }

      notation = notation.trimStart().substr(item.ptn.length);
      isDoubleBreak = startsWithDoubleBreak.test(notation);
      delete item.ptn;
    }

    if (!this.moves[0].linenum) {
      this.moves[0].linenum = Linenum.parse(this.firstMoveNumber + ". ", this);
    } else if (
      this.moves.length === 1 &&
      this.moves[0].number !== this.firstMoveNumber
    ) {
      this.moves[0].linenum.number = this.firstMoveNumber;
    }

    this._updatePTN();

    if (!this.name) {
      this.name = this.generateName();
    }

    if (this.tags.tps) {
      this.doTPS();
    }

    this.saveBoardState();

    if (params.state) {
      this.state.targetBranch = params.state.targetBranch || "";
      ply = this.state.plies[params.state.plyIndex];
      if (ply) {
        if (ply.id || params.state.plyIsDone) {
          this.goToPly(ply.id, params.state.plyIsDone);
        } else {
          this.state.plyID = ply.id;
        }
      } else {
        this.state.plyID = 0;
      }
    } else if (this.state.plies.length) {
      this.state.plyID = 0;
    }
  }

  get minState() {
    return this.state.min;
  }

  static sortBranches(a, b) {
    if (a.branch === b.branch) {
      // Same branch
      return a.index - b.index;
    } else if (a.linenum.parentBranch === b.linenum.parentBranch) {
      return (
        a.parentNumber - b.parentNumber || a.index - b.index || a.id - b.id
      );
    } else {
      const commonAncestors = intersection(
        a.move.linenum.ancestors,
        b.move.linenum.ancestors
      );
      if (commonAncestors.length) {
        return (
          a.move.linenum.ancestors.length - b.move.linenum.ancestors.length ||
          a.id - b.id
        );
      } else {
        return a.id - b.id;
      }
    }
  }

  getMovesGrouped() {
    const moves = Object.values(this.branches)
      .sort(GameBase.sortBranches)
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
    return generateName(tags, this);
  }

  tag(key, defaultValue) {
    return key in this.tags && this.tags[key].value
      ? this.tags[key].valueText
      : defaultValue !== undefined
      ? defaultValue
      : "";
  }

  setTags(tags, recordChange = true, updatePTN = true) {
    tags = { ...tags };
    each(tags, (tag, key) => {
      if (tag) {
        tags[key] = Tag.parse(`[${key} "${tag}"]`);
      } else {
        delete tags[key];
        delete this.tags[key];
      }
    });
    Object.assign(this.tags, tags);
    this.hasTPS = "tps" in this.tags;
    if (updatePTN) {
      this._updatePTN(recordChange);
      if (
        !this.plies.length &&
        (this.size !== this.tag("size") ||
          (tags.tps && tags.tps !== this.tag("tps")))
      ) {
        this.init(this.ptn, { ...this, state: null });
      }
    }
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

  text(showAllBranches = true, showComments = true) {
    return this.headerText() + this.moveText(showAllBranches, showComments);
  }

  headerText() {
    return map(this.tags, tag => tag.text()).join("\r\n") + "\r\n\r\n";
  }

  moveText(showAllBranches = false, showComments = false) {
    const printMove = move =>
      move.text(
        showComments ? this.getMoveComments(move) : null,
        showAllBranches
      );

    let prefix = "";
    if (showComments) {
      if (this.notes[-1]) {
        prefix +=
          this.notes[-1].map(comment => comment.text()).join("\r\n") +
          "\r\n\r\n";
      }
      if (this.chatlog[-1]) {
        prefix +=
          this.chatlog[-1].map(comment => comment.text()).join("\r\n") +
          "\r\n\r\n";
      }
    }

    if (showAllBranches) {
      return (
        prefix +
        this.movesGrouped
          .map(moves => moves.map(printMove).join("\r\n"))
          .join("\r\n\r\n")
      );
    } else {
      return prefix + this.state.moves.map(printMove).join("\r\n");
    }
  }

  isValid() {
    this.errors = [];

    return !this.errors.length;
  }
}
