import { cloneDeep } from "lodash";

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

export const UPDATE_PTN = (state, ptn) => {
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

export const SET_STATE = (state, { game, gameState }) => {
  let stateGame = state.list.find((g) => g.name === game.name);
  if (stateGame) {
    stateGame.state = cloneDeep(gameState);
  } else {
    throw new Error("Game not found: " + game.name);
  }
};

export const SET_CONFIG = (state, { game, config }) => {
  game.config = { ...config };
  let stateGame = state.list.find((g) => g.name === game.name);
  if (stateGame) {
    stateGame.config = { ...config };
  } else {
    throw new Error("Game not found: " + game.name);
  }
};

export const SELECT_GAME = (state, index) => {
  state.list.unshift(state.list.splice(index, 1)[0]);
};

export const CANCEL_MOVE = (state, game) => {
  game.cancelMove();
};

export const UNDO = (state, game) => {
  if (!state.isEditingTPS) {
    game.undo();
  }
};

export const REDO = (state, game) => {
  if (!state.isEditingTPS) {
    game.redo();
  }
};

export const TRIM_BRANCHES = (state, game) => {
  game.trimBranches();
};

export const TRIM_TO_BOARD = (state, game) => {
  game.trimToBoard();
};

export const TRIM_TO_PLY = (state, game) => {
  game.trimToPly();
};

export const SAVE_UNDO_HISTORY = (state, game) => {
  state.list[0].history = game.history.concat();
};

export const SAVE_UNDO_INDEX = (state, game) => {
  state.list[0].historyIndex = game.historyIndex;
};
