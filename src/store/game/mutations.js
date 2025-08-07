import Vue from "vue";
import { cloneDeep } from "lodash";
import { postMessage } from "../../utilities";
import Game from "../../Game";
import Linenum from "../../Game/PTN/Linenum";
import Nop from "../../Game/PTN/Nop";

export const SET_ERROR = (state, error) => {
  state.error = error;
};

export const INIT = (state, games) => {
  state.list = games;
  state.init = true;
};

export const SET_GAME = function (state, game) {
  const handleError = (error, plyID) => {
    state.error = error.message || error;
    console.warn("Encountered an error at plyID:", plyID);
    console.warn("Last stable position:", Object.freeze({ ...state.position }));
    console.error(error);
  };

  const onInit = (game) => {
    this.commit("game/SET_GAME", game);
  };

  const handleGameEnd = (game) => {
    if (game.board.isAtEndOfMainBranch && game.board.isGameEnd) {
      const url = this.getters["ui/url"](game, {
        name: game.name,
        origin: true,
        state: true,
      });

      postMessage("GAME_END", {
        url,
        result: game.board.ply.result.minimalOutput,
      });
    }
  };

  const onAppendPly = (game, ply) => {
    postMessage("APPEND_PLY", ply);
    handleGameEnd(game);
  };

  const onInsertPly = (game, ply) => {
    postMessage("INSERT_PLY", ply);
    handleGameEnd(game);
  };

  const onError = (error, plyID) => {
    handleError(error, plyID);
  };

  state.error = null;
  if (!(game instanceof Game)) {
    game = new Game({
      ...game,
      onInit,
      onAppendPly,
      onInsertPly,
      onError,
    });
  } else {
    game.board.updateOutput();
    if (!game.onInit) {
      game.onInit = onInit;
      game.onAppendPly = onAppendPly;
      game.onInsertPly = onInsertPly;
      game.onError = onError;
    }
  }
  Vue.prototype.$game = game;
  state.name = game.name;
  state.board = game.board.output.board;
  state.comments = game.board.output.comments;
  state.config = game.config;
  state.history = game.history;
  state.historyIndex = game.historyIndex;
  state.position = game.board.output.position;
  state.ptn = game.board.output.ptn;
  state.selected = game.board.output.selected;
  state.editingTPS = game.editingTPS;
  state.highlighterEnabled = game.highlighterEnabled || false;
  state.highlighterSquares = game.highlighterSquares;
};

export const ADD_GAME = (state, game) => {
  state.list.unshift({
    ptn: game.ptn,
    name: game.name,
    state: game.minState || game.state,
    config: game.config,
    history: game.history,
    historyIndex: game.historyIndex,
    editingTPS: game.editingTPS,
    highlighterEnabled: game.highlighterEnabled,
    highlighterSquares: game.highlighterSquares,
  });
};

export const ADD_GAMES = (state, { games, index }) => {
  state.list.splice(
    index,
    0,
    ...games.map((game) => ({
      ptn: game.ptn,
      name: game.name,
      state: game.minState || game.state,
      config: game.config,
      history: game.history,
      historyIndex: game.historyIndex,
      editingTPS: game.editingTPS,
      highlighterEnabled: game.highlighterEnabled,
      highlighterSquares: game.highlighterSquares,
    }))
  );
};

export const REMOVE_GAME = (state, index) => {
  state.list.splice(index, 1);
};

export const REMOVE_MULTIPLE_GAMES = (state, { start, count }) => {
  state.list.splice(start, count);
};

export const RENAME_CURRENT_GAME = (state, name) => {
  Vue.prototype.$game.setName(name);
};

export const SET_CURRENT_PTN = (state, ptn) => {
  Vue.prototype.$game.updatePTN(ptn);
  postMessage("SET_CURRENT_PTN", ptn);
};

export const SAVE_CURRENT_GAME = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
    state.ptn = game.board.output.ptn;
    state.history = game.history;
    state.historyIndex = game.historyIndex;

    if (state.list.length) {
      state.list[0].ptn = game.ptn;
      state.list[0].state = cloneDeep(game.minState);
      state.list[0].history = game.history.concat();
      state.list[0].historyIndex = game.historyIndex;
    }
  }
};

