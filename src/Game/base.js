import Comment from "./PTN/Comment";
import Continuation from "./PTN/Continuation";
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

export const generateName = (tags = {}) => {
  const tag = (key) => (key in tags ? tags[key] : "") || "";
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
      /^\s*(\[\w+\s"[^"]*"\]\s*)+((\{[^}]*\})*[*/.\s\da-hCFRS!?"'><+-]+(\{[^}]*\})*)+/gm
    );
  }

  // #region Init
  init({
    ptn,
    name,
    state,
    config,
    tags,
    moves,
    comments,
    history,
    historyIndex,
    defaultSize,
    editingTPS,
    highlighterEnabled,
    highlighterSquares,
    ptnUI,
    onInit,
    onError,
    onAppendPly,
    onInsertPly,
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
    if (isFunction(onAppendPly)) {
      this.onAppendPly = onAppendPly;
    }
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
    this.highlighterEnabled = Boolean(highlighterEnabled);
    this.highlighterSquares = highlighterSquares || {};
    this.ptnUI = ptnUI || { branchPointOverrides: {} };
    this.defaultSize = defaultSize || 6;
    this.moves = [];
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
          } else if (Continuation.test(ptn)) {
            // Continuation placeholder (can have comments and branches)
            item = ply = Continuation.parse(ptn, { id: this.plies.length });
            if (!move.ply1) {
              if (!move.linenum) {
                move.linenum = Linenum.parse(moveNumber + ". ", this, branch);
              }
              ply.player = 1;
              // Color depends on swap opening - on move 1 with swap, player 1 uses color 2
              const isSwap = this.openingSwap && moveNumber === 1;
              ply.color = isSwap ? 2 : 1;
              move.ply1 = ply;
            } else if (!move.ply2) {
              ply.player = 2;
              // Color depends on swap opening - on move 1 with swap, player 2 uses color 1
              const isSwap = this.openingSwap && moveNumber === 1;
              ply.color = isSwap ? 1 : 2;
              move.ply2 = ply;
            }
            this.plies.push(ply);
            this.board.dirtyPly(ply.id);
            if (!(ply.branch in this.branches)) {
              this.branches[ply.branch] = ply;
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
      } else if (moves) {
        // Parse moves from JSON
        if (comments) {
          this.parseJSONComments(comments, -1);
        }
        this.parseJSONMoves(moves);
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

    // Auto-add continuations at the end of each branch
    this._addContinuations();

    if (this.onInit) {
      this.onInit(this);
    }
  }

  // Add continuation placeholders at the end of branches that don't have them
  _addContinuations() {
    // Don't add continuations if game has ended (result tag is set during init)
    if (this.tags.result) return;

    // First, collect comments from existing continuations (keyed by branch)
    const continuationComments = {};
    for (const ply of this.plies) {
      if (ply && ply.isContinuation) {
        const branch = ply.branch || "";
        if (this.notes[ply.id]) {
          continuationComments[branch] = {
            notes: this.notes[ply.id],
          };
        }
        if (this.chatlog[ply.id]) {
          continuationComments[branch] = continuationComments[branch] || {};
          continuationComments[branch].chatlog = this.chatlog[ply.id];
        }
      }
    }

    // Remove all existing continuations (they will be regenerated)
    for (let i = this.plies.length - 1; i >= 0; i--) {
      const ply = this.plies[i];
      if (ply && ply.isContinuation) {
        // Remove comments (will be restored on new continuation)
        delete this.notes[ply.id];
        delete this.chatlog[ply.id];
        // Remove from parent's children
        if (ply.parent && ply.parent.children) {
          const idx = ply.parent.children.indexOf(ply);
          if (idx >= 0) ply.parent.children.splice(idx, 1);
        }
        // Remove from move
        if (ply.move) {
          if (ply.move.ply1 === ply) ply.move.ply1 = null;
          if (ply.move.ply2 === ply) ply.move.ply2 = null;
        }
        this.plies[i] = null;
      }
    }

    // Remove continuation-only moves (but keep moves that have no plies yet)
    for (let i = this.moves.length - 1; i >= 0; i--) {
      const move = this.moves[i];
      // Only remove if the move has plies and all of them are continuations
      if (
        move.plies.length > 0 &&
        move.plies.every((p) => !p || p.isContinuation)
      ) {
        this.moves.splice(i, 1);
      }
    }

    const branchEnds = {};

    // Find the last non-continuation ply of each branch
    for (const ply of this.plies) {
      if (!ply || ply.isContinuation) continue;
      const branch = ply.branch || "";
      if (
        !branchEnds[branch] ||
        ply.index > branchEnds[branch].index ||
        (ply.index === branchEnds[branch].index &&
          ply.player > branchEnds[branch].player)
      ) {
        branchEnds[branch] = ply;
      }
    }

    // Add continuations where needed
    for (const branch in branchEnds) {
      const lastPly = branchEnds[branch];
      if (!lastPly || lastPly.isContinuation || lastPly.result) continue;

      // Determine next player and color
      let nextPlayer, nextColor;
      if (lastPly.player === 1 && !lastPly.move.ply2) {
        nextPlayer = 2;
      } else {
        nextPlayer = 1;
      }

      // Color depends on swap opening
      const nextMoveNumber =
        nextPlayer === 1 ? lastPly.move.number + 1 : lastPly.move.number;
      const isSwap = this.openingSwap && nextMoveNumber === 1;
      nextColor = isSwap ? (nextPlayer === 1 ? 2 : 1) : nextPlayer;

      const continuation = new Continuation({
        id: this.plies.length,
        player: nextPlayer,
        color: nextColor,
      });
      continuation.parent = lastPly;
      continuation.branch = branch;
      // Set tpsBefore so analysis results can be saved to continuation
      // (will be populated when board navigates to parent ply)
      continuation.tpsBefore = lastPly.tpsAfter || "";

      if (nextPlayer === 2 && !lastPly.move.ply2) {
        // Add as ply2 of the same move
        lastPly.move.ply2 = continuation;
      } else {
        // Add as ply1 of a new move
        const moveNumber = lastPly.move.number + 1;
        // Check if a move with this number and branch already exists
        let existingMove = this.moves.find(
          (m) => m.linenum.number === moveNumber && m.linenum.branch === branch
        );
        if (existingMove) {
          existingMove.ply1 = continuation;
        } else {
          const newMove = new Move({
            game: this,
            id: this.moves.length,
            linenum: new Linenum(moveNumber + ". ", this, branch),
          });
          newMove.ply1 = continuation;
          this.moves.push(newMove);
          this.board.dirtyMove(newMove.id);
        }
      }

      if (!lastPly.children.includes(continuation)) {
        lastPly.children.push(continuation);
      }
      this.plies.push(continuation);
      this.board.dirtyPly(continuation.id);

      // Restore comments from old continuation (if any)
      if (continuationComments[branch]) {
        if (continuationComments[branch].notes) {
          this.notes[continuation.id] = continuationComments[branch].notes;
        }
        if (continuationComments[branch].chatlog) {
          this.chatlog[continuation.id] = continuationComments[branch].chatlog;
        }
      }
    }
  }

  //#region Methods

  get minState() {
    return this.board.minState;
  }

  get openingSwap() {
    return this.tag("opening") !== "no-swap";
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

  // Get the root ply (first ply of main branch)
  get rootPly() {
    return this.plies.find((p) => p.index === 0 && p.branch === "") || null;
  }

  // Traverse tree and collect all plies in order (depth-first, main branch first)
  getPliesFromTree() {
    const result = [];
    const visited = new Set();

    const traverse = (ply) => {
      if (!ply || visited.has(ply)) return;
      visited.add(ply);
      result.push(ply);

      // Visit children: first child is main continuation, rest are branches
      ply.children.forEach((child) => traverse(child));
    };

    const root = this.rootPly;
    if (root) {
      traverse(root);
    }

    return result;
  }

  // Find a ply from a serializable path (from Ply.getSerializablePath())
  // Uses moveText to identify branch choices (stable across promotion)
  findPlyFromPath(path) {
    if (!path || !path.length) return null;

    const target = path[path.length - 1];
    const branchChoices = path.slice(0, -1);

    // Find all plies matching the target move number, player, and move text
    const candidates = this.plies.filter(
      (p) =>
        p.move.number === target.moveNumber &&
        p.player === target.player &&
        p.toString(true) === target.moveText
    );

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Multiple candidates - use branch choices to narrow down
    for (const candidate of candidates) {
      let matches = true;
      let current = candidate;

      // Walk up the tree and check branch choices by move text
      for (let i = branchChoices.length - 1; i >= 0 && matches; i--) {
        const choice = branchChoices[i];
        // Find the branch point for this choice
        while (current && current.parent) {
          if (
            current.branches.length > 1 &&
            current.move.number === choice.moveNumber &&
            current.player === choice.player
          ) {
            // Check if the move text matches
            if (current.toString(true) !== choice.moveText) {
              matches = false;
            }
            break;
          }
          current = current.parent;
        }
      }

      if (matches) return candidate;
    }

    // Fallback to first candidate
    return candidates[0];
  }

  // Debug method to verify parent relationships
  verifyParentRelationships() {
    const issues = [];
    this.plies.forEach((ply) => {
      if (ply.index === 0 && ply.branch === "") {
        // First ply of main branch should have no parent
        if (ply.parent !== null) {
          const parentId = ply.parent ? ply.parent.id : "null";
          issues.push(
            "Ply " + ply.id + ": First main ply has parent " + parentId
          );
        }
      } else if (ply.parent === null) {
        issues.push(
          "Ply " +
            ply.id +
            " (index " +
            ply.index +
            ', branch "' +
            ply.branch +
            '"): Missing parent'
        );
      }
    });
    if (issues.length) {
      console.warn("Parent relationship issues:", issues);
    } else {
      console.log("All parent relationships verified OK");
    }
    return issues;
  }

  // Debug method to verify children relationships (bidirectional with parent)
  verifyChildrenRelationships() {
    const issues = [];
    this.plies.forEach((ply) => {
      // Check that each child has this ply as parent
      ply.children.forEach((child, i) => {
        if (child.parent !== ply) {
          issues.push(
            "Ply " +
              ply.id +
              ": child[" +
              i +
              "] (id " +
              child.id +
              ") has wrong parent (id " +
              (child.parent ? child.parent.id : "null") +
              ")"
          );
        }
      });
      // Check that if we have a parent, we're in their children array
      if (ply.parent && !ply.parent.children.includes(ply)) {
        issues.push(
          "Ply " +
            ply.id +
            ": has parent " +
            ply.parent.id +
            " but not in parent's children"
        );
      }
    });
    if (issues.length) {
      console.warn("Children relationship issues:", issues);
    } else {
      console.log("All children relationships verified OK");
    }
    return issues;
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
    const requireBoardUpdate = ["size", "komi", "openingSwap"];
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
      this._updatePTN();
      this.init({ ...this.params, ptn: this.ptn });
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
    // Skip moves that only contain continuations (they are auto-generated)
    const isContinuationOnlyMove = (move) =>
      move.plies.every((p) => !p || p.isContinuation);

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
          .map((moves) =>
            moves
              .filter((m) => !isContinuationOnlyMove(m))
              .map(printMove)
              .join("\r\n")
          )
          .filter((group) => group) // Remove empty groups
          .join("\r\n\r\n")
      );
    } else {
      return (
        prefix +
        this.board.moves
          .filter((m) => !isContinuationOnlyMove(m))
          .map(printMove)
          .join("\r\n")
      );
    }
  }
}
