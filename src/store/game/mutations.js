import Vue from "vue";
import { cloneDeep } from "lodash";
import { postMessage } from "../../utilities";
import Game from "../../Game";
import Evaluation from "../../Game/PTN/Evaluation";
import Linenum from "../../Game/PTN/Linenum";
import Nop from "../../Game/PTN/Nop";
import Ply from "../../Game/PTN/Ply";
import Result from "../../Game/PTN/Result";
import {
  annotateGame as annotateGameTak,
  checkPlyForTak,
} from "../../bots/tak-annotator";

const parseInteger = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isAtEndOfMainBranch = (game) =>
  game && game.board.ply
    ? !game.board.ply.branch && !game.board.nextPly && game.board.plyIsDone
    : game && game.plies.length === 0;

const getPlaytakMainlinePlies = (game) =>
  game.plies.filter((ply) => ply && !ply.branch && ply.text !== "--");

const restoreGamePosition = (
  game,
  restorePath,
  restorePlyID,
  restorePlyIsDone,
  preferredBranch = null
) => {
  if (!game) {
    return;
  }

  const resolvedPreferredBranch =
    preferredBranch && preferredBranch in game.branches
      ? preferredBranch
      : null;

  if (restorePath) {
    let targetPly = game.findPlyFromPath(restorePath);

    if (
      targetPly &&
      resolvedPreferredBranch &&
      !targetPly.isInBranch(resolvedPreferredBranch)
    ) {
      const target = restorePath[restorePath.length - 1];
      const branchCandidates = game.plies.filter(
        (ply) =>
          ply &&
          ply.move &&
          ply.move.number === target.moveNumber &&
          ply.player === target.player &&
          ply.toString(true) === target.moveText &&
          ply.isInBranch(resolvedPreferredBranch)
      );

      if (branchCandidates.length) {
        targetPly = branchCandidates[0];
      }
    }

    if (targetPly) {
      game.board.goToPly(targetPly.id, restorePlyIsDone);
      return;
    }
  }
  if (restorePlyID >= 0 && game.plies[restorePlyID]) {
    game.board.goToPly(restorePlyID, restorePlyIsDone);
  } else if (game.plies.length) {
    game.board.goToPly(game.plies[0].id, false);
  }
};

const setPlaytakLiveConfig = (game, { playtakID, syncedMainlineCount }) => {
  if (!game) {
    return;
  }

  game.config = {
    ...(game.config || {}),
    playtakID: String(
      playtakID || (game.config && game.config.playtakID) || ""
    ),
    playtakLive: true,
    playtakSyncedMainline: Math.max(0, parseInteger(syncedMainlineCount, 0)),
  };
};

const setPlaytakLastMainlineResult = (game, rawResult) => {
  if (!game) {
    return false;
  }

  const resultText = String(rawResult || "").trim();
  if (!resultText) {
    return false;
  }

  const mainline = getPlaytakMainlinePlies(game);
  const lastMainlinePly = mainline.length
    ? mainline[mainline.length - 1]
    : null;
  if (!lastMainlinePly || lastMainlinePly.result) {
    return false;
  }

  let result;
  try {
    result = Result.parse(resultText);
  } catch (error) {
    return false;
  }

  lastMainlinePly.result = result;
  game.board.dirtyPly(lastMainlinePly.id);

  if (
    game.board.ply &&
    game.board.ply.id === lastMainlinePly.id &&
    game.board.plyIsDone
  ) {
    game.board.setRoads(result.roads || null);
  }

  game.board.updatePTNOutput();
  game.board.updatePositionOutput();
  game.board.updateBoardOutput();
  game._updatePTN();

  return true;
};

