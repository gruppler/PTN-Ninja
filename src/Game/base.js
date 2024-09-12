import Comment from "./PTN/Comment";
import Evaluation from "./PTN/Evaluation";
import Linenum from "./PTN/Linenum";
import Move from "./PTN/Move";
import Nop from "./PTN/Nop";
import Ply from "./PTN/Ply";
import Result from "./PTN/Result";
import Tag from "./PTN/Tag";

import Board from "./Board";

import {
  cloneDeep,
  each,
  flatten,
  isEqual,
  isFunction,
  isObject,
  isString,
  map,
  pick,
  uniq,
  zipObject,
} from "lodash";
import memoize from "./memoize";

export const pieceCounts = Object.freeze({
  3: Object.freeze({ flat: 10, cap: 0 }),
  4: Object.freeze({ flat: 15, cap: 0 }),
  5: Object.freeze({ flat: 21, cap: 1 }),
  6: Object.freeze({ flat: 30, cap: 1 }),
  7: Object.freeze({ flat: 40, cap: 2 }),
  8: Object.freeze({ flat: 50, cap: 2 }),
});

export const generateName = (tags = {}, game) => {
  const tag = (key) =>
    (key in tags ? tags[key] : game ? game.tag(key) : "") || "";
  const player1 = tag("player1");
  const player2 = tag("player2");
  let result = tag("result");
  const date = tag("date");
  const time = tag("time").replace(/\D/g, ".");
  const size = tag("size");
  if (result && !isString(result)) {
    result = result.text;
  }
  result = result.replace(/1\/2-1\/2/g, "DRAW");
  return (
    (player1.length && player2.length ? player1 + " vs " + player2 + " " : "") +
    `${size}x${size}` +
    (result ? " " + result : "") +
    (date ? " " + date : "") +
    (time ? (date ? "-" : " ") + time : "")
  );
};

export const isDefaultName = (name) => {
  return /^([^"]+ vs [^"]+ )?\dx\d( [01RF]-[01RF]| DRAW)?( \d{4}\.\d{2}\.\d{2})?([- ]?\d{2}\.\d{2}\.\d{2})?$/.test(
    name
  );
};

export default class GameBase {
  constructor(params = {}) {
    this.init(params);
  }

  get params() {
    const params = pick(this, [
      "ptn",
      "name",
      "state",
      "config",
      "history",
      "historyIndex",
    ]);
    params.state = this.minState;
    return params;
  }

