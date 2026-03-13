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
  const loadedPTNUI = game && game.ptnUI ? cloneDeep(game.ptnUI) : null;

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
        engineName: game.name,
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
      ptnUI: loadedPTNUI,
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
    // Ensure the Game object has the latest ptnUI
    if (loadedPTNUI) {
      game.ptnUI = loadedPTNUI;
    }
  }
  Vue.prototype.$game = game;
  state.name = game.name;
  state.board = game.board.output.board;
  state.comments = game.board.output.comments;
  state.config = {
    ...game.config,
    firstMoveNumber: game.firstMoveNumber,
    firstPlayer: game.firstPlayer,
  };
  state.history = game.history;
  state.historyIndex = game.historyIndex;
  state.position = game.board.output.position;
  state.ptn = game.board.output.ptn;
  state.selected = game.board.output.selected;
  state.editingTPS = game.editingTPS;
  state.highlighterEnabled = game.highlighterEnabled || false;
  state.highlighterSquares = game.highlighterSquares;
  state.ptnUI = Object.freeze(loadedPTNUI || { branchPointOverrides: {} });
};

export const ADD_GAME = (state, game) => {
  state.list.unshift({
    ptn: game.ptn,
    name: game.name,
    state: game.minState || game.state,
    config: game.config,
    ptnUI: cloneDeep(
      game.ptnUI && game.ptnUI.branchPointOverrides
        ? game.ptnUI
        : { branchPointOverrides: {} }
    ),
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
      ptnUI: cloneDeep(
        game.ptnUI && game.ptnUI.branchPointOverrides
          ? game.ptnUI
          : { branchPointOverrides: {} }
      ),
      history: game.history,
      historyIndex: game.historyIndex,
      editingTPS: game.editingTPS,
      highlighterEnabled: game.highlighterEnabled,
      highlighterSquares: game.highlighterSquares,
    }))
  );
};