const appendPlaytakLivePly = (game, plyText, liveSync) => {
  // Post-insert identity checks below use Ply.isEqual, which compares
  // on the minProps set (column/row/direction/pieceCount/distribution/
  // specialPiece) and so ignores both:
  //   - carry/distribution defaulting (PlayTak sends "1e5-1",
  //     Ply.text emits "e5-")
  //   - wall-smash markers (PlayTak's M command never includes the
  //     `*`, but PTN-Ninja appends one during insertion when a
  //     capstone flattens a standing stone)
  // Direct .text comparison would spuriously mismatch in either case.

  const currentPly = game.board.ply;
  const restorePath = currentPly ? currentPly.getSerializablePath() : null;
  const restorePlyID = game.board.plyID;
  const restorePlyIsDone = game.board.plyIsDone;
  const restoreTargetBranch = game.board.targetBranch;

  const mainlineBefore = getPlaytakMainlinePlies(game);
  const syncedBefore = Math.max(
    0,
    Math.min(
      parseInteger(liveSync && liveSync.syncedMainlineCount, 0),
      mainlineBefore.length
    )
  );
  const displacedPly = mainlineBefore[syncedBefore] || null;
  const anchorPly = syncedBefore ? mainlineBefore[syncedBefore - 1] : null;
  let remappedTargetBranch = restoreTargetBranch;

  const atEndOfMainline = isAtEndOfMainBranch(game);
  const atSyncedFrontier = syncedBefore
    ? currentPly === anchorPly && restorePlyIsDone
    : !currentPly;
  const shouldAutoFollow = atEndOfMainline && atSyncedFrontier;

  if (anchorPly) {
    game.board.goToPly(anchorPly.id, true);
  } else if (mainlineBefore.length) {
    game.board.goToPly(mainlineBefore[0].id, false);
  }

  game.insertPly(plyText, false, false);

  const insertedPly = game.board.ply;
  if (insertedPly && insertedPly.isEqual(plyText) && insertedPly.branch) {
    game.makeBranchMain(insertedPly.branch);

    const promotedPly = game.board.ply;
    if (
      promotedPly &&
      promotedPly.branches &&
      promotedPly.branches.length > 1 &&
      displacedPly
    ) {
      const movedSpectatorPly = promotedPly.branches.find(
        (ply) =>
          ply.id !== promotedPly.id &&
          ply.isEqual(displacedPly) &&
          ply.branch !== promotedPly.branch
      );
      if (movedSpectatorPly && movedSpectatorPly.branch in game.branches) {
        remappedTargetBranch = movedSpectatorPly.branch;
      }
    }
  }

  const mainlineAfter = getPlaytakMainlinePlies(game);
  const syncedPly = mainlineAfter[syncedBefore];
  if (!syncedPly || !syncedPly.isEqual(plyText)) {
    throw new Error("Could not sync ongoing PlayTak move");
  }

  setPlaytakLiveConfig(game, {
    playtakID: liveSync && liveSync.playtakID,
    syncedMainlineCount: syncedBefore + 1,
  });

  if (!shouldAutoFollow) {
    restoreGamePosition(
      game,
      restorePath,
      restorePlyID,
      restorePlyIsDone,
      remappedTargetBranch
    );
  }

  if (remappedTargetBranch in game.branches) {
    game.board.targetBranch = remappedTargetBranch;
  }
};

export const SET_ERROR = (state, error) => {
  state.error = error;
};

export const INIT = (state, games) => {
  state.list = games;
  state.init = true;
};

