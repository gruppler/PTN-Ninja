import Comment from "../Comment";
import Evaluation from "../Evaluation";
import Linenum from "../Linenum";
import Move from "../Move";
import Nop from "../Nop";
import Ply from "../Ply";
import Result from "../Result";
import Tag from "../Tag";

import GameState from "./state";

import { defaults, each, flatten, map, uniq } from "lodash";
import memoize from "./memoize";

export const pieceCounts = {
  3: { flat: 10, cap: 0 },
  4: { flat: 15, cap: 0 },
  5: { flat: 21, cap: 1 },
  6: { flat: 30, cap: 1 },
  7: { flat: 40, cap: 2 },
  8: { flat: 50, cap: 2 }
};

export const sample = tags => {
  return defaults(
    {
      5: {
        tps:
          "x2,21S,x2/x,2S,21S,1S,x/12S,12S,x,12S,12S/x,1S,21S,2S,x/x2,21S,x2 1 15",
        caps: 2,
        flats: 10
      },
      6: {
        tps:
          "21S,1S,x2,2S,12S/1S,21S,1S,2S,12S,2S/x,1S,21S,12S,2S,x/x,2S,12S,21S,1S,x/2S,12S,2S,1S,21S,1S/12S,2S,x2,1S,21S 1 27",
        caps: 2,
        flats: 20
      },
      7: {
        tps:
          "21S,1S,x3,2S,12S/1S,21S,1S,x,2S,12S,2S/x,1S,21S,21S,12S,2S,x/x2,12S,x,12S,x2/x,2S,12S,21S,21S,1S,x/2S,12S,2S,x,1S,21S,1S/12S,2S,x3,1S,21S 1 33",
        caps1: 2,
        caps2: 3,
        flats1: 25,
        flats2: 24
      },
      8: {
        tps:
          "21S,1S,x4,2S,12S/1S,21S,1S,x2,2S,12S,2S/x,1S,21S,1S,2S,12S,2S,x/x2,1S,21S,12S,2S,x2/x2,2S,12S,21S,1S,x2/x,2S,12S,2S,1S,21S,1S,x/2S,12S,2S,x2,1S,21S,1S/12S,2S,x4,1S,21S 1 37",
        caps: 4,
        flats: 28
      }
    }[tags.size] || {},
    {
      caps: "",
      flats: "",
      caps1: "",
      caps2: "",
      flats1: "",
      flats2: "",
      tps: ""
    }
  );
};

export const isSample = tags => {
  return tags.tps && tags.tps === sample(tags).tps;
};

export const generateName = (tags = {}, game) => {
  const tag = key =>
    (key in tags ? tags[key] : game ? game.tag(key) : "") || "";
  const player1 = tag("player1");
  const player2 = tag("player2");
  const result = tag("result").replace(/1\/2-1\/2/g, "TIE");
  const date = tag("date");
  const time = tag("time").replace(/\D/g, ".");
  const size = tag("size");
  return (
    (player1.length || player2.length ? player1 + " vs " + player2 + " " : "") +
    `${size}x${size}` +
    (isSample(tags) ? " SMASH" : "") +
    (result ? " " + result : "") +
    (date ? " " + date : "") +
    (time ? (date ? "-" : " ") + time : "")
  );
};

export const isDefaultName = name => {
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
    this.pieceCounts = {
      1: { ...pieceCounts[this.size] },
      2: { ...pieceCounts[this.size] }
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
    this.state = new GameState(this);

    // Parse BODY
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
          let plyID = this.plies.length - 1;
          let log = item.player === null ? "notes" : "chatlog";
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
            linenum: Linenum.parse(moveNumber + ". ", this, branch),
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
      } else if (/[^\s]/.test(notation)) {
        throw new Error("Invalid PTN format");
      } else {
        break;
      }

      notation = notation.trimStart().substr(item.ptn.length);
      isDoubleBreak = startsWithDoubleBreak.test(notation);
      delete item.ptn;
    }

    if (!this.moves.length) {
      this.moves[0] = new Move({ game: this, id: 0, index: 0 });
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
      if (!(params.state.targetBranch in this.branches)) {
        params.state.targetBranch = "";
      }
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

    const pushBranch = ply => {
      // Self
      sorted.push(ply.branch);
      // Children
      ply.children.forEach(pushChild);
    };

    const pushChild = ply => {
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
    const moves = this.getBranchesSorted().map(branch =>
      this.moves.filter(move => move.branch === branch).sort(move => move.index)
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
        [
          "size",
          "tps",
          "caps",
          "flats",
          "caps1",
          "flats1",
          "caps2",
          "flats2"
        ].find(tag => tags[tag] !== this.tag(tag))
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

  updatePTN(ptn, recordChange = true) {
    const update = () => this.init(ptn, { ...this, state: this.minState });
    if (recordChange) {
      this.recordChange(update);
    } else {
      update();
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
}
