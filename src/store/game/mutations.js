import Vue from "vue";
import { i18n } from "../../boot/i18n";
import { cloneDeep } from "lodash";
import Game from "../../Game";

export const SET_GAME = (state, game) => {
  if (!(game instanceof Game)) {
    game = new Game({
      ...game,
      onInit: (game) => {
        SET_GAME(state, game);
      },
    });
  } else {
    game.board.updateOutput();
    if (!game.onInit) {
      game.onInit = (game) => {
        SET_GAME(state, game);
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
};

export const ADD_GAME = (state, game) => {
  state.list.unshift({
    ptn: game.ptn,
    name: game.name,
    state: game.minState || game.state,
    config: game.config,
    history: game.history,
    historyIndex: game.historyIndex,
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
};

export const SAVE_CURRENT_GAME = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
    state.ptn = game.board.output.ptn;
    state.history = game.history;
    state.historyIndex = game.historyIndex;

    state.list[0].ptn = game.ptn;
    state.list[0].state = cloneDeep(game.minState);
    state.list[0].history = game.history.concat();
    state.list[0].historyIndex = game.historyIndex;
  }
};

export const SAVE_CURRENT_GAME_STATE = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
    Vue.set(state.list[0], "state", cloneDeep(game.minState));
  }
};

export const SAVE_UNDO_HISTORY = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
    state.list[0].history = game.history.concat();
  }
};

export const SAVE_UNDO_INDEX = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
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

export const SELECT_GAME = (state, index) => {
  state.list.unshift(state.list.splice(index, 1)[0]);
};

export const SELECT_SQUARE = (
  state,
  { square, alt, isEditingTPS, selectedPiece }
) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.board.selectSquare(square, alt, isEditingTPS, selectedPiece);
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
  }
};

export const DELETE_BRANCH = (state, branch) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.deleteBranch(branch, true);
  }
};

export const UNDO = (state) => {
  const game = Vue.prototype.$game;
  if (game && !state.isEditingTPS) {
    game.undo();
  }
};

export const REDO = (state) => {
  const game = Vue.prototype.$game;
  if (game && !state.isEditingTPS) {
    game.redo();
  }
};

export const TRIM_BRANCHES = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.trimBranches();
  }
};

export const TRIM_TO_BOARD = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.trimToBoard();
  }
};

export const TRIM_TO_PLY = (state) => {
  const game = Vue.prototype.$game;
  if (game) {
    game.trimToPly();
  }
};

export const FIRST = function (state) {
  Vue.prototype.$game.board.first();
};

export const LAST = function (state) {
  Vue.prototype.$game.board.last();
};

export const PREV = function (state, half) {
  Vue.prototype.$game.board.prev(half);
};

export const NEXT = function (state, half) {
  Vue.prototype.$game.board.next(half);
};

export const SET_TARGET = function (state, ply) {
  return Vue.prototype.$game.board.setTarget(ply);
};

export const GO_TO_PLY = function (state, { ply, isDone }) {
  Vue.prototype.$game.board.goToPly(ply, isDone);
};

export const DO_TPS = function (state, tps) {
  Vue.prototype.$game.board.doTPS(tps);
};

export const SAVE_TPS = function (state, tps) {
  Vue.prototype.$game.setTags({ tps });
};

export const RESET_TPS = function (state) {
  Vue.prototype.$game.board.doTPS();
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
