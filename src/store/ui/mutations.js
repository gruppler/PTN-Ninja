import { cloneDeep } from "lodash";

export const SET_UI = (state, [key, value]) => {
  if (key in state.defaults) {
    state[key] = value;
  }
};

export const SET_EMBED_GAME = state => {
  state.embed = true;
};

export const ADD_GAME = (state, game) => {
  state.games.unshift(game);
};

export const REMOVE_GAME = (state, index) => {
  state.games.splice(index, 1);
};

export const UPDATE_PTN = (state, ptn) => {
  state.games[0].ptn = ptn;
};

export const SET_NAME = (state, name) => {
  state.games[0].name = name;
};

export const SET_STATE = (state, gameState) => {
  state.games[0].state = cloneDeep(gameState);
};

export const SET_CONFIG = (state, { game, config }) => {
  game.config = { ...config };
  game = state.games.find(g => g.name === game.name);
  if (game) {
    game.config = { ...config };
  } else {
    console.error("Game not found:", game.name);
  }
};

export const SELECT_GAME = (state, index) => {
  state.games.unshift(state.games.splice(index, 1)[0]);
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
  state.games[0].history = game.history.concat();
};

export const SAVE_UNDO_INDEX = (state, game) => {
  state.games[0].historyIndex = game.historyIndex;
};
