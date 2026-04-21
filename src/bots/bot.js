import store from "../store";
import { i18n } from "../boot/i18n";
import {
  deepFreeze,
  notifyError,
  notifyHint,
  notifyWarning,
  parsePV,
} from "../utilities";
import {
  defaults,
  forEach,
  isEmpty,
  isObject,
  isNumber,
  uniqBy,
  isString,
} from "lodash";
import hashObject from "object-hash";
import {
  getBotName,
  getNodes,
  getMS,
  getDepth,
  getVisits,
  getPV,
  getPVAfter,
  getEvalMark,
} from "../Game/PTN/Comment";
import { bothPlayersHaveFlats } from "../Game/PTN/TPS";
import { normalizeWDL } from "./wdl";

export function formatEvaluation(value) {
  return value === null ? null : `${i18n.n(Math.abs(value), "n0")}%`;
}

export { normalizeWDL };

export const defaultLimitTypes = deepFreeze({
  depth: { min: 1, max: 100, step: 1 },
  nodes: { min: 1e3, max: 1e9, step: 1e3 },
  movetime: { min: 100, max: 6e4, step: 100 },
});

export const defaultEvalMarkThresholds = deepFreeze({
  brilliant: 6,
  good: 3,
  bad: -10,
  blunder: -25,
});

// Standalone function to calculate eval mark for a single ply
// Exported for use in both Bot class and store getters
export function calculateEvalMark(ply, positions, thresholds) {
  if (!thresholds) {
    thresholds = defaultEvalMarkThresholds;
  }

  // Skip first two plies (opening moves) - no meaningful "before" to compare
  const tpsParts = ply.tpsBefore ? ply.tpsBefore.split(" ") : [];
  const moveNumber = tpsParts.length >= 3 ? Number(tpsParts[2]) : 0;
  if (moveNumber <= 1) {
    return null;
  }

  const positionBefore = positions[ply.tpsBefore];
  const positionAfter = positions[ply.tpsAfter];

  if (!positionBefore || !positionAfter) {
    return null;
  }
  if (!positionBefore[0] || !positionAfter[0]) {
    return null;
  }

  let rawCpBefore = positionBefore[0].rawCp;
  let rawCpAfter = positionAfter[0].rawCp;

  if (rawCpBefore === null || rawCpAfter === null) {
    return null;
  }

  // Terminal scores (solved win/loss/draw) store ±100 rawCp, which is too
  // small to compare meaningfully against regular engine cp values. Treat
  // them as an extreme advantage so the delta correctly reflects the gravity
  // of entering or leaving a solved position.
  const TERMINAL_CP = 10000;
  if (positionBefore[0].scoreText != null) {
    rawCpBefore =
      rawCpBefore > 0 ? TERMINAL_CP : rawCpBefore < 0 ? -TERMINAL_CP : 0;
  }
  if (positionAfter[0].scoreText != null) {
    rawCpAfter =
      rawCpAfter > 0 ? TERMINAL_CP : rawCpAfter < 0 ? -TERMINAL_CP : 0;
  }

  const scoreLoss =
    ply.player === 1 ? rawCpAfter - rawCpBefore : rawCpBefore - rawCpAfter;

  if (scoreLoss <= thresholds.blunder) {
    return "??";
  } else if (scoreLoss <= thresholds.bad) {
    return "?";
  } else if (scoreLoss >= thresholds.brilliant) {
    return "!!";
  } else if (scoreLoss >= thresholds.good) {
    return "!";
  } else {
    return null;
  }
}

export default class Bot {
  constructor({
    // ID:
    id,
    icon,
    label,
    description,

    // Meta:
    name,
    author,
    version,
    concurrency = 1,
    isInteractive = false,
    requiresConnect = false,
    limitTypes = defaultLimitTypes,
    options = {},
    sizeHalfKomis = {}, // Map of sizes to arrays of halfkomis

    // Extensions:
    state = {},
    settings = {},
    meta = {},

    // Callbacks:
    onError,
    onInfo,
    onWarning,
  }) {
    this.id = id;
    this.icon = icon;

    Object.defineProperty(this, "label", {
      get: () => i18n.t(label),
      configurable: true,
    });
    Object.defineProperty(this, "description", {
      get: () => i18n.t(description),
      configurable: true,
    });

    // Callbacks
    this.onError = onError || notifyError;
    this.onInfo = onInfo || notifyHint;
    this.onWarning = onWarning || notifyWarning;
    this.onReady = null;
    this.onComplete = null;
    this.unwatchPosition = null;
    this.unwatchScrubbing = null;

    forEach(limitTypes, (params, type) => {
      defaults(params, defaultLimitTypes[type]);
    });
    this.meta = {
      name,
      author,
      version,
      concurrency,
      isInteractive,
      requiresConnect,
      options,
      sizeHalfKomis,
      limitTypes,
      ...meta,
    };

    this.settings = {
      enableLogging: false,
      ...settings,
    };
    // After initialization of the store,
    // this.settings will be overwritten with the stored version

    this.state = {
      isReadying: false,
      isReady: false,

      isInteractiveEnabled: false,
      isAnalyzingPosition: false,
      isAnalyzingGame: false,
      isAnalyzingBranch: false,
      isRunning: false,
      startTime: null,
      progress: null,
      analyzingPly: null,
      timer: null,
      time: null,
      nodes: null,
      nps: null,
      tps: null,
      nextTPS: null,

      gameID: null,
      halfKomi: null,
      size: null,
      ...state,
    };

    this.positions = {};
    this.autoSavedPositions = {};
    this.log = [];
  }

  //#region send/receive
  onSend(message) {
    if (this.settings.enableLogging) {
      this.logMessage(message);
    }
  }
  onReceive(message) {
    if (this.settings.enableLogging) {
      this.logMessage(message, true);
    }
  }

  logMessage(message, received = false) {
    if (isObject(message)) {
      message = JSON.stringify(message);
    }
    message = Object.freeze({ message, received });
    if (store.state.analysis) {
      store.commit("analysis/BOT_LOG", { botID: this.id, message });
    } else {
      this.log.push(message);
    }
  }

  clearLog() {
    if (store.state.analysis) {
      store.commit("analysis/CLEAR_BOT_LOG", this.id);
    } else {
      this.log = [];
    }
  }

  //#region Setters
  setMeta(meta) {
    if (store.state.analysis) {
      store.commit("analysis/SET_BOT_META", { botID: this.id, changes: meta });
    } else {
      Object.assign(this.meta, meta);
    }
  }

  setState(state) {
    // Auto-advance logic for game analysis
    if (state.analyzingPly && this.state.analyzingPly !== state.analyzingPly) {
      const currentTPS = store.state.game.position.tps;
      // Use tpsBefore since we show the position before the ply is done (isDone: false)
      const previousAnalyzingTPS =
        this.state.analyzingPly && this.state.analyzingPly.tpsBefore;
      const newAnalyzingTPS = state.analyzingPly.tpsBefore;

      // Check if current position matches the previous analyzing position
      // (or if there's no previous position, like on the first ply)
      // and we're moving forward in the analysis
      // Only auto-follow if this bot is selected in the toolbar
      const analysisState = store.state.analysis;
      const isSelectedInToolbar =
        analysisState && analysisState.botID === this.id;
      const shouldAutoFollowSource =
        analysisState &&
        (!analysisState.preferSavedResults ||
          analysisState.analysisSource === "saved");
      if (
        isSelectedInToolbar &&
        shouldAutoFollowSource &&
        (previousAnalyzingTPS === currentTPS ||
          previousAnalyzingTPS === null) &&
        (this.state.isAnalyzingGame || this.state.isAnalyzingBranch) &&
        state.analyzingPly.id >
          (this.state.analyzingPly && this.state.analyzingPly.id
            ? this.state.analyzingPly.id
            : -1)
      ) {
        // Auto-advance to the next ply
        store.dispatch("game/GO_TO_PLY", {
          plyID: state.analyzingPly.id,
          isDone: false,
        });
      }
    }

    if (store.state.analysis) {
      store.commit("analysis/SET_BOT_STATE", {
        botID: this.id,
        changes: state,
      });
    } else {
      Object.assign(this.state, state);
    }
  }

