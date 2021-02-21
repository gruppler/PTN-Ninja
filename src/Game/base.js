import Comment from "./PTN/Comment";
import Evaluation from "./PTN/Evaluation";
import Linenum from "./PTN/Linenum";
import Move from "./PTN/Move";
import Nop from "./PTN/Nop";
import Ply from "./PTN/Ply";
import Result from "./PTN/Result";
import Tag from "./PTN/Tag";

import Board from "./board";

import { defaults, each, flatten, isEmpty, map, uniq } from "lodash";
import memoize from "./memoize";

export const pieceCounts = {
  3: { flat: 10, cap: 0 },
  4: { flat: 15, cap: 0 },
  5: { flat: 21, cap: 1 },
  6: { flat: 30, cap: 1 },
  7: { flat: 40, cap: 2 },
  8: { flat: 50, cap: 2 },
};

export const sample = (tags) => {
  return defaults(
    {
      5: {
        tps:
          "x2,21S,x2/x,2S,21S,1S,x/12S,12S,x,12S,12S/x,1S,21S,2S,x/x2,21S,x2 1 15",
        caps: 2,
      },
      6: {
        tps:
          "21S,1S,x2,2S,12S/1S,21S,1S,2S,12S,2S/x,1S,21S,12S,2S,x/x,2S,12S,21S,1S,x/2S,12S,2S,1S,21S,1S/12S,2S,x2,1S,21S 1 27",
        caps: 2,
      },
      7: {
        tps:
          "21S,1S,x3,2S,12S/1S,21S,1S,x,2S,12S,2S/x,1S,21S,21S,12S,2S,x/x2,12S,x,12S,x2/x,2S,12S,21S,21S,1S,x/2S,12S,2S,x,1S,21S,1S/12S,2S,x3,1S,21S 1 33",
        caps: 3,
      },
      8: {
        tps:
          "21S,1S,x4,2S,12S/1S,21S,1S,x2,2S,12S,2S/x,1S,21S,1S,2S,12S,2S,x/x2,1S,21S,12S,2S,x2/x2,2S,12S,21S,1S,x2/x,2S,12S,2S,1S,21S,1S,x/2S,12S,2S,x2,1S,21S,1S/12S,2S,x4,1S,21S 1 37",
        caps: 4,
      },
    }[tags.size] || {},
    {
      caps: "",
      flats: "",
      caps1: "",
      caps2: "",
      flats1: "",
      flats2: "",
      tps: "",
    }
  );
};

export const isSample = (tags) => {
  return tags.tps && tags.tps === sample(tags).tps;
};

export const generateName = (tags = {}, game) => {
  const tag = (key) =>
    (key in tags ? tags[key] : game ? game.tag(key) : "") || "";
  const player1 = tag("player1");
  const player2 = tag("player2");
  const result = tag("result").replace(/1\/2-1\/2/g, "TIE");
  const date = tag("date");
  const time = tag("time").replace(/\D/g, ".");
  const size = tag("size");
  return (
    (player1.length && player2.length ? player1 + " vs " + player2 + " " : "") +
    `${size}x${size}` +
    ((game ? game.isSample : isSample(tags)) ? " SMASH" : "") +
    (result ? " " + result : "") +
    (date ? " " + date : "") +
    (time ? (date ? "-" : " ") + time : "")
  );
};

export const isDefaultName = (name) => {
  return /^([^"]+ vs [^"]+ )?\dx\d( SMASH)?( [01RF]-[01RF]| TIE)?( \d{4}\.\d{2}\.\d{2})?([- ]?\d{2}\.\d{2}\.\d{2})?$/.test(
    name
  );
};

export default class GameBase {
  constructor(notation, params) {
    this.init(notation, params);
  }

