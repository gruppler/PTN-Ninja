import { i18n } from "../../boot/i18n";
import { cloneDeep } from "lodash";
import Game from "../../PTN/Game";

export const SET_GAME = (state, game) => {
  if (!(game instanceof Game)) {
    game = new Game(game.ptn, game);
  }
  state.current = game;
};

export const ADD_GAME = (state, game) => {
  state.list.unshift(game);
};

export const ADD_GAMES = (state, { games, index }) => {
  state.list.splice(index, 0, ...games);
};

export const REMOVE_GAME = (state, index) => {
  state.list.splice(index, 1);
};

export const REMOVE_MULTIPLE_GAMES = (state, { start, count }) => {
  state.list.splice(start, count);
};

export const RENAME_CURRENT_GAME = (state, name) => {
  state.current.setName(name);
};

export const SET_CURRENT_PTN = (state, ptn) => {
  state.current.updatePTN(ptn);
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
  return state.current.setTags(tags);
};

export const SELECT_GAME = (state, index) => {
  state.list.unshift(state.list.splice(index, 1)[0]);
};

export const SELECT_SQUARE = (
  state,
  { square, alt, isEditingTPS, selectedPiece }
) => {
  const game = state.current;
  if (game) {
    game.selectSquare(square, alt, isEditingTPS, selectedPiece);
  }
};

export const SELECT_PIECE = (state, { type, alt }) => {
  const game = state.current;
  if (game) {
    game.selectUnplayedPiece(type, alt);
  }
};

export const CANCEL_MOVE = (state) => {
  const game = state.current;
  if (game) {
    game.cancelMove();
  }
};

export const UNDO = (state) => {
  const game = state.current;
  if (game && !state.isEditingTPS) {
    game.undo();
  }
};

export const REDO = (state) => {
  const game = state.current;
  if (game && !state.isEditingTPS) {
    game.redo();
  }
};

export const TRIM_BRANCHES = (state) => {
  const game = state.current;
  if (game) {
    game.trimBranches();
  }
};

export const TRIM_TO_BOARD = (state) => {
  const game = state.current;
  if (game) {
    game.trimToBoard();
  }
};

export const TRIM_TO_PLY = (state) => {
  const game = state.current;
  if (game) {
    game.trimToPly();
  }
};

export const SAVE_UNDO_HISTORY = (state) => {
  const game = state.current;
  if (game) {
    state.list[0].history = game.history.concat();
  }
};

export const SAVE_UNDO_INDEX = (state) => {
  const game = state.current;
  if (game) {
    state.list[0].historyIndex = game.historyIndex;
  }
};

export const FIRST = function (state) {
  return state.current.first();
};

export const LAST = function (state) {
  return state.current.last();
};

export const PREV = function (state, half) {
  return state.current.prev(half);
};

export const NEXT = function (state, half) {
  return state.current.next(half);
};

export const SET_TARGET = function (state, ply) {
  return state.current.setTarget(ply);
};

export const GO_TO_PLY = function (state, { ply, isDone }) {
  return state.current.goToPly(ply, isDone);
};

export const DO_TPS = function (state, tps) {
  return state.current.doTPS(tps);
};

export const SAVE_TPS = function (state, tps) {
  state.current.moves[0].linenum.number = Number(tps.split(/\s/)[2]);
  state.current.setTags({ tps });
};

export const RESET_TPS = function (state) {
  state.current.doTPS();
};

export const RENAME_BRANCH = (state, { oldName, newName }) => {
  state.current.renameBranch(oldName, newName);
};