  setPosition(tps, suggestions) {
    if (store.state.analysis) {
      store.commit("analysis/SET_BOT_POSITION", {
        botID: this.id,
        tps,
        suggestions,
      });
    } else {
      this.positions[tps] = suggestions;
    }
  }

  //#region Getters

  get listOption() {
    return {
      value: this.id,
      label: this.label,
      description: this.description,
      icon: this.icon,
      isCustom: this.meta.isCustom || false,
    };
  }

  get concurrency() {
    return this.settings.concurrency || this.meta.concurrency || 1;
  }

  get game() {
    return store.state.game;
  }

  // Detect PV format from existing comments
  // Returns "new" if any comment uses pv> format
  // Returns "old" if any comment uses pv format (without >)
  // Returns null if no PV comments exist
  // Select this bot in the toolbar analysis
  selectInToolbar({ preserveSource = false } = {}) {
    // If saved results are currently selected, try to switch to the active
    // engine matching the saved bot name (so analysis uses the associated engine)
    if (store.state.analysis.preferSavedResults) {
      const savedBotName = store.state.analysis.savedBotName;
      if (savedBotName) {
        const activeBots = store.state.analysis.activeBots || [];
        const { bots: allBots } = require("./index");
        for (const id of activeBots) {
          const bot = allBots[id];
          if (bot && bot.label === savedBotName) {
            store.dispatch("analysis/SET", ["botID", id]);
            break;
          }
        }
      }
    }
    if (!preserveSource) {
      store.dispatch("analysis/SET", ["preferSavedResults", false]);
      store.dispatch("analysis/SET", ["analysisSource", "engines"]);
    }
  }

  get pvFormat() {
    const notes = this.game.comments?.notes;
    if (!notes) return null;
    for (const plyID in notes) {
      for (const note of notes[plyID]) {
        if (note.pvAfter !== null) {
          return "new";
        }
        if (note.pv !== null) {
          return "old";
        }
      }
    }
    return null;
  }

  get size() {
    return this.game.config.size;
  }

  get komi() {
    return this.game.config.komi;
  }

  get halfKomi() {
    return this.game.config.komi * 2;
  }

  getPlies(all = true) {
    return all ? this.game.ptn.allPlies : this.game.ptn.branchPlies;
  }

  getPositionsToAnalyze(all = true, pliesOverride = null, options = {}) {
    const pliesSource = pliesOverride || this.getPlies(all);
    const plies = pliesSource;
    const shouldAnalyzePosition = options.shouldAnalyzePosition;

    let positions = plies.map((ply) => ({
      tps: ply.tpsBefore,
      plyID: ply.id,
    }));
    plies.forEach((ply) => {
      if (!ply.result || ply.result.type === "1") {
        positions.push({ tps: ply.tpsAfter, plyID: ply.id });
      }
    });
    const hash = this.getSettingsHash();
    let timeLimit = false;
    let nodeLimit = false;
    if (
      !this.settings.limitTypes ||
      this.settings.limitTypes.includes("movetime")
    ) {
      timeLimit = this.settings.movetime || false;
    }
    if (
      !this.settings.limitTypes ||
      this.settings.limitTypes.includes("nodes")
    ) {
      nodeLimit = this.settings.nodes || false;
    }
    positions = uniqBy(positions, (p) => p.tps).filter((p) => {
      if (
        typeof shouldAnalyzePosition === "function" &&
        !shouldAnalyzePosition(p)
      ) {
        return false;
      }

      // Skip if position is in memory with matching settings (unsaved results)
      return (
        !(p.tps in this.positions) ||
        this.positions[p.tps][0].hash !== hash ||
        (nodeLimit && this.positions[p.tps][0].nodes < nodeLimit * 0.5) ||
        (timeLimit && this.positions[p.tps][0].time < timeLimit * 0.5)
      );
    });

    return positions;
  }

  //#region getSupportedHalfKomi
  getSupportedHalfKomi() {
    const size = this.size;
    const halfKomi = this.halfKomi;
    if (
      size in this.meta.sizeHalfKomis &&
      !this.meta.sizeHalfKomis[size].includes(halfKomi)
    ) {
      return this.meta.sizeHalfKomis[size].reduce((prev, curr) => {
        return Math.abs(curr - halfKomi) < Math.abs(prev - halfKomi)
          ? curr
          : prev;
      }, this.meta.sizeHalfKomis[size][0]);
    }
    return halfKomi;
  }

  get openingSwap() {
    return this.game.config.openingSwap;
  }

  get openingDoubleBlackStack() {
    return this.game.config.openingDoubleBlackStack;
  }

  get tps() {
    return this.game.position.tps;
  }

  get ply() {
    return this.game.position.boardPly
      ? this.game.ptn.allPlies[this.game.position.boardPly.id]
      : null;
  }

  get plies() {
    return store.state.ui.showAllBranches
      ? this.game.ptn.allPlies
      : this.game.ptn.branchPlies;
  }

  getPrecedingPlies(plyID, isDone) {
    return store.getters["game/precedingPlies"](plyID, isDone);
  }

  get isGameEnd() {
    return this.game.position.isGameEnd && !this.game.position.isGameEndDefault;
  }

  get isAnalyzeGameAvailable() {
    return (
      this.state.isReady &&
      !this.state.isAnalyzingPosition &&
      !this.state.isAnalyzingGame &&
      !this.state.isAnalyzingBranch &&
      !this.state.isInteractiveEnabled &&
      this.plies.length > 0
    );
  }

  get isAnalyzePositionAvailable() {
    return (
      !this.isGameEnd &&
      this.state.isReady &&
      !this.state.isAnalyzingGame &&
      !this.state.isAnalyzingBranch &&
      !this.state.isInteractiveEnabled
    );
  }

  get isInteractiveAvailable() {
    return (
      this.state.isInteractiveEnabled ||
      (this.meta.isInteractive &&
        !this.isGameEnd &&
        this.state.isReady &&
        !this.state.isAnalyzingGame &&
        !this.state.isAnalyzingBranch &&
        !this.state.isAnalyzingPosition)
    );
  }

  getInitTPS() {
    return this.game.ptn.tags.tps ? this.game.ptn.tags.tps.text : null;
  }

  getSettingsHash() {
    return hashObject(this.settings);
  }

  //#region Options

  get hasOptions() {
    return Object.keys(this.meta.options).length > 0;
  }

  sendAction(name) {}

  applyOptions() {}

  getOptions() {
    const optionValues = {};
    const settingsOptions = this.settings.options || {};
    forEach(this.meta.options, (option, name) => {
      const exactMatch =
        settingsOptions &&
        Object.prototype.hasOwnProperty.call(settingsOptions, name)
          ? name
          : null;
      const caseInsensitiveMatch =
        !exactMatch && settingsOptions
          ? Object.keys(settingsOptions).find(
              (key) => key.toLowerCase() === name.toLowerCase()
            )
          : null;
      const matchingKey = exactMatch || caseInsensitiveMatch;
      if (matchingKey) {
        optionValues[name] = settingsOptions[matchingKey];
      } else if ("default" in option) {
        optionValues[name] = option.default;
      }
    });
    return optionValues;
  }

  //#region reset
  // Reset status
  reset() {
    if (this.state.timer) {
      clearInterval(this.state.timer);
    }
    this.isInteractiveEnabled = false;
    this.onReady = null;
    this.onReady = null;
    this.onComplete = null;
    this.unwatchPosition = null;
    this.unwatchScrubbing = null;
    this.autoSavedPositions = {};
    this.setState({
      isReadying: false,
      isReady: false,
      gameID: null,
      size: null,
      halfKomi: null,
      nextTPS: null,
      tps: null,
      timer: null,
    });
  }

  //#region terminate
  // Stop searching
  terminate(state) {
    this.onTerminate(state);
  }