  init(
    notation,
    params = {
      name: "",
      state: null,
      config: null,
      history: [],
      historyIndex: 0,
    }
  ) {
    Object.defineProperty(this, "movesGrouped", {
      get: memoize(this.getMovesGrouped, () => this.moves.length),
      configurable: true,
    });
    Object.defineProperty(this, "movesSorted", {
      get: memoize(this.getMovesSorted, () => this.moves.length),
      configurable: true,
    });

    let moveNumber = 1;

    this.hasTPS = false;
    this.name = params.name;
    this.board = null;
    this.history = params.history ? params.history.concat() : [];
    this.historyIndex = params.historyIndex || 0;
    this.config =
      params.config && !isEmpty(params.config)
        ? { ...params.config }
        : { isOnline: false };
    this.tags = {};
    this.moves = [];
    this.boardStates = {};
    this.branches = {};
    this.plies = [];
    this.chatlog = {};
    this.notes = {};

    // Parse HEAD
    if (notation) {
      let item, key;

      notation = notation.trimStart();
      while (notation.length && notation[0] === "[") {
        // Tag
        item = Tag.parse(notation);
        key = item.key.toLowerCase();
        this.tags[key] = item;
        notation = notation.substr(item.ptn.length).trimStart();
        delete item.ptn;
      }
    } else if (params.tags) {
      this.parseJSONTags(params.tags);
    }

    if (this.tags.date) {
      this.datetime = Tag.toDate(
        this.tags.date.value,
        this.tags.time ? this.tags.time.value : ""
      );
    } else {
      this.datetime = new Date();
    }

    if (this.tags.size) {
      this.size = this.tags.size.value;
    } else {
      if (this.tags.tps) {
        this.size = this.tags.tps.value.size;
        this.tags.size = Tag.parse(`[Size "${this.size}"]`);
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

    // Initialize board
    this.pieceCounts = {
      1: { ...pieceCounts[this.size] },
      2: { ...pieceCounts[this.size] },
    };
    if (this.tags.flats) {
      this.pieceCounts[1].flat = this.tags.flats.value;
      this.pieceCounts[2].flat = this.tags.flats.value;
    }
    if (this.tags.caps) {
      this.pieceCounts[1].cap = this.tags.caps.value;
      this.pieceCounts[2].cap = this.tags.caps.value;
    }
    if (this.tags.flats1) {
      this.pieceCounts[1].flat = this.tags.flats1.value;
    }
    if (this.tags.caps1) {
      this.pieceCounts[1].cap = this.tags.caps1.value;
    }
    if (this.tags.flats2) {
      this.pieceCounts[2].flat = this.tags.flats2.value;
    }
    if (this.tags.caps2) {
      this.pieceCounts[2].cap = this.tags.caps2.value;
    }
    this.pieceCounts[1].total =
      this.pieceCounts[1].flat + this.pieceCounts[1].cap;
    this.pieceCounts[2].total =
      this.pieceCounts[2].flat + this.pieceCounts[2].cap;
    Object.freeze(this.pieceCounts);
    this.board = new Board(this);

    // Parse BODY
    if (notation) {
      let item, ply;
      let branch = null;
      let move = new Move({
        game: this,
        id: 0,
        index: 0,
      });
      let isDoubleBreak = false;
      const startsWithDoubleBreak = /^\s*(\r?\n|\r){2,}\s*/;

      this.moves[0] = move;

      while (notation.length) {
        if (Comment.test(notation)) {
          // Comment
          item = Comment.parse(notation);
          if (
            isDoubleBreak &&
            this.plies.length &&
            Linenum.test(notation.trimStart().substr(item.ptn.length))
          ) {
            // Branch identifier
            branch = item.contents;
          } else {
            // Comment
            const plyID = this.plies.length - 1;
            const log = item.player === null ? "notes" : "chatlog";
            if (!this[log][plyID]) {
              this[log][plyID] = [];
            }
            this[log][plyID].push(item);
          }
        } else if (Linenum.test(notation)) {
          // Line number
          item = Linenum.parse(notation, this, branch);
          if (!move.linenum) {
            move.linenum = item;
            if (move.index === 0 && item.number !== this.firstMoveNumber) {
              if (item.ptn.trim() === notation.trim()) {
                Linenum.parse(this.firstMoveNumber + ".", this, branch);
              } else {
                throw new Error("Invalid first line number");
              }
            }
          } else {
            move = new Move({
              game: this,
              id: this.moves.length,
              linenum: item,
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
          if (!move.linenum) {
            move.linenum = Linenum.parse(moveNumber + ". ", this, branch);
          }
          if (
            (!move.number || move.number === this.firstMoveNumber) &&
            this.firstPlayer === 2 &&
            !move.ply1
          ) {
            move.ply1 = Nop.parse("--");
          }
          if (!move.ply1) {
            // Player 1 ply
            ply.player = 1;
            ply.color = move.number === 1 ? 2 : 1;
            move.ply1 = ply;
          } else if (!move.ply2) {
            // Player 2 ply
            ply.player = 2;
            ply.color = move.number === 1 ? 1 : 2;
            move.ply2 = ply;
            moveNumber += 1;
          } else {
            // New move
            move = new Move({
              game: this,
              id: this.moves.length,
              linenum: Linenum.parse(moveNumber + ". ", this, branch),
              ply1: ply,
            });
            this.moves.push(move);
            if (move.number === 1 && ply.specialPiece) {
              throw new Error("Invalid first move");
            }
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
        } else if (/[^\s]/.test(notation)) {
          throw new Error("Invalid PTN format");
        } else {
          break;
        }

        notation = notation.trimStart().substr(item.ptn.length);
        isDoubleBreak = startsWithDoubleBreak.test(notation);
        delete item.ptn;
      }
    } else if (params.moves) {
      if (params.comments) {
        this.parseJSONComments(params.comments, -1);
      }
      this.parseJSONMoves(params.moves);
    }

    this._updatePTN();

    if (!this.name) {
      this.name = this.generateName();
    }

    if (this.tags.tps) {
      this.board.doTPS();
    }

    this.board.updateOutput();
    this.saveBoardState();

    if (params.state) {
      if (!(params.state.targetBranch in this.branches)) {
        params.state.targetBranch = "";
      }
      this.board.targetBranch = params.state.targetBranch || "";
      let ply = this.board.plies[params.state.plyIndex];
      if (ply) {
        if (ply.id || params.state.plyIsDone) {
          this.board.goToPly(ply.id, params.state.plyIsDone);
        } else {
          this.board.plyID = ply.id;
        }
      } else {
        this.board.plyID = -1;
      }
    } else if (this.board.plies.length) {
      this.board.plyID = 0;
    }
  }

  get pngFilename() {
    return `${this.name} - ${this.board.plyID}${
      this.board.plyIsDone ? "" : "-"
    }.png`;
  }

  get minState() {
    return this.board.minState;
  }

  get isLocal() {
    return !this.config.isOnline;
  }

  get isSample() {
    return isSample(this.JSONTags);
  }

  get sample() {
    return sample(this.JSONTags);
  }

  plySort(a, b) {
    return a.index - b.index || a.id - b.id;
  }

  getBranchesSorted() {
    let branches = Object.values(this.branches).sort(this.plySort);
    let sorted = [];

    const pushBranch = (ply) => {
      // Self
      sorted.push(ply.branch);
      // Children
      ply.children.forEach(pushChild);
    };

    const pushChild = (ply) => {
      // Self
      sorted.push(ply.branch);
      // Siblings
      ply.branches.slice(1).forEach(pushBranch);
    };

    if (branches.length) {
      pushBranch(branches[0]);
    }

    return uniq(sorted);
  }

  getMovesGrouped() {
    const moves = this.getBranchesSorted().map((branch) =>
      this.moves
        .filter((move) => move.branch === branch)
        .sort((a, b) => a.index - b.index)
    );
    return moves.length ? moves : [this.moves];
  }

  getMovesSorted() {
    return flatten(this.movesGrouped);
  }

  generateName(tags = {}) {
    return generateName(tags, this);
  }

  get isDefaultName() {
    return isDefaultName(this.name);
  }

  setName(name) {
    this.name = name || this.generateName();
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
        tags[key] = new Tag(false, key, tag);
      } else {
        delete tags[key];
        delete this.tags[key];
      }
    });
    this.tags = Object.assign({}, this.tags, tags);
    this.hasTPS = "tps" in this.tags;
    if (updatePTN) {
      this._updatePTN(recordChange);
      if (
        [
          "size",
          "tps",
          "caps",
          "flats",
          "caps1",
          "flats1",
          "caps2",
          "flats2",
        ].find((tag) => tag in tags && tags[tag] !== this.tag(tag))
      ) {
        this.init(this.ptn, { ...this, state: null });
      }
    }
  }

  _saveBoardState(board, plyID, plyIsDone) {
    if (!(plyID in this.boardStates)) {
      this.boardStates[plyID] = { [plyIsDone]: Object.freeze(board) };
    } else if (!(plyIsDone in this.boardStates[plyID])) {
      this.boardStates[plyID][plyIsDone] = Object.freeze(board);
    }
  }

  saveBoardState() {
    let ply = this.board.ply;
    // Save board state if it's not already saved
    if (
      ply &&
      ply.id in this.boardStates &&
      this.board.plyIsDone in this.boardStates[ply.id]
    ) {
      return;
    }

    const board = this.board.snapshot;
    this._saveBoardState(board, ply ? ply.id : 0, this.board.plyIsDone);

    if (!ply) {
      return;
    }

    // Set aliases too
    if (!this.board.plyIsDone) {
      if (ply.branches.length) {
        // Siblings
        ply.branches.forEach((ply) =>
          this._saveBoardState(board, ply.id, false)
        );
      }
      // Previous ply
      ply = this.board.prevPly;
      if (ply) {
        this._saveBoardState(board, ply.id, true);
      }
    } else {
      // Next ply, plus all its siblings
      ply = this.board.nextPly;
      if (ply) {
        if (ply.branches.length) {
          ply.branches.forEach((ply) => {
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
      this.recordChange(() => (this.ptn = this.toString()));
    } else {
      this.ptn = this.toString();
    }
  }

  updatePTN(ptn, recordChange = true) {
    const update = () => this.init(ptn, { ...this, state: this.minState });
    if (recordChange) {
      this.recordChange(update);
    } else {
      update();
    }
  }

  toString(showAllBranches = true, showComments = true, tags) {
    return this.headerText(tags) + this.moveText(showAllBranches, showComments);
  }

  headerText(tags = this.tags) {
    return map(tags, (tag) => tag.toString()).join("\r\n") + "\r\n\r\n";
  }

  moveText(showAllBranches = false, showComments = false) {
    const printMove = (move) =>
      move.toString(
        showComments ? this.getMoveComments(move) : null,
        showAllBranches
      );

    let prefix = "";
    if (showComments) {
      if (this.notes[-1]) {
        prefix +=
          this.notes[-1].map((comment) => comment.toString()).join("\r\n") +
          "\r\n\r\n";
      }
      if (this.chatlog[-1]) {
        prefix +=
          this.chatlog[-1].map((comment) => comment.toString()).join("\r\n") +
          "\r\n\r\n";
      }
    }

    if (showAllBranches) {
      return (
        prefix +
        this.movesGrouped
          .map((moves) => moves.map(printMove).join("\r\n"))
          .join("\r\n\r\n")
      );
    } else {
      return prefix + this.board.moves.map(printMove).join("\r\n");
    }
  }
}
