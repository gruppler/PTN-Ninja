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
import asyncPool from "tiny-async-pool";
import {
  getBotName,
  getNodes,
  getMS,
  getDepth,
  getVisits,
  getPV,
  getPVAfter,
} from "../Game/PTN/Comment";
import { pliesEqual } from "../Game/PTN/Ply";

export function formatEvaluation(value) {
  return value === null ? null : `+${i18n.n(Math.abs(value), "n0")}%`;
}

export const defaultLimitTypes = deepFreeze({
  depth: { min: 1, max: 100, step: 1 },
  nodes: { min: 1e3, max: 1e9, step: 1e3 },
  movetime: { min: 100, max: 6e4, step: 100 },
});

export const defaultEvalMarkThresholds = deepFreeze({
  brilliant: 0.06,
  good: 0.03,
  bad: -0.1,
  blunder: -0.25,
});

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
    normalizeEvaluation = false,
    sigma = 100,
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
      normalizeEvaluation,
      sigma,
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
      const isSelectedInToolbar =
        store.state.analysis &&
        store.state.analysis.botID === this.id &&
        !store.state.analysis.preferSavedResults;
      if (
        isSelectedInToolbar &&
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
  selectInToolbar() {
    store.dispatch("analysis/SET", ["preferSavedResults", false]);
    store.dispatch("analysis/SET", ["botID", this.id]);
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

  getPositionsToAnalyze(all = true, pliesOverride = null) {
    const pliesSource = pliesOverride || this.getPlies(all);
    const plies = pliesSource;

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
    positions = uniqBy(positions, (p) => p.tps).filter(
      (p) =>
        // Skip if position is in memory with matching settings (unsaved results)
        !(p.tps in this.positions) ||
        this.positions[p.tps][0].hash !== hash ||
        (nodeLimit && this.positions[p.tps][0].nodes < nodeLimit * 0.5) ||
        (timeLimit && this.positions[p.tps][0].time < timeLimit * 0.5)
    );

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
    forEach(this.meta.options, (option, name) => {
      if (this.settings.options && name in this.settings.options) {
        optionValues[name] = this.settings.options[name];
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
    state = {
      ...state,
      isAnalyzingGame: false,
      isAnalyzingBranch: false,
      isAnalyzingPosition: false,
      progress: null,
      nextTPS: null,
    };
    this.onSearchEnd(state);
    this.onReady = null;
    this.onComplete = null;
  }

  //#region clearResults
  clearResults() {
    this.positions = {};
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
      // Select this bot in the toolbar
      this.selectInToolbar();
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

        // Select this bot in the toolbar
        this.selectInToolbar();

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

        // Select this bot in the toolbar
        this.selectInToolbar();

        // Validate
        const init = this.validatePosition(this.tps, 0);

        const size = this.size;
        const concurrency = this.concurrency;

        const plies = this.getPlies(all);
        const analysisPlies = plies;

        const positions = this.getPositionsToAnalyze(all, analysisPlies);
        const total = analysisPlies.length;
        let completed = total - positions.length;

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

        this.onSearchStart({
          isRunning: true,
          isAnalyzingGame: all,
          isAnalyzingBranch: !all,
          startTime: new Date().getTime(),
          progress: (100 * completed) / total,
          nodes: 0,
          nps: 0,
        });
        for await (const result of asyncPool(
          concurrency,
          positions,
          async (position) => {
            if (this.state.isAnalyzingGame || this.state.isAnalyzingBranch) {
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
              }
            }
          }
        )) {
          this.setState({ progress: (100 * ++completed) / total });
        }

        // Insert comments if successful and auto-save is enabled
        if (this.state.isAnalyzingGame || this.state.isAnalyzingBranch) {
          if (store.state.analysis.autoSaveAfterSearch) {
            this.saveEvalComments();
          }
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
    const initialColor =
      this.openingSwap && moveNumber === 1
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
      if (evaluation !== null) {
        result.evaluation = this.normalizeEvaluation(evaluation);
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
      // Merge by slot index - each result updates its corresponding slot
      // Non-multipv results update slot 0, multipv N updates slot N-1
      // Null results are skipped (preserve existing at that slot)
      const merged = [...existingResults];
      results.forEach((result, i) => {
        if (result === null) {
          // Skip null slots - keep existing
          return;
        }
        // Skip if new result is less detailed than existing (e.g., bestmove vs full info)
        if (i < merged.length && merged[i].depth && !result.depth) {
          return;
        }
        if (i < merged.length) {
          merged[i] = result;
        } else {
          merged.push(result);
        }
      });
      this.setPosition(tps, deepFreeze(merged));
    } else {
      const firstResult = results.find((r) => r !== null);
      if (
        !this.positions[tps] ||
        this.positions[tps][0].hash !== hash ||
        (firstResult && this.positions[tps][0].nodes < firstResult.nodes)
      ) {
        // Don't overwrite deeper searches for this position unless settings have changed
        this.setPosition(tps, deepFreeze(results));
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
    if (
      "normalizeEvaluation" in this.settings
        ? this.settings.normalizeEvaluation
        : this.meta.normalizeEvaluation
    ) {
      return this.sigmoid(value, this.settings.sigma || this.meta.sigma);
    }
    return value;
  }

  formatEvaluation(value) {
    formatEvaluation(value);
  }

  formatEvalComments(
    ply,
    pvLimit = 0,
    saveSearchStats = false,
    pvsToSave = 1,
    useNewFormat = true
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

    // Assume evaluationAfter from game result
    if (ply.result && ply.result.type !== "1") {
      evaluationAfter = ply.result.isTie
        ? 0
        : 100 * (ply.result.winner === 1 ? 1 : -1);
    }

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
    const formatEvalStats = (evaluation, position) => {
      let comment = "";
      // Use botName from stored position data
      if (position && position.botName) {
        comment += `name:"${position.botName.replace(/"/g, '\\"')}" `;
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
          note.evaluation !== null || note.pv !== null || note.pvAfter !== null
      );

    // Always add analysis notes (allows multiple bots to contribute)
    {
      if (useNewFormat) {
        // New format: unified comments with pv> for position after this ply
        // Each PV gets its own comment with eval+stats+pv
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

            let unifiedComment = formatEvalStats(posEval, position);

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
          // No PV, just eval+stats
          let evalComment = formatEvalStats(
            evaluationAfter,
            positionAfter && positionAfter[0]
          );
          comments.push(evalComment);
        }
      } else {
        // Old format: separate eval and PV comments
        if (evaluationAfter !== null && !isNaN(evaluationAfter)) {
          let evalComment = formatEvalStats(
            evaluationAfter,
            positionAfter && positionAfter[0]
          );
          comments.push(evalComment);
        }
      }
    }

    // Evaluation marks (requires both positions, and no existing analysis notes)
    // Also skip if there are already eval marks in the PTN (auto-save shouldn't overwrite)
    const hasExistingEvalMarks = this.plies.some(
      (p) => p && p.evaluation && (p.evaluation["?"] || p.evaluation["!"])
    );
    if (
      !hasExistingAnalysisNotes &&
      !hasExistingEvalMarks &&
      hasPositionBeforeEval &&
      hasPositionAfterEval &&
      store.state.analysis.saveEvalMarks
    ) {
      if (
        evaluationBefore === null &&
        positionBefore &&
        positionBefore[0].evaluation !== null
      ) {
        evaluationBefore = positionBefore[0].evaluation;
      }
      if (evaluationBefore !== null && evaluationAfter !== null) {
        evaluationBefore = Math.round(100 * evaluationBefore) / 1e4;
        const scoreLoss =
          (ply.player === 1
            ? evaluationAfter - evaluationBefore
            : evaluationBefore - evaluationAfter) / 2;
        const thresholds =
          store.state.analysis.evalMarkThresholds || defaultEvalMarkThresholds;
        if (scoreLoss > thresholds.brilliant) {
          comments.push("!!");
        } else if (scoreLoss > thresholds.good) {
          comments.push("!");
        } else if (scoreLoss > thresholds.bad) {
          // Do nothing
        } else if (scoreLoss > thresholds.blunder) {
          comments.push("?");
        } else {
          comments.push("??");
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

  saveEvalComments(tps = null) {
    const pvLimit = store.state.analysis.pvLimit;
    const pvsToSave = store.state.analysis.pvsToSave || 1;
    const saveSearchStats = store.state.analysis.saveSearchStats;
    const messages = {};
    const botName = this.label;

    // Helper to normalize bot names for comparison (e.g., "Tiltak (wasm)" -> "Tiltak")
    const normalizeBotName = (name) => {
      if (!name) return null;
      // Remove common suffixes like "(wasm)", "(cloud)", etc.
      return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
    };
    const normalizedBotName = normalizeBotName(botName);

    // Always use new format when saving
    const useNewFormat = true;
    // Or, use old format only if existing comments use it
    // const useNewFormat = this.pvFormat !== "old";

    // Helper to check if a note is an analysis note from this bot
    const isThisBotAnalysisNote = (note) => {
      if (
        note.evaluation === null &&
        note.pv === null &&
        note.pvAfter === null
      ) {
        return false;
      }
      if (!note.botName) {
        return true; // No bot name means it could be from this bot
      }
      // Compare normalized bot names
      return normalizeBotName(note.botName) === normalizedBotName;
    };

    if (isString(tps) && tps.length) {
      const buildEvalCommentFromPosition = (position) => {
        if (!position || !position[0]) {
          return null;
        }
        if (
          position[0].evaluation === null ||
          position[0].evaluation === undefined
        ) {
          return null;
        }

        const evaluationAfter = Math.round(100 * position[0].evaluation) / 1e4;
        if (evaluationAfter === null || isNaN(evaluationAfter)) {
          return null;
        }

        let evaluationComment = `${
          evaluationAfter >= 0 ? "+" : ""
        }${evaluationAfter}`;

        if (saveSearchStats) {
          if (position[0].depth !== null && position[0].depth !== undefined) {
            evaluationComment += `/${position[0].depth}`;
          }
          if (position[0].nodes !== null && position[0].nodes !== undefined) {
            evaluationComment += ` ${position[0].nodes} nodes`;
          }
          if (position[0].visits !== null && position[0].visits !== undefined) {
            evaluationComment += ` ${position[0].visits} visits`;
          }
          if (position[0].time !== null && position[0].time !== undefined) {
            evaluationComment += ` ${position[0].time}ms`;
          }
        }

        return evaluationComment;
      };

      // The current TPS corresponds to:
      // - the *positionAfter* of the previous ply (evaluation belongs there)
      // - the *positionBefore* of the next ply (pv belongs there - old format only)
      const prevPly = this.plies.find((p) => p.tpsAfter === tps);
      const nextPly = this.plies.find((p) => p.tpsBefore === tps);

      // For the initial position there is no previous ply. In that case we still
      // attach the evaluation to ply 0 (consistent with getters that allow
      // ply.id === 0 && ply.tpsBefore === tps).
      const evalPly =
        prevPly || this.plies.find((p) => p.id === 0 && p.tpsBefore === tps);

      if (prevPly) {
        const notes = this.formatEvalComments(
          prevPly,
          pvLimit,
          saveSearchStats,
          pvsToSave,
          useNewFormat
        );
        if (notes.length) {
          messages[prevPly.id] = notes;
        }
      }

      // If we have analysis for the current TPS but couldn't generate an eval
      // comment (often because positionBefore isn't analyzed), synthesize an
      // evaluation comment directly from the current position.
      if (evalPly && !(evalPly.id in messages)) {
        const fallbackEval = buildEvalCommentFromPosition(this.positions[tps]);
        if (fallbackEval) {
          messages[evalPly.id] = [fallbackEval];
        }
      }
    } else {
      // For full game/branch analysis, add to existing notes (don't remove them)
      // This allows multiple analyses to be saved and combined
      this.plies.forEach((ply) => {
        const notes = [];
        const evaluations = this.formatEvalComments(
          ply,
          pvLimit,
          saveSearchStats,
          pvsToSave,
          useNewFormat
        );
        if (evaluations.length) {
          notes.push(...evaluations);
        }
        if (notes.length) {
          messages[ply.id] = notes;
        }
      });
    }

    if (Object.keys(messages).length) {
      // Handle existing notes based on overwriteInferior setting
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
        const overwriteInferior = store.state.analysis.overwriteInferior;

        if (overwriteInferior) {
          // When overwriteInferior is enabled:
          // Merge results with same first move and engine, keeping superior ones
          const indicesToRemove = [];
          const notesToAdd = [];

          for (const newNote of newNotes) {
            const newFirstMove = this.getFirstMoveFromNote(newNote);
            const newBotNameRaw = this.getBotNameFromNote(newNote) || botName;
            const newBotNameNorm = normalizeBotName(newBotNameRaw);

            // Find existing note with same first move and bot name
            let matchingExisting = null;
            let matchingIdx = -1;

            for (const { idx, note: existingNote } of botNoteIndices) {
              // Skip notes already marked for removal
              if (indicesToRemove.includes(idx)) continue;

              const existingFirstMove = this.getFirstMoveFromNote(
                existingNote.message
              );
              const existingBotNameRaw = existingNote.botName || botName;
              const existingBotNameNorm = normalizeBotName(existingBotNameRaw);

              if (
                newFirstMove === existingFirstMove &&
                newBotNameNorm === existingBotNameNorm
              ) {
                matchingExisting = existingNote;
                matchingIdx = idx;
                break;
              }
            }

            if (matchingExisting) {
              // Found matching note - keep superior one
              if (this.isNoteSuperior(newNote, matchingExisting)) {
                indicesToRemove.push(matchingIdx);
                notesToAdd.push(newNote);
              }
              // If existing is superior, don't add new note (skip it)
            } else {
              // No matching note - add as new
              notesToAdd.push(newNote);
            }
          }

          // Remove inferior notes (in reverse order to maintain indices)
          indicesToRemove.sort((a, b) => b - a);
          for (const idx of indicesToRemove) {
            store.commit("game/REMOVE_NOTE", { plyID, index: idx });
          }

          // Calculate remaining count by subtracting removed from original
          // (can't re-read state as it may not be updated yet)
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

          // Only add as many new notes as we have slots for
          messages[plyID] = uniqueNewNotes.slice(0, slotsAvailable);
        } else {
          // When overwriteInferior is disabled:
          // Only add new notes if we haven't reached the pvsToSave limit
          // and don't duplicate first moves
          const currentCount = botNoteIndices.length;
          const slotsAvailable = Math.max(0, pvsToSave - currentCount);

          // Get existing first moves for this bot
          const existingFirstMoves = new Set(
            botNoteIndices.map(({ note }) =>
              this.getFirstMoveFromNote(note.message)
            )
          );

          // Filter out notes that would duplicate first moves
          const uniqueNewNotes = newNotes.filter((note) => {
            const firstMove = this.getFirstMoveFromNote(note);
            if (existingFirstMoves.has(firstMove)) {
              return false; // Skip duplicates
            }
            existingFirstMoves.add(firstMove);
            return true;
          });

          // Only add as many new notes as we have slots for (don't remove existing)
          messages[plyID] = uniqueNewNotes.slice(0, slotsAvailable);
        }
      }

      // Filter out empty message arrays before dispatching
      const filteredMessages = {};
      for (const [plyID, notes] of Object.entries(messages)) {
        if (notes.length > 0) {
          filteredMessages[plyID] = notes;
        }
      }
      if (Object.keys(filteredMessages).length > 0) {
        store.dispatch("game/ADD_NOTES", filteredMessages);
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

  // Apply eval marks (!!,!,?,??) to PTN based on bot analysis
  saveEvalMarks(tps = null) {
    const thresholds =
      this.settings.evalMarkThresholds || defaultEvalMarkThresholds;
    const evalMarks = {};

    // Helper to calculate eval mark for a ply
    const calculateEvalMark = (ply) => {
      // Skip first two plies (opening moves) - no meaningful "before" to compare
      // Check move number from tpsBefore - format is "board player moveNumber"
      // Move 1 plies have tpsBefore with moveNumber 1
      const tpsParts = ply.tpsBefore ? ply.tpsBefore.split(" ") : [];
      const moveNumber = tpsParts.length >= 3 ? Number(tpsParts[2]) : 0;
      if (moveNumber <= 1) {
        return null;
      }

      const positionBefore = this.positions[ply.tpsBefore];
      const positionAfter = this.positions[ply.tpsAfter];

      if (!positionBefore || !positionAfter) {
        return null;
      }
      if (!positionBefore[0] || !positionAfter[0]) {
        return null;
      }

      // Skip if the move made matches the bot's top suggestion
      // (no mark needed if player made the expected move)
      const topSuggestion = positionBefore[0];
      if (topSuggestion.ply && pliesEqual(ply, topSuggestion.ply)) {
        return null;
      }

      const rawEvalBefore = positionBefore[0].evaluation;
      const rawEvalAfter = positionAfter[0].evaluation;

      if (rawEvalBefore === null || rawEvalAfter === null) {
        return null;
      }

      // Normalize evaluations the same way as formatEvalComments
      const evalBefore = Math.round(100 * rawEvalBefore) / 1e4;
      const evalAfter = Math.round(100 * rawEvalAfter) / 1e4;

      const scoreLoss =
        (ply.player === 1 ? evalAfter - evalBefore : evalBefore - evalAfter) /
        2;

      if (scoreLoss > thresholds.brilliant) {
        return "!!";
      } else if (scoreLoss > thresholds.good) {
        return "!";
      } else if (scoreLoss > thresholds.bad) {
        return null; // No mark for neutral moves
      } else if (scoreLoss > thresholds.blunder) {
        return "?";
      } else {
        return "??";
      }
    };

    if (isString(tps) && tps.length) {
      // Single position: find the ply that leads to this TPS
      const ply = this.plies.find((p) => p.tpsAfter === tps);
      if (ply) {
        const mark = calculateEvalMark(ply);
        if (mark) {
          evalMarks[ply.id] = mark;
        }
      }
    } else {
      // All positions
      this.plies.forEach((ply) => {
        const mark = calculateEvalMark(ply);
        if (mark) {
          evalMarks[ply.id] = mark;
        }
      });
    }

    if (Object.keys(evalMarks).length) {
      store.dispatch("game/SET_EVAL_MARKS", evalMarks);
    }
  }
}