  onTerminate(state = {}) {
    // Auto-save when ending infinite position analysis or interactive analysis
    const wasAnalyzingPosition = this.state.isAnalyzingPosition;
    const wasAnalyzingGame = this.state.isAnalyzingGame;
    const wasAnalyzingBranch = this.state.isAnalyzingBranch;
    const wasInteractive =
      this.state.isInteractiveEnabled && state.isInteractiveEnabled === false;
    const tps = this.state.tps;

    state = {
      ...state,
      isAnalyzingGame: false,
      isAnalyzingBranch: false,
      isAnalyzingPosition: false,
      progress: null,
      nextTPS: null,
    };
    this.onSearchEnd(state);

    if (
      wasAnalyzingPosition ||
      wasInteractive ||
      wasAnalyzingGame ||
      wasAnalyzingBranch
    ) {
      if (wasInteractive || wasAnalyzingGame || wasAnalyzingBranch) {
        this.autoSaveEvalComments(null, "completion");
      } else if (tps) {
        this.autoSaveEvalComments(tps, "completion");
      }
    }

    this.onReady = null;
    this.onComplete = null;
  }

  //#region clearResults
  clearResults() {
    this.positions = {};
    this.autoSavedPositions = {};
    if (store.state.analysis) {
      store.commit("analysis/CLEAR_BOT_POSITIONS", this.id);
    }
    this.setState({ time: 0, nps: 0 });
  }

  clearSavedResults() {
    store.dispatch("game/REMOVE_ANALYSIS_NOTES");
  }

  //#region validatePosition
  validatePosition(tps, plyID) {
    let init = {
      isNewGame: false,
      halfKomi: this.halfKomi,
    };

    if (
      !tps ||
      (this.game.ptn.allPlies.length &&
        (!isNumber(plyID) || !(plyID in this.game.ptn.allPlies)))
    ) {
      // Validate arguments
      throw "Invalid search parameters";
    } else if (
      // Validate board size
      !isEmpty(this.meta.sizeHalfKomis) &&
      !(this.size in this.meta.sizeHalfKomis)
    ) {
      throw "Unsupported size";
    } else {
      // Get closest supported komi
      const halfKomi = this.halfKomi;
      const usingHalfKomi = this.getSupportedHalfKomi();
      init.halfKomi = usingHalfKomi;
      if (
        this.state.gameID !== this.game.name ||
        this.state.size !== this.size ||
        this.state.halfKomi !== halfKomi
      ) {
        // This is a new game
        init.isNewGame = true;
        this.setState({
          gameID: this.game.name,
          size: this.size,
          halfKomi: halfKomi,
        });

        if (halfKomi !== usingHalfKomi) {
          this.onWarning(
            i18n.t("warning.unsupportedKomi", {
              komi: this.komi,
              usingKomi: usingHalfKomi / 2,
            })
          );
        }
      }
    }

    return init;
  }

  async searchPosition(size, halfKomi, tps, plyID, isNewGame) {}

  //#region onSearchStart
  onSearchStart(state = {}) {
    state = {
      ...state,
      isRunning: true,
      nodes: 0,
    };

    let timeLimit = false;
    let nodeLimit = false;
    if (state.isAnalyzingPosition) {
      if (
        !this.settings.limitTypes ||
        this.settings.limitTypes.includes("movetime")
      ) {
        timeLimit = this.settings.movetime || false;
      }
      if (
        !this.settings.limitTypes ||
        this.settings.limitTypes.includes("nodes")
      ) {
        nodeLimit = this.settings.nodes || false;
      }
    }

    if (this.state.timer) {
      clearInterval(this.state.timer);
    }
    state.timer = setInterval(() => {
      const state = {
        time: new Date().getTime() - this.state.startTime,
      };
      if (timeLimit || nodeLimit) {
        let timeProgress = 0;
        let nodeProgress = 0;
        if (timeLimit) {
          timeProgress = (100 * state.time) / timeLimit;
        }
        if (nodeLimit && this.state.nps) {
          nodeProgress = state.time / ((10 * nodeLimit) / this.state.nps);
        }
        state.progress = Math.max(timeProgress, nodeProgress);
      }
      this.setState(state);
    }, 250);

    this.setState(state);
  }

  //#region onSearchEnd
  onSearchEnd(state = {}) {
    state = {
      ...state,
      isRunning: false,
      analyzingPly: null,
    };
    if (this.state.timer) {
      clearInterval(this.state.timer);
      state.timer = null;
    }
    this.setState(state);
  }

  autoSaveEvalComments(tps = null, trigger = "position") {
    const analysis = store.state.analysis;
    if (!analysis) {
      return;
    }

    const isEachPositionSave = trigger === "position";
    const isCompletionSave = trigger === "completion";
    if (
      (isEachPositionSave && !analysis.autoSaveEachPosition) ||
      (isCompletionSave && !analysis.autoSaveOnSearchComplete)
    ) {
      return;
    }

    if (isString(tps) && tps.length) {
      const position = this.positions[tps];
      if (position && position.length > 0) {
        const firstResult = position[0] || null;
        const startTime =
          firstResult && isNumber(firstResult.startTime)
            ? firstResult.startTime
            : null;

        if (startTime !== null && this.autoSavedPositions[tps] === startTime) {
          return;
        }

        this.saveEvalComments(tps, {
          immediateSave: isCompletionSave,
        });

        if (startTime !== null) {
          this.autoSavedPositions[tps] = startTime;
        }
      }
      return;
    }

    this.saveEvalComments(null, {
      immediateSave: isCompletionSave,
    });
  }

  //#region isInteractiveEnabled
  get isInteractiveEnabled() {
    return this.state.isInteractiveEnabled;
  }
  set isInteractiveEnabled(isInteractiveEnabled) {
    if (
      !this.meta.isInteractive ||
      this.state.isInteractiveEnabled === isInteractiveEnabled
    ) {
      return;
    }
    if (isInteractiveEnabled) {
      // Select this bot in the toolbar. Keep saved-results selected only when
      // autosave-per-position is enabled; otherwise switch to live results for
      // this engine so the user sees the ongoing analysis.
      const analysisState = store.state.analysis;
      const preserveSource = !!(
        analysisState &&
        analysisState.analysisSource === "saved" &&
        analysisState.autoSaveEachPosition
      );
      this.selectInToolbar({ preserveSource });
      // Enable
      this.setState({
        isInteractiveEnabled,
        tps: null,
        nextTPS: null,
        progress: null,
        nodes: 0,
        nps: 0,
      });
      // Restart search when the position changes
      this.unwatchPosition = store.watch(
        (state) => state.game.position.tps,
        () => {
          if (!store.state.ui.scrubbing) {
            this.analyzeInteractive();
          }
        }
      );
      // Pause while scrubbing, resume after
      this.unwatchScrubbing = store.watch(
        (state) => state.ui.scrubbing,
        (isScrubbing) => {
          if (isScrubbing) {
            this.terminate();
          } else if (this.isInteractiveEnabled) {
            this.analyzeInteractive();
          }
        }
      );
      // Start searching
      this.analyzeInteractive();
    } else {
      // Disable
      if (this.unwatchPosition) {
        this.unwatchPosition();
        this.unwatchPosition = null;
      }
      if (this.unwatchScrubbing) {
        this.unwatchScrubbing();
        this.unwatchScrubbing = null;
      }
      this.terminate({ isInteractiveEnabled });
    }
  }

  //#region analyzeInteractive
  async analyzeInteractive() {
    try {
      if (!this.meta.isInteractive) {
        throw new Error("Interactive mode unsupported");
      }

      // Stop searching but keep interactive mode enabled
      if (this.isGameEnd) {
        this.onSearchEnd({ nextTPS: null });
        return true;
      }

      const tps = this.tps;
      const plyID = this.game.position.boardPly
        ? this.game.position.boardPly.id
        : null;

      // Validate position
      const init = this.validatePosition(tps, plyID);

      const state = {
        startTime: new Date().getTime(),
        nextTPS: tps,
        analyzingPly: this.ply,
        isRunning: true,
      };
      if (!this.state.tps) {
        state.tps = tps;
      }
      this.onSearchStart(state);
      return this.searchPosition(
        this.size,
        init.halfKomi,
        tps,
        plyID,
        init.isNewGame
      );
    } catch (error) {
      if (error) {
        this.onError(error);
      }
      if (this.unwatchPosition) {
        this.unwatchPosition();
        this.unwatchPosition = null;
      }
      if (this.unwatchScrubbing) {
        this.unwatchScrubbing();
        this.unwatchScrubbing = null;
      }
      this.onSearchEnd({ isInteractiveEnabled: false });
    }
  }