  // Split multi-game PTN into separate games
  static split(ptn) {
    return ptn.match(
      /^\s*(\[\w+\s"[^"]*"\]\s*)+((\{[^}]*\})*[/.\s\da-hCFRS!?"'><+-]+)+/gm
    );
  }

  // #region Init
  init({
    ptn,
    name,
    state,
    config,
    tags,
    history,
    historyIndex,
    defaultSize,
    editingTPS,
    onInit,
    onError,
    onInsertPly,
    branches,
    notes,
    playerChat,
    spectatorChat,
    createdAt,
    updatedAt,
    createdBy,
    updatedBy,
  }) {
    // Set up init handler
    if (isFunction(onInit)) {
      this.onInit = onInit;
    }

    // Set up error handling
    if (isFunction(onError)) {
      this.onError = onError;
    }

    // Set up other handlers
    if (isFunction(onInsertPly)) {
      this.onInsertPly = onInsertPly;
    }

    const handleError = (error) => {
      if (this.onError) {
        this.onError(error, this.plies.length);
      } else {
        throw error;
      }
    };

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
    this.name = name || "";
    this.board = null;
    this.history = history ? history.concat() : [];
    this.historyIndex = historyIndex || 0;
    this.config = config ? { ...config } : {};
    this.tags = {};
    this.editingTPS = editingTPS;
    this.defaultSize = defaultSize || 6;
    this.moves = [];
    this.boardStates = {};
    this.branches = {};
    this.plies = [];
    this.chatlog = {};
    this.notes = {};
    this.warnings = [];

    //#region Parse HEAD

    try {
      // Parse tags from PTN
      if (ptn) {
        let item, key;

        ptn = ptn.trimStart();
        while (ptn.length && ptn[0] === "[") {
          // Tag
          try {
            item = Tag.parse(ptn);
            key = item.key.toLowerCase();
            if (item.value) {
              this.tags[key] = item;
            }
            ptn = ptn.substring(item.ptn.length).trimStart();
            delete item.ptn;
          } catch (error) {
            console.warn(error);
            this.warnings.push(error);
            let match = ptn.match(/]\s*/);
            if (match) {
              ptn = ptn.substring(match.index + 1).trimStart();
            } else {
              ptn = "";
            }
          }
        }
      }

      // Parse tags from JSON
      if (tags) {
        each(tags, (value, key) => {
          if (value) {
            if (value instanceof Tag) {
              this.tags[key.toLowerCase()] = value;
            } else {
              if (isString(value)) {
                value = value.replaceAll('"', "''");
              }
              try {
                const tag = Tag.parse(`[${key} "${value}"]`);
                this.tags[key.toLowerCase()] = tag;
              } catch (error) {
                console.warn(error);
                this.warnings.push(error);
              }
            }
          }
        });
      }

      // Parse datetime
      if (this.tags.date) {
        this.datetime = Tag.toDate(
          this.tags.date.value,
          this.tags.time ? this.tags.time.value : ""
        );
      } else {
        this.datetime = new Date();
      }

      // Get size
      if (this.tags.size) {
        this.size = this.tags.size.value;
      } else {
        if (this.tags.tps) {
          // Derive from TPS
          this.size = this.tags.tps.value.size;
          this.tags.size = Tag.parse(`[Size "${this.size}"]`);
        } else {
          let error = "Missing board size";
          if (ptn) {
            // Fail if initializing from PTN
            throw new Error(error);
          } else {
            // Use default size otherwise
            console.warn(error);
            this.warnings.push(error);
            this.size = this.defaultSize;
            this.tags.size = Tag.parse(`[Size "${this.size}"]`);
          }
        }
      }

      // Sanitize opening
      if (!this.tags.opening) {
        this.tags.opening = Tag.parse('[Opening "swap"]');
      }

      // Parse TPS
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
      this.defaultPieceCounts = {
        1: cloneDeep(pieceCounts[this.size]),
        2: cloneDeep(pieceCounts[this.size]),
      };
      if (config && config.pieceCounts) {
        this.pieceCounts = config.pieceCounts;
      } else {
        this.pieceCounts = cloneDeep(this.defaultPieceCounts);
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
      }
      Object.freeze(this.pieceCounts);
      this.updateConfig();
      this.board = new Board(this, null, this.board ? this.board.output : null);

      //#region Parse BODY

      if (ptn) {
        // Parse moves from PTN
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

        while (ptn.length) {
          if (Comment.test(ptn)) {
            // Comment
            item = Comment.parse(ptn);
            if (
              isDoubleBreak &&
              this.plies.length &&
              Linenum.test(ptn.trimStart().substring(item.ptn.length))
            ) {
              // Branch identifier
              branch = item.contents;
            } else {
              // Comment
              const plyID = this.plies.length - 1;
              const type = item.player === null ? "notes" : "chatlog";
              if (!this[type][plyID]) {
                this[type][plyID] = [];
              }
              this[type][plyID].push(item);
              this.board.dirtyComment(type, plyID);
            }
          } else if (Linenum.test(ptn)) {
            // Line number
            item = Linenum.parse(ptn, this, branch);
            if (!move.linenum) {
              move.linenum = item;
              if (move.index === 0 && item.number !== this.firstMoveNumber) {
                if (item.ptn.trim() === ptn.trim()) {
                  // Nothing but the first move's number, so overwrite
                  Linenum.parse(this.firstMoveNumber + ".", this, branch);
                } else {
                  throw new Error("Invalid first line number");
                }
              }
              this.board.dirtyMove(move.id);
            } else if (
              move.linenum.number === item.number &&
              move.linenum.branch === item.branch
            ) {
              // Ignore
            } else {
              move = new Move({
                game: this,
                id: this.moves.length,
                linenum: item,
              });
              this.moves[move.id] = move;
              this.board.dirtyMove(move.id);
            }
            branch = item.branch;
            moveNumber = item.number;
            ply = null;
          } else if (Result.test(ptn)) {
            // Result
            item = Result.parse(ptn);
            if (ply) {
              ply.result = item;
            }
          } else if (Nop.test(ptn)) {
            // Placeholder
            item = Nop.parse(ptn);
            if (this.plies.length === 0) {
              this.firstPlayer = 2;
            }
            if (!move.ply1) {
              move.ply1 = item;
            } else if (!move.ply2 && !move.ply1.result) {
              move.ply2 = item;
            }
          } else if (Ply.test(ptn)) {
            // Ply
            item = ply = Ply.parse(ptn, { id: this.plies.length });
            if (
              (!move.number || move.number === this.firstMoveNumber) &&
              this.firstPlayer === 2 &&
              !move.ply1
            ) {
              // Insert placeholder if necessary
              move.ply1 = Nop.parse("--");
            }
            const isSwap =
              this.openingSwap &&
              (move.number === 1 ||
                (!move.number && this.firstMoveNumber === 1));
            if (!move.ply1) {
              // Player 1 ply
              if (isSwap && ply.specialPiece) {
                throw new Error("Invalid first move");
              }
              if (!move.linenum) {
                move.linenum = Linenum.parse(moveNumber + ". ", this, branch);
              }
              ply.player = 1;
              ply.color = isSwap ? 2 : 1;
              move.ply1 = ply;
            } else if (!move.ply2) {
              // Player 2 ply
              if (isSwap && ply.specialPiece) {
                throw new Error("Invalid first move");
              }
              ply.player = 2;
              ply.color = isSwap ? 1 : 2;
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
              this.board.dirtyMove(move.id);
            }
            this.plies.push(ply);
            this.board.dirtyPly(ply.id);
            if (!(ply.branch in this.branches)) {
              this.branches[ply.branch] = ply;
            }
          } else if (Evaluation.test(ptn[0])) {
            // Evalutaion
            item = Evaluation.parse(ptn);
            if (ply) {
              ply.evaluation = item;
            }
          } else if (/[^\s]/.test(ptn)) {
            throw new Error("Invalid PTN format");
          } else {
            break;
          }

          ptn = ptn.trimStart().substring(item.ptn.length);
          isDoubleBreak = startsWithDoubleBreak.test(ptn);
          delete item.ptn;
        }
      } else if (branches) {
        // Parse from JSON
        if (notes) {
          this.jsonNotes = notes;
        }
        this.jsonBranches = branches;
      }
    } catch (error) {
      return handleError(error);
    }

    //#region Init Game

    if (!this.moves[0]) {
      this.moves[0] = new Move({
        game: this,
        id: 0,
        index: 0,
      });
      this.board.dirtyMove(0);
    }
    if (!this.moves[0].linenum) {
      this.moves[0].linenum = Linenum.parse(this.firstMoveNumber + ". ", this);
      this.moves[0].plies.forEach((ply) => (ply.linenum = ply.move.linenum));
      this.board.dirtyMove(0);
    }

    this._updatePTN();

    if (!this.name) {
      this.name = this.generateName();
    }

    // Init TPS
    if (this.tags.tps || this.editingTPS) {
      this.board.doTPS(this.editingTPS);
    }

    this.board.updateOutput();
    this.saveBoardState();

    // Validate and generate TPS for each ply, set initial position
    try {
      if (this.board.plies.length) {
        // Go to end of main branch
        this.board.plyID = 0;
        this.board.last();
        if (this.board.checkGameEnd()) {
          let ply = this.board.ply;
          if (ply) {
            if (!this.tag("result")) {
              // Add Result tag if missing
              this.setTags({ result: ply.result.text }, false, true);
            }
            this.board.setRoads(ply.result.roads || null);
          }
        }
        // Navigate through every branch
        for (let branch in this.branches) {
          if (branch) {
            this.board.goToPly(this.branches[branch].id, true);
            this.board.last();
          }
        }
      }
      if (
        state &&
        isObject(state) &&
        "plyIndex" in state &&
        (!state.targetBranch || state.targetBranch in this.branches)
      ) {
        // Go to specified position
        let ply = this.plies.find(
          (ply) =>
            ply.index === state.plyIndex &&
            ply.isInBranch(state.targetBranch || "")
        );
        if (ply) {
          this.board.goToPly(ply.id, state.plyIsDone || false);
          this.board.targetBranch = state.targetBranch || "";
        } else {
          // Go back to root branch
          this.board.targetBranch = "";
          this.board.goToPly(0, true);
          this.board.last();
        }
      } else if (this.board.targetBranch) {
        // Go back to root branch
        this.board.targetBranch = "";
        this.board.goToPly(0, true);
        this.board.last();
      }
    } catch (error) {
      console.error("PTN validation failed:", error);
    }

    if (this.onInit) {
      this.onInit(this);
    }
  }

