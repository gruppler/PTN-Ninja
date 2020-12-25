import { Dark } from "quasar";
import {
  cloneDeep,
  forEach,
  isBoolean,
  isFunction,
  isNumber,
  isObject,
} from "lodash";
import { computeMissing } from "../../themes";

export const SET_THEME = (state, theme) => {
  theme = cloneDeep(theme);
  computeMissing(theme);

  state.theme = cloneDeep(theme);
  Dark.set(theme.isDark);
  forEach(theme.colors, (color, key) => {
    document.body.style.setProperty("--q-color-" + key, color);
  });
  forEach(theme.vars, (value, key) => {
    if (isNumber(value)) {
      value += "px";
    }
    document.body.style.setProperty("--" + key, value);
  });
  forEach(theme, (value, key) => {
    if (isBoolean(value)) {
      document.body.classList[value ? "add" : "remove"](key);
    }
  });
};

export const SET_UI = (state, [key, value]) => {
  if (key in state.defaults) {
    state[key] = cloneDeep(value);
  }
};

export const SET_EMBED_GAME = (state) => {
  state.embed = true;
};

export const ADD_GAME = (state, game) => {
  state.games.unshift(game);
};

export const ADD_GAMES = (state, { games, index }) => {
  state.games.splice(index, 0, ...games);
};

export const REMOVE_GAME = (state, index) => {
  state.games.splice(index, 1);
};

export const REMOVE_MULTIPLE_GAMES = (state, { start, count }) => {
  state.games.splice(start, count);
};

export const UPDATE_PTN = (state, ptn) => {
  state.games[0].ptn = ptn;
};

export const SET_NAME = (state, { oldName, newName }) => {
  let stateGame = state.games.find((g) => g.name === oldName);
  if (stateGame) {
    stateGame.name = newName;
  } else {
    throw new Error("Game not found: " + oldName);
  }
};

export const SET_STATE = (state, { game, gameState }) => {
  let stateGame = state.games.find((g) => g.name === game.name);
  if (stateGame) {
    stateGame.state = cloneDeep(gameState);
  } else {
    throw new Error("Game not found: " + game.name);
  }
};

export const SET_CONFIG = (state, { game, config }) => {
  game.config = { ...config };
  let stateGame = state.games.find((g) => g.name === game.name);
  if (stateGame) {
    stateGame.config = { ...config };
  } else {
    throw new Error("Game not found: " + game.name);
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