  //#region analyzeCurrentPosition
  async analyzeCurrentPosition() {
    return new Promise(async (resolve, reject) => {
      try {
        if (this.state.isRunning) {
          throw "";
        }
        if (this.isGameEnd) {
          throw "";
        }

        // Select this bot in the toolbar. Keep saved-results selected only when
        // autosave-per-position is enabled; otherwise switch to live results for
        // this engine so the user sees the ongoing analysis.
        const analysisStateForSelect = store.state.analysis;
        const preserveSource = !!(
          analysisStateForSelect &&
          analysisStateForSelect.analysisSource === "saved" &&
          analysisStateForSelect.autoSaveEachPosition
        );
        this.selectInToolbar({ preserveSource });

        const tps = this.tps;
        const plyID = this.game.position.boardPly
          ? this.game.position.boardPly.id
          : null;

        // Validate position
        const init = this.validatePosition(tps, plyID);

        const ply = this.ply;
        this.onSearchStart({
          tps,
          analyzingPly: ply,
          isAnalyzingPosition: true,
          startTime: new Date().getTime(),
          progress: null,
          nodes: 0,
          nps: 0,
        });

        const results = await this.searchPosition(
          this.size,
          init.halfKomi,
          tps,
          plyID,
          init.isNewGame
        );

        this.onSearchEnd({
          isAnalyzingPosition: false,
        });
        if (results) {
          this.storeResults(results);
          this.autoSaveEvalComments(tps, "completion");
          resolve(results);
          return results;
        } else {
          reject();
          return false;
        }
      } catch (error) {
        if (error) {
          this.onError(error);
        }
        reject(error);
      }
    });
  }

  //#region analyzeGame
  async analyzeGame() {
    return this._analyze(true);
  }

  async analyzeBranch() {
    return this._analyze(false);
  }

  async _analyze(all) {
    return new Promise(async (resolve, reject) => {
      try {
        if (this.state.isRunning) {
          throw "";
        }

        const analysisState = store.state.analysis || {};
        // Keep saved-results selected only when autosave-per-position is enabled;
        // otherwise switch to live results for this engine so the user sees the
        // ongoing analysis.
        const preserveSource = !!(
          analysisState.analysisSource === "saved" &&
          analysisState.autoSaveEachPosition
        );

        // Select this bot in the toolbar
        this.selectInToolbar({ preserveSource });

        // Validate
        const init = this.validatePosition(this.tps, 0);

        const size = this.size;
        const concurrency = this.concurrency;

        // For branch analysis, start at the first ply of the current branch
        // (the closest branch point) if on a branch, or the beginning of the
        // main branch otherwise. No looping past the end.
        let analysisBranch = "";
        if (!all) {
          const currentPly = this.ply;
          analysisBranch = currentPly ? currentPly.branch : "";
        }
        const sliceToBranch = (plyList) => {
          if (all || !analysisBranch) {
            return plyList;
          }
          const startIndex = plyList.findIndex(
            (ply) => ply.branch === analysisBranch
          );
          return startIndex > 0 ? plyList.slice(startIndex) : plyList;
        };

        let analysisPlies = sliceToBranch(this.getPlies(all));

        let shouldAnalyzePosition = null;
        const savedBotName = analysisState.savedBotName;
        const shouldFilterBySavedBot =
          preserveSource &&
          savedBotName !== null &&
          savedBotName !== undefined &&
          savedBotName === this.label;
        if (shouldFilterBySavedBot) {
          const getSuggestions = store.getters["game/suggestions"];
          if (getSuggestions) {
            shouldAnalyzePosition = ({ tps, plyID }) => {
              if (!tps) {
                return false;
              }
              const savedSuggestions = getSuggestions(tps, {
                preferredPlyID: plyID,
              }).filter((s) => s.botName === savedBotName);
              return savedSuggestions.length === 0;
            };
          }
        }

        const positions = this.getPositionsToAnalyze(all, analysisPlies, {
          shouldAnalyzePosition,
        });
        const total = analysisPlies.length;

        if (!total) {
          return;
        }

        if (!positions.length) {
          // Abort and notify
          this.onWarning("fullyAnalyzed", {
            actions: [
              {
                icon: "delete_all_outline",
                label: i18n.t("analysis.Clear Bots Unsaved Results"),
                color: "textDark",
                handler: () => {
                  this.clearResults();
                },
              },
              { icon: "close", color: "textDark" },
            ],
          });
          return;
        }

        const runTotal = positions.length;
        let completed = 0;
        const pendingQueue = [];
        const queuedTPS = new Set();
        const attemptedTPS = new Set();

        const enqueuePosition = (position) => {
          if (!position || !position.tps) {
            return;
          }
          if (queuedTPS.has(position.tps) || attemptedTPS.has(position.tps)) {
            return;
          }
          pendingQueue.push(position);
          queuedTPS.add(position.tps);
        };

        const enqueuePositions = (nextPositions) => {
          nextPositions.forEach((position) => enqueuePosition(position));
        };

        enqueuePositions(positions);

        const refreshPendingQueue = () => {
          const latestPlies = sliceToBranch(this.getPlies(all));
          const latestPositions = this.getPositionsToAnalyze(all, latestPlies, {
            shouldAnalyzePosition,
          });
          enqueuePositions(latestPositions);
        };

        const isFullAnalysisActive = () =>
          this.state.isAnalyzingGame || this.state.isAnalyzingBranch;

        this.onSearchStart({
          isRunning: true,
          isAnalyzingGame: all,
          isAnalyzingBranch: !all,
          startTime: new Date().getTime(),
          progress: 0,
          nodes: 0,
          nps: 0,
        });
        while (isFullAnalysisActive()) {
          if (!pendingQueue.length) {
            refreshPendingQueue();
            if (!pendingQueue.length) {
              break;
            }
          }

          const batch = pendingQueue.splice(0, Math.max(1, concurrency));
          batch.forEach((position) => queuedTPS.delete(position.tps));

          await Promise.all(
            batch.map(async (position) => {
              if (!isFullAnalysisActive()) {
                return;
              }

              attemptedTPS.add(position.tps);

              const state = { tps: position.tps };
              if (concurrency === 1) {
                state.analyzingPly = this.game.ptn.allPlies[position.plyID];
              }
              this.setState(state);

              const results = await this.searchPosition(
                size,
                init.halfKomi,
                position.tps,
                position.plyID
              );

              if (results) {
                this.storeResults(results);
                this.autoSaveEvalComments(position.tps, "position");
              }

              const knownTotal = Math.max(
                runTotal,
                attemptedTPS.size + pendingQueue.length
              );
              completed++;
              this.setState({ progress: (100 * completed) / knownTotal });
            })
          );

          refreshPendingQueue();
        }

        // Insert comments if successful and auto-save is enabled
        if (this.state.isAnalyzingGame || this.state.isAnalyzingBranch) {
          this.autoSaveEvalComments(null, "completion");
          resolve();
        } else {
          reject();
        }
      } catch (error) {
        if (error) {
          this.onError(error);
        }
        reject(error);
      } finally {
        this.onSearchEnd({ isAnalyzingGame: false, isAnalyzingBranch: false });
      }
    });
  }

  //#region storeResults
  getConfiguredMultiPvCount() {
    const optionSources = [
      this.settings && this.settings.options,
      this.getOptions(),
    ];

    for (const options of optionSources) {
      if (!options) {
        continue;
      }

      for (const [key, value] of Object.entries(options)) {
        if (key && key.toLowerCase() === "multipv") {
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed > 0) {
            return Math.min(8, Math.max(1, parsed));
          }
        }
      }
    }