export const SET_BRANCH_POINT_OVERRIDES = (state, overrides) => {
  state.ptnUI = Object.freeze({
    branchPointOverrides: Object.freeze({ ...overrides } || {}),
  });
  if (state.list && state.list[0]) {
    state.list[0].ptnUI = state.ptnUI;
  }
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
  const game = state.list.splice(index, 1)[0];
  game.lastSeen = new Date();
  state.list.unshift(game);
  // Ensure ptnUI is preserved when switching games
  if (game.ptnUI && game.ptnUI.branchPointOverrides) {
    state.ptnUI = Object.freeze({
      branchPointOverrides: Object.freeze({
        ...game.ptnUI.branchPointOverrides,
      }),
    });
  } else {
    state.ptnUI = Object.freeze({ branchPointOverrides: Object.freeze({}) });
  }
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

export const HIGHLIGHT_SQUARES = (
  state,
  { squares, secondarySquares } = {}
) => {
  if (squares && squares.length) {
    state.hlSquares = squares;
  } else {
    state.hlSquares = [];
  }
  if (secondarySquares && secondarySquares.length) {
    state.hlSquaresSecondary = secondarySquares;
  } else {
    state.hlSquaresSecondary = [];
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
      // Navigate to the specified line number within the current branch
      const linenum = new Linenum(plies.shift());
      let player = 1;
      if (Nop.test(plies[0])) {
        player = 2;
        plies.shift();
      }

      // Get the current branch context
      const currentBranch = game.board.targetBranch || "";

      // Find the target ply within the current branch or its continuation
      const targetPly = game.plies.find(
        (ply) =>
          ply.linenum.number === linenum.number &&
          ply.player === player &&
          ply.isInBranch(currentBranch)
      );

      if (targetPly) {
        // Navigate to the target position within the current branch
        game.board.goToPly(targetPly.id, false);
      } else {
        // Line number not found in current branch - find the last ply in the branch
        const pliesInBranch = game.plies.filter((ply) =>
          ply.isInBranch(currentBranch)
        );
        if (pliesInBranch.length > 0) {
          const lastPly = pliesInBranch[pliesInBranch.length - 1];
          // Go to the end of the current branch
          game.board.goToPly(lastPly.id, true);
        }
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
  const savedBranchOverrides =
    state.ptnUI && state.ptnUI.branchPointOverrides
      ? { ...state.ptnUI.branchPointOverrides }
      : {};
  if (game && !state.isEditingTPS && game.undo()) {
    state.ptnUI = Object.freeze({
      branchPointOverrides: Object.freeze(savedBranchOverrides),
    });
    postMessage("UNDO");
  }
};

export const REDO = (state) => {
  const game = Vue.prototype.$game;
  const savedBranchOverrides =
    state.ptnUI && state.ptnUI.branchPointOverrides
      ? { ...state.ptnUI.branchPointOverrides }
      : {};
  if (game && !state.isEditingTPS && game.redo()) {
    state.ptnUI = Object.freeze({
      branchPointOverrides: Object.freeze(savedBranchOverrides),
    });
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

// Helper to save the EFFECTIVE expanded/collapsed state for ALL branch points
// This preserves the visual state regardless of what the new default would be
// Uses sorted sibling move texts as a stable key that survives promotion
const saveBranchPointStates = (game, currentOverrides) => {
  const saved = {};
  // Find all branch points and save their effective state
  // Note: in game.plies, branches[0] is a ply object, not an ID
  for (const ply of game.plies) {
    if (
      ply &&
      ply.branches &&
      ply.branches.length > 1 &&
      ply.branches[0] === ply
    ) {
      const override = currentOverrides[ply.id];
      // Use all sibling move texts (sorted) as a stable key
      // This survives promotion because the siblings remain the same
      const siblingMoveTexts = ply.branches
        .map((siblingPly) => (siblingPly ? siblingPly.toString(true) : null))
        .filter(Boolean)
        .sort()
        .join("|");
      const key = JSON.stringify({
        moveNumber: ply.move.number,
        player: ply.player,
        siblings: siblingMoveTexts,
      });
      // Save explicit overrides only - undefined means use default behavior
      if (override !== undefined) {
        saved[key] = override;
      }
    }
  }
  return saved;
};

// Helper to restore branch point overrides after init()
const restoreBranchPointStates = (game, savedStates) => {
  const newOverrides = {};
  Object.entries(savedStates).forEach(([key, expanded]) => {
    let parsed;
    try {
      parsed = JSON.parse(key);
    } catch (e) {
      return;
    }
    // Find the branch point ply matching this key
    // Note: in game.plies, branches[0] is a ply object, not an ID
    for (const ply of game.plies) {
      if (
        ply.move.number === parsed.moveNumber &&
        ply.player === parsed.player &&
        ply.branches &&
        ply.branches.length > 1 &&
        ply.branches[0] === ply
      ) {
        // Build the sibling key for this branch point
        const siblingMoveTexts = ply.branches
          .map((siblingPly) => (siblingPly ? siblingPly.toString(true) : null))
          .filter(Boolean)
          .sort()
          .join("|");
        if (siblingMoveTexts === parsed.siblings) {
          newOverrides[ply.id] = expanded;
          break;
        }
      }
    }
  });
  return newOverrides;
};

export const PROMOTE_BRANCH = (state, branch) => {
  const game = Vue.prototype.$game;
  const currentOverrides = state.ptnUI?.branchPointOverrides || {};
  const savedStates = saveBranchPointStates(game, currentOverrides);

  game.promoteBranch(branch);

  const newOverrides = restoreBranchPointStates(game, savedStates);
  state.ptnUI = Object.freeze({
    branchPointOverrides: Object.freeze(newOverrides),
  });
  if (state.list && state.list[0]) {
    state.list[0].ptnUI = state.ptnUI;
  }
};

export const MAKE_BRANCH_MAIN = (state, branch) => {
  const game = Vue.prototype.$game;
  const currentOverrides = state.ptnUI?.branchPointOverrides || {};
  const savedStates = saveBranchPointStates(game, currentOverrides);

  game.makeBranchMain(branch, true);

  const newOverrides = restoreBranchPointStates(game, savedStates);
  state.ptnUI = Object.freeze({
    branchPointOverrides: Object.freeze(newOverrides),
  });
  if (state.list && state.list[0]) {
    state.list[0].ptnUI = state.ptnUI;
  }
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

export const SET_NOTES = (state, { plyID, messages }) => {
  Vue.prototype.$game.setNotes(plyID, messages);
};

export const REMOVE_NOTE = (state, { plyID, index }) => {
  Vue.prototype.$game.removeNote(plyID, index);
};

export const REMOVE_ANALYSIS_NOTE = (state, source) => {
  Vue.prototype.$game.removeAnalysisNote(source);
};

export const REMOVE_POSITION_NOTES = (state, plyID) => {
  Vue.prototype.$game.removeNotes(
    (note, notePlyID) => notePlyID === String(plyID)
  );
};

export const REMOVE_POSITION_USER_NOTES = (state, plyID) => {
  Vue.prototype.$game.removeNotes(
    (note, notePlyID) =>
      notePlyID === String(plyID) &&
      note.output.evaluation === null &&
      note.output.pv === null &&
      note.output.pvAfter === null
  );
};

export const REMOVE_ALL_USER_NOTES = () => {
  Vue.prototype.$game.removeNotes(
    (note) =>
      note.output.evaluation === null &&
      note.output.pv === null &&
      note.output.pvAfter === null
  );
};

export const REMOVE_NOTES = () => {
  Vue.prototype.$game.removeNotes();
};

export const REMOVE_ANALYSIS_NOTES = () => {
  Vue.prototype.$game.removeNotes(
    (note, plyID) =>
      note.output.evaluation !== null ||
      note.output.pv !== null ||
      note.output.pvAfter !== null
  );
};

export const REMOVE_POSITION_ANALYSIS_NOTES = (state, tps) => {
  const allPlies = state.ptn && state.ptn.allPlies;
  if (!Vue.prototype.$game || !tps) {
    return;
  }

  const prevPly = allPlies && allPlies.find((p) => p && p.tpsAfter === tps);
  const nextPly = allPlies && allPlies.find((p) => p && p.tpsBefore === tps);

  // Check if this is the initial position (before first move)
  // Initial position is when there's no prevPly (no ply ends at this TPS)
  const isInitialPosition = !prevPly;

  const evalPlyID = prevPly ? String(prevPly.id) : null;
  const nextPlyID = nextPly ? String(nextPly.id) : null;

  Vue.prototype.$game.removeNotes((note, plyID) => {
    // For initial position, check ply -1
    if (isInitialPosition && plyID === "-1") {
      return (
        note.evaluation !== null || note.pv !== null || note.pvAfter !== null
      );
    }
    if (evalPlyID && plyID === evalPlyID) {
      return (
        note.evaluation !== null || note.pv !== null || note.pvAfter !== null
      );
    }
    if (nextPlyID && plyID === nextPlyID) {
      return note.evaluation !== null || note.pv !== null;
    }
    return false;
  });
};

// Helper to check if a note matches an engine name (exact match)
// null engineName matches notes without a botName
const noteMatchesEngine = (note, engineName) => {
  if (engineName === null) {
    return !note.botName;
  }
  return note.botName === engineName;
};

// Helper to check if a note is an analysis note
const isAnalysisNote = (note) =>
  note.evaluation !== null || note.pv !== null || note.pvAfter !== null;

export const REMOVE_BOT_ANALYSIS_NOTES = (state, engineName) => {
  if (!Vue.prototype.$game) {
    return;
  }

  Vue.prototype.$game.removeNotes((note) => {
    return isAnalysisNote(note) && noteMatchesEngine(note, engineName);
  });
};

export const REMOVE_POSITION_BOT_ANALYSIS_NOTES = (state, { tps, botName }) => {
  const engineName = botName;
  const allPlies = state.ptn && state.ptn.allPlies;
  if (!Vue.prototype.$game || !tps) {
    return;
  }

  const prevPly = allPlies && allPlies.find((p) => p && p.tpsAfter === tps);
  const nextPly = allPlies && allPlies.find((p) => p && p.tpsBefore === tps);

  // Check if this is the initial position (before first move)
  // Initial position is when there's no prevPly (no ply ends at this TPS)
  // This handles both cases: when nextPly exists and when the game has no plies
  const isInitialPosition = !prevPly;

  const evalPlyID = prevPly ? String(prevPly.id) : null;
  const nextPlyID = nextPly ? String(nextPly.id) : null;

  Vue.prototype.$game.removeNotes((note, plyID) => {
    if (!noteMatchesEngine(note, engineName)) {
      return false;
    }
    // For initial position, check ply -1
    if (isInitialPosition && plyID === "-1") {
      return (
        note.evaluation !== null || note.pv !== null || note.pvAfter !== null
      );
    }
    if (evalPlyID && plyID === evalPlyID) {
      return (
        note.evaluation !== null || note.pv !== null || note.pvAfter !== null
      );
    }
    if (nextPlyID && plyID === nextPlyID) {
      return note.evaluation !== null || note.pv !== null;
    }
    return false;
  });
};