export const SAVE_CURRENT_GAME_STATE = (state) => {
  const game = Vue.prototype.$game;
  if (game && state.list[0]) {
    Vue.set(state.list[0], "state", cloneDeep(game.minState));
  }
};

export const SET_NAME = function (state, { oldName, newName }) {
  if (this.state.ui.embed) {
    Vue.prototype.$game.name = newName;
  } else {
    let stateGame = state.list.find((g) => g.name === oldName);
    if (stateGame) {
      stateGame.name = newName;
    } else {
      throw new Error("Game not found: " + oldName);
    }
  }
};

export const SAVE_STATE = (state, { game, gameState }) => {
  let stateGame = state.list.find((g) => g.name === game.name);
  if (stateGame) {
    stateGame.state = cloneDeep(gameState);
  } else {
    throw new Error("Game not found: " + game.name);
  }
};

export const SAVE_CONFIG = (state, { game, config }) => {
  let stateGame = state.list.find((g) => g.name === game.name);
  if (stateGame) {
    stateGame.config = { ...config };
  } else {
    throw new Error("Game not found: " + game.name);
  }
};

export const SET_TAGS = (state, tags) => {
  Vue.prototype.$game.setTags(tags);
};

export const APPLY_TRANSFORM = (state, transform) => {
  const game = Vue.prototype.$game;
  if (game) {
    let result = game.transform(transform);
    postMessage("APPLY_TRANSFORM", { transform, result });
  }
};

export const SELECT_GAME = (state, index) => {
  state.list.unshift(state.list.splice(index, 1)[0]);
  state.list[0].lastSeen = new Date();
};

export const SET_HIGHLIGHTER_ENABLED = (state, enabled) => {
  state.highlighterEnabled = Boolean(enabled);
  state.list[0].highlighterEnabled = state.highlighterEnabled;
  const game = Vue.prototype.$game;
  if (game) {
    game.highlighterEnabled = state.highlighterEnabled;
  }
};

export const SET_HIGHLIGHTER_SQUARES = (state, squares) => {
  state.highlighterSquares = squares || {};
  state.list[0].highlighterSquares = state.highlighterSquares;
  const game = Vue.prototype.$game;
  if (game) {
    game.highlighterSquares = state.highlighterSquares;
  }
};

export const HIGHLIGHT_SQUARES = (state, squares) => {
  if (squares && squares.length) {
    state.hlSquares = squares;
  } else {
    state.hlSquares = [];
  }
  postMessage("HIGHLIGHT_SQUARES", squares);
};

export const HOVER_SQUARE = (state, square) => {
  state.hoveredSquare = square;
};

export const SET_EVAL = (state, evaluation) => {
  state.evaluation = evaluation;
};

export const SET_ANALYSIS = (state, analysis) => {
  if (analysis) {
    Vue.set(
      state.analyzedPositions,
      analysis.tps || state.position.tps,
      Object.freeze(analysis)
    );
  }
};

export const SELECT_SQUARE = (state, { square, alt, selectedPiece }) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.board.selectSquare(
      square,
      alt,
      state.editingTPS !== undefined,
      selectedPiece
    );
  }
};

export const SELECT_DROP_PIECES = (state, { square, count }) => {
  const game = Vue.prototype.$game;
  if (game && state.editingTPS === undefined) {
    game.board.selectSquare(square, false, false, false, count);
  }
};

export const SELECT_PIECE = (state, { type, alt }) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.board.selectUnplayedPiece(type, alt);
  }
};

export const CANCEL_MOVE = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.board.cancelMove();
  }
};

export const DELETE_PLY = (state, plyID) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.deletePly(plyID, true, true);
    postMessage("DELETE_PLY", plyID);
  }
};

export const APPEND_PLY = (state, ply) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.appendPly(ply);
  }
};

export const INSERT_PLY = (state, ply) => {
  const game = Vue.prototype.$game;
  if (game) {
    if (state.selected.moveset.length) {
      game.board.cancelMove();
    }
    game.insertPly(ply, false, false);
  }
};

