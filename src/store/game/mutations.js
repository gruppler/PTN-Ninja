import Vue from "vue";
import { cloneDeep } from "lodash";
import { postMessage } from "../../utilities";
import Game from "../../Game";

export const SET_ERROR = (state, error) => {
  state.error = error;
};

export const SET_GAME = (state, game) => {
  const handleError = (error, plyID) => {
    state.error = error.message || error;
    console.warn("Encountered an error at plyID:", plyID);
    console.warn("Last stable position:", Object.freeze({ ...state.position }));
    console.error(error);
  };

  state.error = null;
  const editingTPS = game.editingTPS;
  if (!(game instanceof Game)) {
    game = new Game({
      ...game,
      onInit: (game) => {
        SET_GAME(state, game);
      },
      onError: (error, plyID) => {
        handleError(error, plyID);
      },
    });
  } else {
    game.board.updateOutput();
    if (!game.onInit) {
      game.onInit = (game) => {
        SET_GAME(state, game);
      };
      game.onError = (error, plyID) => {
        handleError(error, plyID);
      };
    }
  }
  Vue.prototype.$game = game;
  state.board = game.board.output.board;
  state.comments = game.board.output.comments;
  state.config = game.config;
  state.history = game.history;
  state.historyIndex = game.historyIndex;
  state.position = game.board.output.position;
  state.ptn = game.board.output.ptn;
  state.selected = game.board.output.selected;
  state.editingTPS = editingTPS;
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

export const SAVE_UNDO_HISTORY = (state) => {
  const game = Vue.prototype.$game;
  if (game && state.list[0]) {
    state.list[0].history = game.history.concat();
  }
};

export const SAVE_UNDO_INDEX = (state) => {
  const game = Vue.prototype.$game;
  if (game && state.list[0]) {
    Vue.set(state.list[0], "historyIndex", game.historyIndex);
  }
};

export const SAVE_PTN = (state, ptn) => {
  state.list[0].ptn = ptn;
};

export const SET_NAME = (state, { oldName, newName }) => {
  let stateGame = state.list.find((g) => g.name === oldName);
  if (stateGame) {
    stateGame.name = newName;
  } else {
    throw new Error("Game not found: " + oldName);
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
  game.config = { ...config };
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
};

export const HIGHLIGHT_SQUARES = (state, squares) => {
  if (squares && squares.length) {
    state.hlSquares = squares;
  } else {
    state.hlSquares = [];
  }
  postMessage("HIGHLIGHT_SQUARES", squares);
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

export const INSERT_PLY = (state, ply) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.insertPly(ply, false, false);
    postMessage("INSERT_PLY", ply);
  }
};

export const INSERT_PLIES = (state, plies) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.insertPlies(plies);
    postMessage("INSERT_PLIES", plies);
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
  if (game && !state.isEditingTPS) {
    game.undo();
    postMessage("UNDO");
  }
};

export const REDO = (state) => {
  const game = Vue.prototype.$game;
  if (game && !state.isEditingTPS) {
    game.redo();
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

export const RESET_TPS = function (state) {
  state.list[0].editingTPS = undefined;
  state.editingTPS = undefined;
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

export const ADD_NOTE = (state, message) => {
  Vue.prototype.$game.addNote(message);
};

export const REMOVE_NOTE = (state, { plyID, index }) => {
  Vue.prototype.$game.removeNote(plyID, index);
};