    return null;
  }

  dedupeResultsByPly(results = []) {
    const bestBySignature = new Map();
    const bestByFirstMove = new Map();
    const configuredMultiPv = this.getConfiguredMultiPvCount() ?? 1;

    const metric = (value) => (isNumber(value) ? value : -1);
    const compareResults = (a, b) => {
      const depthDiff = metric(a.depth) - metric(b.depth);
      if (depthDiff) {
        return depthDiff;
      }

      const nodesDiff = metric(a.nodes) - metric(b.nodes);
      if (nodesDiff) {
        return nodesDiff;
      }

      const visitsDiff = metric(a.visits) - metric(b.visits);
      if (visitsDiff) {
        return visitsDiff;
      }

      return metric(a.time) - metric(b.time);
    };
    const isResultSuperior = (candidate, current) => {
      return compareResults(candidate, current) > 0;
    };

    results.forEach((result, index) => {
      if (!result) {
        return;
      }

      const firstMove =
        result.ply &&
        (result.ply.text || result.ply.ptn || "").replace(/\*$/, "");
      const followingKey =
        result.followingPlies && result.followingPlies.length
          ? result.followingPlies
              .map((ply) => (ply.ptn || ply.text || "").replace(/\*$/, ""))
              .join(" ")
          : "";
      const signature = `${firstMove}|${followingKey}`;

      const existingBySignature = bestBySignature.get(signature);
      if (!existingBySignature) {
        bestBySignature.set(signature, {
          result,
          order: index,
          firstMove,
          signature,
        });
      } else if (isResultSuperior(result, existingBySignature.result)) {
        bestBySignature.set(signature, {
          ...existingBySignature,
          result,
        });
      }
    });

    const uniqueCandidates = Array.from(bestBySignature.values()).sort(
      (a, b) => a.order - b.order
    );

    uniqueCandidates.forEach((candidate) => {
      const firstMoveKey = candidate.firstMove || `__${candidate.signature}`;

      const existing = bestByFirstMove.get(firstMoveKey);
      if (!existing) {
        bestByFirstMove.set(firstMoveKey, candidate);
        return;
      }

      if (!isResultSuperior(candidate.result, existing.result)) {
        return;
      }

      bestByFirstMove.set(firstMoveKey, {
        ...candidate,
        order: existing.order,
      });
    });

    const selected = Array.from(bestByFirstMove.values()).sort(
      (a, b) => a.order - b.order
    );

    if (selected.length < configuredMultiPv) {
      const selectedSignatures = new Set(
        selected.map(({ signature }) => signature)
      );
      const backupCandidates = uniqueCandidates
        .filter(({ signature }) => !selectedSignatures.has(signature))
        .sort((a, b) => {
          const qualityDiff = compareResults(b.result, a.result);
          if (qualityDiff) {
            return qualityDiff;
          }
          return a.order - b.order;
        });

      while (selected.length < configuredMultiPv && backupCandidates.length) {
        selected.push(backupCandidates.shift());
      }
    }

    if (selected.length > configuredMultiPv) {
      selected.length = configuredMultiPv;
    }

    return selected.map(({ result }) => result);
  }

  storeResults({
    tps,
    nps = null,
    string = "",
    error = "",
    suggestions = [],
    // suggestion: {
    //   pv,
    //   time = null,
    //   depth = null,
    //   nodes = null,
    //   visits = null,
    //   evaluation = null,
    //   scoreText = null,
    // },
  }) {
    if (string) {
      this.onInfo(string);
    }
    if (error) {
      this.onError(error);
    }

    if (!tps) {
      console.warn("Failed to store results: missing tps");
      return;
    }

    const startTime = this.state.startTime;
    const hash = this.getSettingsHash();

    // Determine ply colors
    const [initialPlayer, moveNumber] = tps.split(" ").slice(1).map(Number);
    const isFirstMove = moveNumber === 1 && !bothPlayersHaveFlats(tps);
    const initialColor =
      this.openingSwap && isFirstMove
        ? initialPlayer == 1
          ? 2
          : 1
        : initialPlayer;

    // Parse results
    const results = [];
    suggestions.forEach((suggestion) => {
      // Null suggestions are placeholders for slots that shouldn't be updated
      if (suggestion === null) {
        results.push(null);
        return;
      }
      let {
        pv = null,
        time = null,
        depth = null,
        nodes = null,
        visits = null,
        evaluation = null,
        wdl = null,
        rawCp = null,
        scoreText = null,
      } = suggestion;
      let player = initialPlayer;
      let color = initialColor;
      const result = {};
      if (pv !== null) {
        pv = parsePV(player, color, pv);
        result.ply = pv.splice(0, 1)[0];
        result.followingPlies = pv;
      }
      if (time !== null) {
        result.time = time;
      }
      if (depth !== null) {
        result.depth = depth;
      }
      if (nodes !== null) {
        result.nodes = nodes;
      }
      if (visits !== null) {
        result.visits = visits;
      }
      const hasTerminalScore =
        scoreText !== null && /^(T|W|L|R|F|D)/.test(String(scoreText));
      if (evaluation !== null) {
        result.evaluation = hasTerminalScore
          ? evaluation
          : this.normalizeEvaluation(evaluation);
      }
      if (wdl !== null) {
        result.wdl = wdl;
      }
      if (rawCp !== null) {
        result.rawCp = rawCp;
      } else if (hasTerminalScore && evaluation !== null) {
        result.rawCp = evaluation;
      }
      if (scoreText !== null) {
        result.scoreText = scoreText;
      }
      if (!isEmpty(result)) {
        result.startTime = startTime;
        result.hash = hash;
        result.botName = this.label;
        results.push(result);
      } else {
        results.push(null);
      }
    });

    // Update nodes and nps
    const state = {};
    const firstResult = results.find((r) => r !== null);
    if (firstResult && firstResult.nodes !== null) {
      state.nodes = firstResult.nodes;
    }
    if (nps === null && state.nodes && firstResult && firstResult.time) {
      nps = state.nodes / (firstResult.time / 1000);
    }
    if (nps !== null) {
      state.nps = nps;
    }
    if (!isEmpty(state)) {
      this.setState(state);
    }

    // Store results
    const existingResults = this.positions[tps];
    const isSameSearch =
      existingResults && existingResults[0].startTime === startTime;

    if (isSameSearch) {
      // Merge by first move - replace existing entry for the same first move,
      // or append if it's a new move. This avoids duplicates when the engine
      // re-ranks moves across successive update batches.
      const getFirstMove = (r) =>
        r && r.ply ? (r.ply.text || r.ply.ptn || "").replace(/\*$/, "") : "";
      const metric = (value) => (isNumber(value) ? value : -1);
      const isResultSuperior = (candidate, current) => {
        const depthDiff = metric(candidate.depth) - metric(current.depth);
        if (depthDiff) return depthDiff > 0;
        const nodesDiff = metric(candidate.nodes) - metric(current.nodes);
        if (nodesDiff) return nodesDiff > 0;
        const visitsDiff = metric(candidate.visits) - metric(current.visits);
        if (visitsDiff) return visitsDiff > 0;
        return metric(candidate.time) > metric(current.time);
      };
      // Build a map of existing results keyed by first move for O(1) lookup
      const existingByFirstMove = new Map();
      existingResults.forEach((r) => {
        if (!r) return;
        const key = getFirstMove(r);
        if (key !== null && !existingByFirstMove.has(key)) {
          existingByFirstMove.set(key, r);
        }
      });
      // Index-based merge: null entries in results mean "keep existing at
      // this index". This preserves multipv slot positions when partial
      // updates arrive (e.g. only some PVs flushed in a batch).
      const seenKeys = new Set();
      const merged = [];
      const maxLen = Math.max(results.length, existingResults.length);
      for (let idx = 0; idx < maxLen; idx++) {
        const incoming = idx < results.length ? results[idx] : null;
        const existing =
          idx < existingResults.length ? existingResults[idx] : null;
        if (incoming !== null) {
          const key = getFirstMove(incoming);
          if (key) seenKeys.add(key);
          const existingForKey = key ? existingByFirstMove.get(key) : null;
          if (existingForKey && !isResultSuperior(incoming, existingForKey)) {
            merged.push(existingForKey);
          } else {
            merged.push(incoming);
          }
        } else if (existing !== null) {
          const key = getFirstMove(existing);
          if (!key || !seenKeys.has(key)) {
            if (key) seenKeys.add(key);
            merged.push(existing);
          }
        }
      }
      // Append existing entries for moves not covered by the index merge
      existingResults.forEach((r) => {
        if (!r) return;
        const key = getFirstMove(r);
        if (key && !seenKeys.has(key)) {
          merged.push(r);
        }
      });
      // If this was a bestmove-only call (no depth/nodes in incoming batch),
      // stamp the max nodes/time from the merged set onto all entries so that
      // all multipv rows show the same final node count instead of the count
      // from each move's last individual info line.
      const isBestmoveOnly = results.every(
        (r) => r === null || (r.depth === null && r.nodes === null)
      );
      if (isBestmoveOnly) {
        const maxNodes = merged.reduce(
          (m, r) => (r && r.nodes != null ? Math.max(m, r.nodes) : m),
          0
        );
        const maxTime = merged.reduce(
          (m, r) => (r && r.time != null ? Math.max(m, r.time) : m),
          0
        );
        if (maxNodes > 0) {
          merged.forEach((r, i) => {
            if (r && r.nodes !== maxNodes) {
              merged[i] = { ...r, nodes: maxNodes };
            }
          });
        }
        if (maxTime > 0) {
          merged.forEach((r, i) => {
            if (r && r.time !== maxTime) {
              merged[i] = { ...r, time: maxTime };
            }
          });
        }
      }
      this.setPosition(tps, deepFreeze(this.dedupeResultsByPly(merged)));
    } else {
      const firstResult = results.find((r) => r !== null);
      if (
        !this.positions[tps] ||
        this.positions[tps][0].hash !== hash ||
        (firstResult && this.positions[tps][0].nodes < firstResult.nodes)
      ) {
        // Don't overwrite deeper searches for this position unless settings have changed
        this.setPosition(tps, deepFreeze(this.dedupeResultsByPly(results)));
      }
    }
  }

  //#region Formatting

  plyHasEvalComment(ply) {
    return (
      ply.id in this.game.comments.notes &&
      this.game.comments.notes[ply.id].some(
        (comment) => comment.evaluation !== null
      )
    );
  }

  sigmoid(value, sigma = 100) {
    return 100 * (2 * (1 / (1 + Math.exp(-value / (sigma || 1)))) - 1);
  }

  normalizeEvaluation(value) {
    return this.sigmoid(value, 50);
  }

  formatEvaluation(value) {
    formatEvaluation(value);
  }

  formatEvalComments(
    ply,
    pvLimit = 0,
    saveSearchStats = false,
    pvsToSave = 1,
    useNewFormat = true,
    evalMark = null
  ) {
    let comments = [];
    let positionBefore = this.positions[ply.tpsBefore];
    let positionAfter = this.positions[ply.tpsAfter];
    const hasPositionBeforeEval =
      positionBefore &&
      positionBefore[0] &&
      positionBefore[0].evaluation !== null &&
      positionBefore[0].evaluation !== undefined;
    const hasPositionAfterEval =
      positionAfter &&
      positionAfter[0] &&
      positionAfter[0].evaluation !== null &&
      positionAfter[0].evaluation !== undefined;
    let evaluationBefore = null;
    let evaluationAfter = null;

    // Get evaluationBefore from existing eval comment of previous ply
    let prevPly = this.plies.find(
      (prevPly) => prevPly.tpsAfter === ply.tpsBefore
    );
    if (prevPly && prevPly.id in this.game.comments.notes) {
      for (let i = 0; i < this.game.comments.notes[prevPly.id].length; i++) {
        evaluationBefore = this.game.comments.notes[prevPly.id][i].evaluation;
        if (evaluationBefore !== null) {
          break;
        }
      }
    }

    // Calculate evaluationAfter if we have position data
    if (hasPositionAfterEval) {
      evaluationAfter =
        evaluationAfter !== null
          ? evaluationAfter
          : Math.round(100 * positionAfter[0].evaluation) / 1e4;
    } else if (evaluationAfter !== null) {
      evaluationAfter = Math.round(100 * evaluationAfter) / 1e4;
    }

    // Helper to format eval+stats comment
    const formatEvalStats = (evaluation, position, includeEvalMark = false) => {
      let comment = "";
      // Use botName from stored position data
      if (position && position.botName) {
        comment += `name:"${position.botName.replace(/"/g, '\\"')}" `;
      }
      // Include eval mark (saved permanently in the comment)
      if (includeEvalMark && evalMark) {
        comment += `${evalMark} `;
      }
      if (
        position &&
        isObject(position.wdl) &&
        position.wdl.player1 !== undefined &&
        position.wdl.draw !== undefined &&
        position.wdl.player2 !== undefined
      ) {
        comment += `wdl:${position.wdl.player1},${position.wdl.draw},${position.wdl.player2} `;
      }
      if (position && position.rawCp !== null && position.rawCp !== undefined) {
        comment += `cp:${position.rawCp} `;
      }
      if (position && position.scoreText) {
        comment += `score:${position.scoreText} `;
      }
      if (evaluation !== null && !isNaN(evaluation)) {
        comment += `${evaluation >= 0 ? "+" : ""}${evaluation}`;
      }
      if (saveSearchStats && position) {
        if (position.depth !== null && position.depth !== undefined) {
          comment += `/${position.depth}`;
        }
        if (position.nodes !== null && position.nodes !== undefined) {
          comment += ` ${position.nodes} nodes`;
        }
        if (position.visits !== null && position.visits !== undefined) {
          comment += ` ${position.visits} visits`;
        }
        if (position.time !== null && position.time !== undefined) {
          comment += ` ${position.time}ms`;
        }
      }
      return comment;
    };

    // Check if ply already has analysis notes (eval, pv, or pvAfter)
    // Used to prevent duplicate eval marks, but allow multiple bot analyses
    const hasExistingAnalysisNotes =
      ply.id in this.game.comments.notes &&
      this.game.comments.notes[ply.id].some(
        (note) =>
          note.evaluation !== null ||
          note.wdl !== null ||
          note.rawCp !== null ||
          note.scoreText !== null ||
          note.pv !== null ||
          note.pvAfter !== null
      );

    // Always add analysis notes (allows multiple bots to contribute)
    {
      if (useNewFormat) {
        // New format: unified comments with pv> for position after this ply
        // Each PV gets its own comment with eval+stats+pv
        // Eval mark is only included in the first PV comment
        if (positionAfter && pvLimit > 0) {
          const numPVs = Math.min(pvsToSave, positionAfter.length);
          for (let pvIndex = 0; pvIndex < numPVs; pvIndex++) {
            let position = positionAfter[pvIndex];

            // Use position-specific eval if available, else first
            const posEval =
              position &&
              position.evaluation !== null &&
              position.evaluation !== undefined
                ? Math.round(100 * position.evaluation) / 1e4
                : evaluationAfter;

            let unifiedComment = formatEvalStats(
              posEval,
              position,
              pvIndex === 0
            );

            // Add PV with pv> marker
            if (position && position.ply) {
              const pv = [position.ply, ...position.followingPlies]
                .slice(0, pvLimit)
                .map((p) => p.ptn);
              unifiedComment += ` pv> ${pv.join(" ")}`;
            }

            if (unifiedComment.length) {
              comments.push(unifiedComment.trim());
            }
          }
        } else if (evaluationAfter !== null && !isNaN(evaluationAfter)) {
          // No PV, just eval+stats (include eval mark)
          let evalComment = formatEvalStats(
            evaluationAfter,
            positionAfter && positionAfter[0],
            true
          );
          comments.push(evalComment);
        }
      } else {
        // Old format: separate eval and PV comments
        if (evaluationAfter !== null && !isNaN(evaluationAfter)) {
          let evalComment = formatEvalStats(
            evaluationAfter,
            positionAfter && positionAfter[0],
            true
          );
          comments.push(evalComment);
        }
      }
    }

    // PV for old format only (new format includes PV in unified comments above)
    // Skip if there are existing analysis notes
    if (
      !hasExistingAnalysisNotes &&
      !useNewFormat &&
      positionBefore &&
      pvLimit > 0
    ) {
      const numPVs = Math.min(pvsToSave, positionBefore.length);
      for (let pvIndex = 0; pvIndex < numPVs; pvIndex++) {
        let position = positionBefore[pvIndex];
        if (position && position.ply) {
          const pv = [position.ply, ...position.followingPlies]
            .slice(0, pvLimit)
            .map((ply) => ply.ptn);
          let pvComment = `pv ${pv.join(" ")}`;
          comments.push(pvComment);
        }
      }
    }
    return comments;
  }

  saveEvalComments(tps = null, { immediateSave = false } = {}) {
    const pvLimit = store.state.analysis.pvLimit;
    const pvsToSave = store.state.analysis.pvsToSave || 1;
    const saveSearchStats = store.state.analysis.saveSearchStats;
    const messages = {};
    const botName = this.label;

    // Always use new format when saving
    const useNewFormat = true;
    // Or, use old format only if existing comments use it
    // const useNewFormat = this.pvFormat !== "old";

    // Helper to check if a note is an analysis note from this bot
    const isThisBotAnalysisNote = (note) => {
      if (
        note.evaluation === null &&
        note.wdl === null &&
        note.rawCp === null &&
        note.scoreText === null &&
        note.pv === null &&
        note.pvAfter === null
      ) {
        return false;
      }
      // Only match notes that explicitly have this bot's name
      return note.botName === botName;
    };

    if (isString(tps) && tps.length) {
      // The current TPS corresponds to:
      // - the *positionAfter* of the previous ply (evaluation belongs there)
      // - the *positionBefore* of the next ply (pv belongs there - old format only)
      const prevPly = this.plies.find((p) => p.tpsAfter === tps);
      const nextPly = this.plies.find((p) => p.tpsBefore === tps);

      const pliesToRefresh = [];
      if (prevPly) {
        pliesToRefresh.push(prevPly);
      }

      const nextPositionAfter = nextPly
        ? this.positions[nextPly.tpsAfter]
        : null;
      const hasNextPositionAfter =
        !!nextPositionAfter &&
        Array.isArray(nextPositionAfter) &&
        nextPositionAfter.length > 0;
      if (
        nextPly &&
        hasNextPositionAfter &&
        (!prevPly || prevPly.id !== nextPly.id)
      ) {
        pliesToRefresh.push(nextPly);
      }

      // Check if this is the initial position (before first move)
      // Initial position is when:
      // 1. nextPly is ply 0 and there's no prevPly, OR
      // 2. There are no plies at all (empty game with starting TPS)
      const isInitialPosition =
        (!prevPly && nextPly && nextPly.id === 0) ||
        (!prevPly && !nextPly && this.plies.length === 0);

      pliesToRefresh.forEach((targetPly) => {
        const evalMark = this.calculateEvalMark(targetPly);
        const notes = this.formatEvalComments(
          targetPly,
          pvLimit,
          saveSearchStats,
          pvsToSave,
          useNewFormat,
          evalMark
        );
        if (notes.length) {
          messages[targetPly.id] = notes;
        }
      });

      // For initial position (before first move), save to ply -1
      // This allows analysis comments before the first ply
      if (isInitialPosition) {
        const position = this.positions[tps];
        if (position && position.length > 0) {
          const initialPositionNotes = [];
          const numPVs = Math.min(pvsToSave, position.length);

          for (let pvIndex = 0; pvIndex < numPVs; pvIndex++) {
            const positionData = position[pvIndex];
            if (!positionData) continue;

            let comment = "";

            // Add bot name
            if (positionData.botName) {
              comment += `name:"${positionData.botName.replace(/"/g, '\\"')}" `;
            }

            if (positionData.scoreText) {
              comment += `score:${positionData.scoreText} `;
            }
            if (
              isObject(positionData.wdl) &&
              positionData.wdl.player1 !== undefined &&
              positionData.wdl.draw !== undefined &&
              positionData.wdl.player2 !== undefined
            ) {
              comment += `wdl:${positionData.wdl.player1},${positionData.wdl.draw},${positionData.wdl.player2} `;
            }
            if (
              positionData.rawCp !== null &&
              positionData.rawCp !== undefined
            ) {
              comment += `cp:${positionData.rawCp} `;
            }

            // Add evaluation
            if (
              positionData.evaluation !== null &&
              positionData.evaluation !== undefined
            ) {
              const evalValue = Math.round(100 * positionData.evaluation) / 1e4;
              if (!isNaN(evalValue)) {
                comment += `${evalValue >= 0 ? "+" : ""}${evalValue}`;
              }
            }

            // Add search stats
            if (saveSearchStats) {
              if (
                positionData.depth !== null &&
                positionData.depth !== undefined
              ) {
                comment += `/${positionData.depth}`;
              }
              if (
                positionData.nodes !== null &&
                positionData.nodes !== undefined
              ) {
                comment += ` ${positionData.nodes} nodes`;
              }
              if (
                positionData.visits !== null &&
                positionData.visits !== undefined
              ) {
                comment += ` ${positionData.visits} visits`;
              }
              if (
                positionData.time !== null &&
                positionData.time !== undefined
              ) {
                comment += ` ${positionData.time}ms`;
              }
            }

            // Add PV with pv> marker (new format - represents position after comment)
            if (positionData.ply && pvLimit > 0) {
              const pv = [positionData.ply, ...positionData.followingPlies]
                .slice(0, pvLimit)
                .map((p) => p.ptn);
              comment += ` pv> ${pv.join(" ")}`;
            }

            if (comment.trim().length > 0) {
              initialPositionNotes.push(comment.trim());
            }
          }

          if (initialPositionNotes.length > 0) {
            messages[-1] = initialPositionNotes;
          }
        }
      }
    } else {
      // For full game/branch analysis, add to existing notes (don't remove them)
      // This allows multiple analyses to be saved and combined
      this.plies.forEach((ply) => {
        const notes = [];
        const evalMark = this.calculateEvalMark(ply);
        const evaluations = this.formatEvalComments(
          ply,
          pvLimit,
          saveSearchStats,
          pvsToSave,
          useNewFormat,
          evalMark
        );
        if (evaluations.length) {
          notes.push(...evaluations);
        }
        if (notes.length) {
          messages[ply.id] = notes;
        }
      });

      // Also save initial position analysis to ply -1 if available
      const firstPly = this.plies[0];
      if (firstPly) {
        const initialTPS = firstPly.tpsBefore;
        const position = this.positions[initialTPS];
        if (position && position.length > 0) {
          const initialPositionNotes = [];
          const numPVs = Math.min(pvsToSave, position.length);

          for (let pvIndex = 0; pvIndex < numPVs; pvIndex++) {
            const positionData = position[pvIndex];
            if (!positionData) continue;

            let comment = "";

            // Add bot name
            if (positionData.botName) {
              comment += `name:"${positionData.botName.replace(/"/g, '\\"')}" `;
            }

            if (positionData.scoreText) {
              comment += `score:${positionData.scoreText} `;
            }
            if (
              isObject(positionData.wdl) &&
              positionData.wdl.player1 !== undefined &&
              positionData.wdl.draw !== undefined &&
              positionData.wdl.player2 !== undefined
            ) {
              comment += `wdl:${positionData.wdl.player1},${positionData.wdl.draw},${positionData.wdl.player2} `;
            }
            if (
              positionData.rawCp !== null &&
              positionData.rawCp !== undefined
            ) {
              comment += `cp:${positionData.rawCp} `;
            }

            // Add evaluation
            if (
              positionData.evaluation !== null &&
              positionData.evaluation !== undefined
            ) {
              const evalValue = Math.round(100 * positionData.evaluation) / 1e4;
              if (!isNaN(evalValue)) {
                comment += `${evalValue >= 0 ? "+" : ""}${evalValue}`;
              }
            }

            // Add search stats
            if (saveSearchStats) {
              if (
                positionData.depth !== null &&
                positionData.depth !== undefined
              ) {
                comment += `/${positionData.depth}`;
              }
              if (
                positionData.nodes !== null &&
                positionData.nodes !== undefined
              ) {
                comment += ` ${positionData.nodes} nodes`;
              }
              if (
                positionData.visits !== null &&
                positionData.visits !== undefined
              ) {
                comment += ` ${positionData.visits} visits`;
              }
              if (
                positionData.time !== null &&
                positionData.time !== undefined
              ) {
                comment += ` ${positionData.time}ms`;
              }
            }

            // Add PV with pv> marker (new format)
            if (positionData.ply && pvLimit > 0) {
              const pv = [positionData.ply, ...positionData.followingPlies]
                .slice(0, pvLimit)
                .map((p) => p.ptn);
              comment += ` pv> ${pv.join(" ")}`;
            }

            if (comment.trim().length > 0) {
              initialPositionNotes.push(comment.trim());
            }
          }

          if (initialPositionNotes.length > 0) {
            messages[-1] = initialPositionNotes;
          }
        }
      }
    }

    if (Object.keys(messages).length) {
      // Collect all removals across all plies so we can batch them
      const allRemovals = [];

      // Merge results with same first move and engine, keeping superior ones
      for (const plyIDStr of Object.keys(messages)) {
        const plyID = Number(plyIDStr);
        const existingNotes = this.game.comments.notes[plyID] || [];

        // Find indices of this bot's notes (analysis notes from this bot)
        const botNoteIndices = existingNotes
          .map((note, idx) =>
            isThisBotAnalysisNote(note) ? { idx, note } : null
          )
          .filter((item) => item !== null);

        const newNotes = messages[plyID];

        // Merge results with same first move and engine, keeping superior ones
        const indicesToRemove = [];
        const notesToAdd = [];

        for (const newNote of newNotes) {
          const newFirstMove = this.getFirstMoveFromNote(newNote);
          const newBotName = this.getBotNameFromNote(newNote) || botName;

          // Find existing note with same first move and bot name
          let matchingExisting = null;
          let matchingIdx = -1;

          for (const { idx, note: existingNote } of botNoteIndices) {
            // Skip notes already marked for removal
            if (indicesToRemove.includes(idx)) continue;

            const existingFirstMove = this.getFirstMoveFromNote(
              existingNote.message
            );
            const existingBotName = existingNote.botName || botName;

            if (
              newFirstMove === existingFirstMove &&
              newBotName === existingBotName
            ) {
              matchingExisting = existingNote;
              matchingIdx = idx;
              break;
            }
          }

          if (matchingExisting) {
            // Found matching note - keep superior one
            if (
              this.shouldReplaceForEvalMarkUpgrade(newNote, matchingExisting) ||
              this.isNoteSuperior(newNote, matchingExisting)
            ) {
              indicesToRemove.push(matchingIdx);
              notesToAdd.push(newNote);
            }
            // If existing is superior, don't add new note (skip it)
          } else {
            // No matching note - add as new
            notesToAdd.push(newNote);
          }
        }

        // Calculate remaining count by subtracting removed from original
        const remainingCount = botNoteIndices.length - indicesToRemove.length;
        const slotsAvailable = Math.max(0, pvsToSave - remainingCount);

        // Get first moves of notes that will remain (not removed)
        const remainingFirstMoves = new Set(
          botNoteIndices
            .filter(({ idx }) => !indicesToRemove.includes(idx))
            .map(({ note }) => this.getFirstMoveFromNote(note.message))
        );

        // Filter out notes that would duplicate first moves of remaining notes
        const uniqueNewNotes = notesToAdd.filter((note) => {
          const firstMove = this.getFirstMoveFromNote(note);
          if (remainingFirstMoves.has(firstMove)) {
            return false; // Skip duplicates
          }
          remainingFirstMoves.add(firstMove);
          return true;
        });

        // Add as many new notes as we have slots for
        // If no slots available, replace weakest remaining notes with superior new ones
        if (slotsAvailable >= uniqueNewNotes.length) {
          messages[plyID] = uniqueNewNotes;
        } else {
          const accepted = uniqueNewNotes.slice(0, slotsAvailable);
          const overflow = uniqueNewNotes.slice(slotsAvailable);

          // For overflow notes, try to replace weaker existing notes
          const remainingBotNotes = botNoteIndices
            .filter(({ idx }) => !indicesToRemove.includes(idx))
            .map(({ idx, note }) => ({ idx, note }));

          for (const newNote of overflow) {
            // Find weakest remaining note that is inferior to this new note
            let weakestIdx = -1;
            let weakestNote = null;
            for (const { idx, note: existing } of remainingBotNotes) {
              if (this.isNoteSuperior(newNote, existing)) {
                if (
                  weakestNote === null ||
                  this.isNoteSuperior(
                    weakestNote.message || weakestNote,
                    existing
                  )
                ) {
                  weakestIdx = idx;
                  weakestNote = existing;
                }
              }
            }
            if (weakestIdx >= 0) {
              indicesToRemove.push(weakestIdx);
              // Remove from remaining list
              const rIdx = remainingBotNotes.findIndex(
                (r) => r.idx === weakestIdx
              );
              if (rIdx >= 0) remainingBotNotes.splice(rIdx, 1);
              accepted.push(newNote);
            }
          }

          messages[plyID] = accepted;
        }

        // Collect removals for this ply into the batch
        for (const idx of indicesToRemove) {
          allRemovals.push({ plyID, index: idx });
        }
      }

      // Filter out empty message arrays before dispatching
      const filteredMessages = {};
      for (const [plyID, notes] of Object.entries(messages)) {
        if (notes.length > 0) {
          filteredMessages[plyID] = notes;
        }
      }

      // Use a single atomic operation for removals + additions
      const hasRemovals = allRemovals.length > 0;
      const hasAdditions = Object.keys(filteredMessages).length > 0;
      if (hasRemovals || hasAdditions) {
        if (hasRemovals) {
          store.dispatch("game/REPLACE_NOTES", {
            removals: allRemovals,
            additions: hasAdditions ? filteredMessages : null,
            immediateSave,
          });
        } else {
          store.dispatch("game/ADD_NOTES", {
            messages: filteredMessages,
            immediateSave,
          });
        }
      }
    }
  }

  // Parse stats from a note message using shared Comment.js helpers
  parseNoteStats(message) {
    return {
      nodes: getNodes(message),
      time: getMS(message),
      depth: getDepth(message),
      visits: getVisits(message),
    };
  }

  // Extract the first move from a note message using shared Comment.js helpers
  getFirstMoveFromNote(message) {
    // Try new format first (pv>)
    const pvAfter = getPVAfter(message);
    if (pvAfter && pvAfter[0] && pvAfter[0][0]) {
      return pvAfter[0][0];
    }
    // Fall back to old format (pv or pv=)
    const pv = getPV(message);
    if (pv && pv[0] && pv[0][0]) {
      return pv[0][0];
    }
    return null;
  }

  // Extract bot name from a note message using shared Comment.js helper
  getBotNameFromNote(message) {
    return getBotName(message);
  }

  shouldReplaceForEvalMarkUpgrade(newNote, existingNote) {
    const newEvalMark = getEvalMark(newNote);
    if (!newEvalMark) {
      return false;
    }

    const existingEvalMark =
      existingNote && existingNote.evalMark
        ? existingNote.evalMark
        : getEvalMark(
            typeof existingNote === "string"
              ? existingNote
              : existingNote.message || ""
          );

    return !existingEvalMark;
  }

  // Compare two notes to determine if newNote is superior to existingNote
  isNoteSuperior(newNote, existingNote) {
    const newStats = this.parseNoteStats(newNote);
    const existingStats = this.parseNoteStats(
      typeof existingNote === "string" ? existingNote : existingNote.message
    );

    // Compare by nodes first, then depth, then time
    if (existingStats.nodes !== null && newStats.nodes !== null) {
      return newStats.nodes > existingStats.nodes;
    } else if (existingStats.nodes === null && newStats.nodes !== null) {
      return true;
    } else if (existingStats.depth !== null && newStats.depth !== null) {
      return newStats.depth > existingStats.depth;
    } else if (existingStats.depth === null && newStats.depth !== null) {
      return true;
    } else if (existingStats.time !== null && newStats.time !== null) {
      return newStats.time > existingStats.time;
    } else if (existingStats.time === null && newStats.time !== null) {
      return true;
    }
    return false;
  }

  // Calculate eval mark for a single ply based on bot positions and thresholds
  calculateEvalMark(ply, thresholds = null) {
    if (!thresholds) {
      thresholds =
        store.state.analysis.evalMarkThresholds || defaultEvalMarkThresholds;
    }
    // Delegate to standalone exported function
    return calculateEvalMark(ply, this.positions, thresholds);
  }
}