  //#region Methods

  get minState() {
    return this.board.minState;
  }

  get openingSwap() {
    return this.tag("opening") === "swap";
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
      ply.branches.slice(1).sort(this.plySort).forEach(pushBranch);
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

  generateName(tags) {
    return generateName(tags || this.tagOutput);
  }

  get isDefaultName() {
    return isDefaultName(this.name);
  }

  setName(name) {
    this.name = name || this.generateName();
  }

  tag(key, rawValue = false) {
    if (key in this.tags && this.tags[key].value) {
      return rawValue ? this.tags[key].value : this.tags[key].valueText;
    }
  }

  get tagOutput() {
    return zipObject(
      Object.keys(this.tags),
      Object.values(this.tags).map((tag) => tag.output)
    );
  }

  get hasEnded() {
    return this.plies.findIndex((ply) => !ply.branch && ply.result) >= 0;
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
    if (this.hasTPS) {
      this.moves[0].linenum.number = Number(this.tags.tps.value.linenum);
    }
    this.updateConfig();
    if (updatePTN) {
      this._updatePTN(recordChange);
      if (
        [
          "opening",
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
        this.init({ ...this.params, state: null });
      } else {
        this.board.updateTagsOutput();
      }
    }
  }

  setEditingTPS(tps) {
    this.editingTPS = tps;
    if (tps === undefined) {
      this.board.doTPS();
    } else {
      this.board.setRoads(this.board.findRoads());
    }
    this.board.updateBoardOutput();
  }

  updateConfig() {
    const requireBoardUpdate = ["size", "komi"];
    const old = pick(this.config, requireBoardUpdate);
    const config = {
      size: this.tag("size", true),
      komi: this.tag("komi", true) || 0,
      opening: this.tag("opening"),
      openingSwap: this.openingSwap,
      pieceCounts: this.pieceCounts,
      isOnline: false,
      hasCustomPieceCount: !(
        this.defaultPieceCounts[1].flat === this.pieceCounts[1].flat &&
        this.defaultPieceCounts[1].cap === this.pieceCounts[1].cap &&
        this.defaultPieceCounts[2].flat === this.pieceCounts[2].flat &&
        this.defaultPieceCounts[2].cap === this.pieceCounts[2].cap
      ),
    };
    Object.assign(this.config, config);
    if (this.board && !isEqual(old, pick(this.config, requireBoardUpdate))) {
      this.board.updateBoardOutput();
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
      this.recordChange(() => (this.ptn = this.toString({ skipCache: true })));
    } else {
      this.ptn = this.toString({ skipCache: true });
    }
  }

  updatePTN(ptn, recordChange = true) {
    const update = () => this.init({ ...this.params, ptn });
    if (recordChange) {
      this.recordChange(update);
    } else {
      update();
    }
  }

  //#region Output

  toString(options) {
    options = Object.assign(
      {
        tags: undefined,
        showAllBranches: true,
        showComments: true,
        skipCache: false,
        transform: null,
      },
      options
    );
    return (
      this.headerText(options.tags, options.transform) +
      this.moveText(
        options.showAllBranches,
        options.showComments,
        options.skipCache,
        options.transform
      )
    );
  }

  headerText(tags = this.tags, transform = null) {
    if (transform && tags.tps) {
      tags = {
        ...tags,
        tps: new Tag(null, "tps", tags.tps.value.transform(transform)),
      };
    }
    return map(tags, (tag) => tag.toString()).join("\r\n") + "\r\n\r\n";
  }

  moveText(
    showAllBranches = false,
    showComments = false,
    skipCache = false,
    transform = null
  ) {
    const printMove = (move) =>
      move.toString(
        showComments ? this.getMoveComments(move) : null,
        showAllBranches,
        transform
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
        (skipCache ? this.getMovesGrouped() : this.movesGrouped)
          .map((moves) => moves.map(printMove).join("\r\n"))
          .join("\r\n\r\n")
      );
    } else {
      return prefix + this.board.moves.map(printMove).join("\r\n");
    }
  }
}