export const INSERT_PLIES = (state, { plies, prev }) => {
  const game = Vue.prototype.$game;
  if (game) {
    if (Linenum.test(plies[0])) {
      // Move to specified line
      const linenum = new Linenum(plies.shift());
      let player = 1;
      if (Nop.test(plies[0])) {
        player = 2;
        plies.shift();
      }
      const plyID = game.plies.findIndex(
        (ply) => ply.linenum.number === linenum.number && ply.player === player
      );
      if (plyID >= 0) {
        game.board.goToPly(plyID);
        prev = plies.length - 2;
      } else {
        throw "Invalid line number";
      }
    }
    if (state.selected.moveset.length) {
      game.board.cancelMove();
    }
    plies = game.insertPlies(plies, prev);
    postMessage(
      "INSERT_PLIES",
      plies.map((ply) => ply.text),
      prev
    );
  }
};

export const DELETE_BRANCH = (state, branch) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.deleteBranch(branch, true);
    postMessage("DELETE_BRANCH", branch);
  }
};

export const UNDO = (state) => {
  const game = Vue.prototype.$game;
  if (game && !state.isEditingTPS && game.undo()) {
    postMessage("UNDO");
  }
};

export const REDO = (state) => {
  const game = Vue.prototype.$game;
  if (game && !state.isEditingTPS && game.redo()) {
    postMessage("REDO");
  }
};

export const TRIM_BRANCHES = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.trimBranches();
    postMessage("TRIM_BRANCHES");
  }
};

export const TRIM_TO_BOARD = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.trimToBoard();
    postMessage("TRIM_TO_BOARD");
  }
};

export const TRIM_TO_PLY = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.trimToPly();
    postMessage("TRIM_TO_PLY");
  }
};

export const FIRST = function (state) {
  state.error = null;
  postMessage("FIRST");
  return Vue.prototype.$game.board.first();
};

export const LAST = function (state) {
  state.error = null;
  postMessage("LAST");
  return Vue.prototype.$game.board.last();
};

export const PREV = function (state, { half, times }) {
  state.error = null;
  postMessage("PREV");
  return Vue.prototype.$game.board.prev(half, times);
};

export const NEXT = function (state, { half, times }) {
  state.error = null;
  let result = Vue.prototype.$game.board.next(half, times);
  postMessage("NEXT");
  return result;
};

export const SET_TARGET = function (state, ply) {
  state.error = null;
  return Vue.prototype.$game.board.setTarget(ply);
};

export const GO_TO_PLY = function (state, { plyID, isDone }) {
  state.error = null;
  postMessage("GO_TO_PLY", { plyID, isDone });
  return Vue.prototype.$game.board.goToPly(plyID, isDone);
};

export const EDIT_TPS = function (state, tps) {
  state.list[0].editingTPS = tps;
  state.editingTPS = tps;
  Vue.prototype.$game.setEditingTPS(tps);
};

export const SAVE_TPS = function (state, tps) {
  state.list[0].editingTPS = undefined;
  state.editingTPS = undefined;
  Vue.prototype.$game.setTags({ tps });
  Vue.prototype.$game.setEditingTPS();
};

export const PROMOTE_BRANCH = (state, branch) => {
  Vue.prototype.$game.promoteBranch(branch);
};

export const MAKE_BRANCH_MAIN = (state, branch) => {
  Vue.prototype.$game.makeBranchMain(branch, true);
};

export const RENAME_BRANCH = (state, { oldName, newName }) => {
  Vue.prototype.$game.renameBranch(oldName, newName);
};

export const TOGGLE_EVALUATION = (state, { type, double }) => {
  Vue.prototype.$game.toggleEvaluation(type, double);
};

export const EDIT_NOTE = (state, { plyID, index, message }) => {
  Vue.prototype.$game.editNote(plyID, index, message);
};

export const ADD_NOTE = (state, { message, plyID }) => {
  Vue.prototype.$game.addNote(message, plyID);
};

export const ADD_NOTES = (state, messages) => {
  Vue.prototype.$game.addNotes(messages);
};

export const REMOVE_NOTE = (state, { plyID, index }) => {
  Vue.prototype.$game.removeNote(plyID, index);
};

export const REMOVE_NOTES = () => {
  Vue.prototype.$game.removeNotes();
};

export const REMOVE_ANALYSIS_NOTES = () => {
  Vue.prototype.$game.removeNotes(
    (note) => note.output.evaluation !== null || note.output.pv !== null
  );
};