export const SET_GAME = function (state, game) {
  const previousGame = Vue.prototype.$game;
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

  // Handler used by interactive board inserts (via game.insertPlyInteractive).
  // Optionally pre-checks whether the ply creates a tak threat, then commits
  // through a Vuex mutation so the state change stays inside a mutation
  // handler — otherwise Vuex strict mode warns about mutations after the
  // pre-check await returns.
  const onInsertPlyInteractive = async (ply, isAlreadyDone, replaceCurrent) => {
    let takMark = false;
    if (this.state.ui && this.state.ui.autoAnnotateTak) {
      const size = game.config && game.config.size;
      if ([4, 5, 6, 7].includes(size)) {
        try {
          takMark = await checkPlyForTak(game, ply, { isAlreadyDone });
        } catch (e) {
          takMark = false;
        }
      }
    }
    this.commit("game/INSERT_PLY_INTERACTIVE", {
      ply,
      isAlreadyDone,
      replaceCurrent,
      takMark,
    });
  };

  state.error = null;
  state.evaluation = null;
  state.evaluationWDL = null;
  if (!(game instanceof Game)) {
    game = new Game({
      ...game,
      ptnUI: loadedPTNUI,
      skipToEndOnLoad: this.state.ui.skipToEndOnLoad,
      onInit,
      onAppendPly,
      onInsertPly,
      onError,
      onInsertPlyInteractive,
    });
  } else {
    game.board.updateOutput();
    if (!game.onInit) {
      game.onInit = onInit;
      game.onAppendPly = onAppendPly;
      game.onInsertPly = onInsertPly;
      game.onError = onError;
    }
    // Always refresh this hook — it closes over the current store `this`
    // and `game`, and needs to observe the latest ui.autoAnnotateTak state.
    game.onInsertPlyInteractive = onInsertPlyInteractive;
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

  // If auto-annotate-tak is enabled, sweep the new game's plies for tak
  // marks. Only fire on genuine game loads/switches — when the game
  // instance is the same as before (re-init via undo/redo/trim), the marks
  // are already part of the PTN/history and re-sweeping would undo undo.
  if (previousGame !== game && this.state.ui && this.state.ui.autoAnnotateTak) {
    const size = game.config && game.config.size;
    if ([4, 5, 6, 7].includes(size)) {
      annotateGameTak(game).catch(() => {});
    }
  }
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

export const SET_PLAYTAK_LIVE_CONFIG = (
  state,
  { playtakID, syncedMainlineCount }
) => {
  const game = Vue.prototype.$game;
  if (!game) {
    return;
  }
  setPlaytakLiveConfig(game, { playtakID, syncedMainlineCount });
  state.config = { ...state.config, ...game.config };
  const stateGame = state.list.find((g) => g.name === game.name);
  if (stateGame) {
    stateGame.config = { ...game.config };
  }
};

export const MARK_PLAYTAK_ENDED = (state, { clearTimes = false } = {}) => {
  const game = Vue.prototype.$game;
  if (!game) {
    return;
  }

  const currentConfig = { ...(game.config || {}) };

  // Freeze or clear clocks before unsetting playtakLive/timerLive.
  //
  // Until now the active player's stored gameTimeN has been a snapshot
  // from the last SET_GAME_TIMER_TURN; GameTimer computes the live
  // display as base - (now - gameLastTimeUpdate) while playtakLive is
  // true. The moment we unset playtakLive, GameTimer falls back to the
  // raw base and the clock visually jumps back to that snapshot — so on
  // refresh a player who just timed out would appear to still have time
  // on the clock. Freeze the live-computed value into the stored base.
  //
  // When `clearTimes` is passed (e.g. reloading a game that ended while
  // the tab was closed) we have no way to know the final times and the
  // cached values are untrustworthy, so we null them instead.
  const timeUpdates = {};
  if (clearTimes) {
    timeUpdates.gameTime1 = null;
    timeUpdates.gameTime2 = null;
    timeUpdates.gameTimerTurn = null;
  } else {
    const lastUpdate = currentConfig.gameLastTimeUpdate;
    const turn = currentConfig.gameTimerTurn;
    const wasLive =
      currentConfig.playtakLive === true || currentConfig.timerLive === true;
    if (wasLive && lastUpdate) {
      const elapsed = Math.max(0, performance.now() - lastUpdate);
      if (turn === 1 && currentConfig.gameTime1 != null) {
        timeUpdates.gameTime1 = Math.max(0, currentConfig.gameTime1 - elapsed);
      } else if (turn === 2 && currentConfig.gameTime2 != null) {
        timeUpdates.gameTime2 = Math.max(0, currentConfig.gameTime2 - elapsed);
      }
    }
  }

  game.config = {
    ...currentConfig,
    ...timeUpdates,
    playtakLive: false,
    isOngoing: false,
    gameLastTimeUpdate: null,
    timerLive: false,
  };
  state.config = { ...state.config, ...game.config };
  const stateGame = state.list.find((g) => g.name === game.name);
  if (stateGame) {
    stateGame.config = { ...game.config };
  }
};

export const SET_TIMER_LIVE = (state, live) => {
  if (!state.config) return;
  const update = { timerLive: Boolean(live) };
  const game = Vue.prototype.$game;
  if (game) {
    game.config = { ...game.config, ...update };
    const stateGame = state.list.find((g) => g.name === game.name);
    if (stateGame) {
      stateGame.config = { ...game.config };
    }
  }
  state.config = { ...state.config, ...update };
};

export const SET_GAME_TIMER_TURN = function (state, turn) {
  if (!state.config) return;
  const now = performance.now();
  const elapsed = state.config.gameLastTimeUpdate
    ? now - state.config.gameLastTimeUpdate
    : 0;
  const prevTurn = state.config.gameTimerTurn;
  const update = {
    gameTimerTurn: turn,
    gameLastTimeUpdate: now,
  };
  if (prevTurn === 1 && state.config.gameTime1 != null) {
    update.gameTime1 = Math.max(0, state.config.gameTime1 - elapsed);
  } else if (prevTurn === 2 && state.config.gameTime2 != null) {
    update.gameTime2 = Math.max(0, state.config.gameTime2 - elapsed);
  }
  const game = Vue.prototype.$game;
  if (game) {
    game.config = { ...game.config, ...update };
    const stateGame = state.list.find((g) => g.name === game.name);
    if (stateGame) {
      stateGame.config = { ...game.config };
    }
  }
  state.config = { ...state.config, ...update };
};

export const SET_GAME_TIME = function (state, payload) {
  if (!state.config) return;
  const timeConfig = {
    gameTime1: payload.time1,
    gameTime2: payload.time2,
    gameLastTimeUpdate: payload.lastTimeUpdate,
    gameTimerTurn: payload.timerTurn,
  };
  const game = Vue.prototype.$game;
  if (game) {
    game.config = { ...game.config, ...timeConfig };
    const stateGame = state.list.find((g) => g.name === game.name);
    if (stateGame) {
      stateGame.config = { ...game.config };
    }
  }
  state.config = { ...state.config, ...timeConfig };
};

export const SET_PLAYTAK_LAST_MAINLINE_RESULT = (state, result) => {
  const game = Vue.prototype.$game;
  if (!game) {
    return;
  }

  setPlaytakLastMainlineResult(game, result);
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

export const HIGHLIGHT_SQUARES = (state, { squares } = {}) => {
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
  if (evaluation && typeof evaluation === "object") {
    state.evaluation =
      "evaluation" in evaluation ? evaluation.evaluation : null;
    state.evaluationWDL = "wdl" in evaluation ? evaluation.wdl : null;
    return;
  }
  state.evaluation = evaluation;
  state.evaluationWDL = null;
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

export const DELETE_PLY = (state, payload) => {
  const game = Vue.prototype.$game;
  if (!game) {
    return;
  }

  const plyID =
    payload && typeof payload === "object"
      ? parseInteger(payload.plyID, NaN)
      : parseInteger(payload, NaN);
  if (!Number.isFinite(plyID)) {
    return;
  }

  const currentOverrides = state.ptnUI?.branchPointOverrides || {};
  const savedStates = saveBranchPointStates(game, currentOverrides);

  const fromServer = Boolean(payload && payload.fromServer);
  game.deletePlies(plyID, !fromServer, true, false);

  const newOverrides = restoreBranchPointStates(game, savedStates);
  state.ptnUI = Object.freeze({
    branchPointOverrides: Object.freeze(newOverrides),
  });
  if (state.list && state.list[0]) {
    state.list[0].ptnUI = state.ptnUI;
  }

  if (payload && typeof payload === "object" && payload.playtakLive) {
    setPlaytakLiveConfig(game, {
      playtakID: payload.playtakLive.playtakID,
      syncedMainlineCount: payload.playtakLive.syncedMainlineCount,
    });
  }

  if (game) {
    postMessage("DELETE_PLY", plyID);
  }
};

const isPayloadObject = (payload) =>
  payload &&
  typeof payload === "object" &&
  !(payload instanceof Ply) &&
  "ply" in payload;

export const APPEND_PLY = (state, payload) => {
  const game = Vue.prototype.$game;
  if (!game) {
    return;
  }

  const isObj = isPayloadObject(payload);
  const plyInput = isObj ? payload.ply : payload;
  const liveSync = isObj ? payload.playtakLive : null;
  const takMark = isObj ? !!payload.takMark : false;

  if (liveSync) {
    appendPlaytakLivePly(game, plyInput, liveSync);
    return;
  }

  game.appendPly(plyInput, takMark);
};

export const INSERT_PLY = (state, payload) => {
  const game = Vue.prototype.$game;
  if (!game) return;
  const isObj = isPayloadObject(payload);
  const plyInput = isObj ? payload.ply : payload;
  const takMark = isObj ? !!payload.takMark : false;
  if (state.selected.moveset.length) {
    game.board.cancelMove();
  }
  game.insertPly(plyInput, false, false, takMark);
};

// Commits the tail half of an interactive ply insert (from ix.js). ix.js
// doesn't go through a Vuex action; Game.insertPlyInteractive delegates to
// the onInsertPlyInteractive hook, which awaits the tak pre-check and then
// commits this mutation so the state change lands inside a mutation
// handler. Unlike INSERT_PLY, we don't cancelMove — for stack moves ix.js
// has already applied the moveset (isAlreadyDone=true) and manages its
// own selection state.
export const INSERT_PLY_INTERACTIVE = (
  state,
  { ply, isAlreadyDone, replaceCurrent, takMark }
) => {
  const game = Vue.prototype.$game;
  if (!game) return;
  game.insertPly(ply, !!isAlreadyDone, !!replaceCurrent, !!takMark);
};

export const INSERT_PLIES = (state, { plies, prev, takMarks }) => {
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
    plies = game.insertPlies(plies, prev, takMarks);
    postMessage(
      "INSERT_PLIES",
      plies.map((ply) => ply.text),
      prev
    );
  }
};

export const DELETE_BRANCH = (state, branch) => {
  const game = Vue.prototype.$game;
  if (!game) {
    return;
  }

  const currentOverrides = state.ptnUI?.branchPointOverrides || {};
  const savedStates = saveBranchPointStates(game, currentOverrides);

  game.deleteBranch(branch, true);

  const newOverrides = restoreBranchPointStates(game, savedStates);
  state.ptnUI = Object.freeze({
    branchPointOverrides: Object.freeze(newOverrides),
  });
  if (state.list && state.list[0]) {
    state.list[0].ptnUI = state.ptnUI;
  }

  postMessage("DELETE_BRANCH", branch);
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

// Helper to save the EFFECTIVE expanded/collapsed state for ALL branch points.
// Uses (branch, moveNumber, player) of the primary ply as a stable key:
// - Non-primary sibling deletion: primary unchanged, key stable.
// - Primary deletion with promotion: new primary inherits the old primary's
//   branch name (via _renameBranch), so (branch, moveNumber, player) is stable.
// - Branch promotion (MAKE_BRANCH_MAIN): branch names are renamed, and the
//   branch point's primary still sits at the same (branch, moveNumber, player).
const branchPointKey = (ply) =>
  JSON.stringify({
    branch: ply.branch,
    moveNumber: ply.move.number,
    player: ply.player,
  });

const saveBranchPointStates = (game, currentOverrides) => {
  const saved = {};
  for (const ply of game.plies) {
    if (
      ply &&
      ply.branches &&
      ply.branches.length > 1 &&
      ply.branches[0] === ply
    ) {
      const override = currentOverrides[ply.id];
      // Save explicit overrides only - undefined means use default behavior
      if (override !== undefined) {
        saved[branchPointKey(ply)] = override;
      }
    }
  }
  return saved;
};

// Helper to restore branch point overrides after init()
const restoreBranchPointStates = (game, savedStates) => {
  const newOverrides = {};
  for (const ply of game.plies) {
    if (
      !ply ||
      !ply.branches ||
      ply.branches.length <= 1 ||
      ply.branches[0] !== ply
    ) {
      continue;
    }
    const key = branchPointKey(ply);
    if (key in savedStates) {
      newOverrides[ply.id] = savedStates[key];
    }
  }
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

export const REMOVE_EVAL_MARKS = () => {
  Vue.prototype.$game.removeEvalMarks();
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

export const REPLACE_NOTES = (state, { removals, additions }) => {
  Vue.prototype.$game.replaceNotes(removals, additions);
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
      note.output.wdl !== null ||
      note.output.rawCp !== null ||
      note.output.scoreText !== null ||
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
        note.evaluation !== null ||
        note.wdl !== null ||
        note.rawCp !== null ||
        note.scoreText !== null ||
        note.pv !== null ||
        note.pvAfter !== null
      );
    }
    // prevPly (tpsAfter === tps): eval and new-format pvAfter belong to this position
    // Do NOT remove old-format pv here — it belongs to the previous position
    if (evalPlyID && plyID === evalPlyID) {
      return (
        note.evaluation !== null ||
        note.wdl !== null ||
        note.rawCp !== null ||
        note.scoreText !== null ||
        note.pvAfter !== null
      );
    }
    // nextPly (tpsBefore === tps): only old-format pv belongs to this position
    // eval/wdl/scoreText/pvAfter on nextPly belong to the next position
    if (nextPlyID && plyID === nextPlyID) {
      return note.pv !== null;
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
  note.evaluation !== null ||
  note.wdl !== null ||
  note.rawCp !== null ||
  note.scoreText !== null ||
  note.pv !== null ||
  note.pvAfter !== null;

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
        note.evaluation !== null ||
        note.wdl !== null ||
        note.rawCp !== null ||
        note.scoreText !== null ||
        note.pv !== null ||
        note.pvAfter !== null
      );
    }
    // prevPly (tpsAfter === tps): eval and new-format pvAfter belong to this position
    // Do NOT remove old-format pv here — it belongs to the previous position
    if (evalPlyID && plyID === evalPlyID) {
      return (
        note.evaluation !== null ||
        note.wdl !== null ||
        note.rawCp !== null ||
        note.scoreText !== null ||
        note.pvAfter !== null
      );
    }
    // nextPly (tpsBefore === tps): only old-format pv belongs to this position
    // eval/wdl/scoreText/pvAfter on nextPly belong to the next position
    if (nextPlyID && plyID === nextPlyID) {
      return note.pv !== null;
    }
    return false;
  });
};

/**
 * Apply tak (') annotations to all plies in a single atomic update.
 * @param {Set<number>} takPlyIDs - Set of ply IDs that should be marked as tak
 */
export const SET_TAK_ANNOTATIONS = (state, takPlyIDs) => {
  const game = Vue.prototype.$game;
  let changed = false;
  for (const ply of game.plies) {
    if (!ply) continue;
    if (ply.evaluation && ply.evaluation.tinue) continue;
    const shouldBeTak = takPlyIDs.has(ply.id);
    const isTak = !!(ply.evaluation && ply.evaluation.tak);
    if (shouldBeTak === isTak) continue;
    const existingText = ply.evaluation ? ply.evaluation.text : "";
    const baseText = existingText.replace(/'/g, "");
    const newText = shouldBeTak ? baseText + "'" : baseText;
    ply.evaluation = newText ? Evaluation.parse(newText) : null;
    game.board.dirtyPly(ply.id);
    changed = true;
  }
  if (changed) {
    game._updatePTN(true);
    game.board.updatePTNOutput();
    game.board.updatePositionOutput();
    state.history = game.history;
    state.historyIndex = game.historyIndex;
  }
};
