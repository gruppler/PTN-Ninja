import store from "../store";
import { i18n } from "../boot/i18n";
import { deepFreeze, parsePV } from "../utilities";

import hashObject from "object-hash";
import {
  cloneDeep,
  forEach,
  isEmpty,
  isFunction,
  isObject,
  isNumber,
  uniqBy,
} from "lodash";

export function formatEvaluation(value) {
  return value === null ? null : `+${i18n.n(Math.abs(value), "n0")}%`;
}

export default class Bot {
  constructor({
    id,
    icon,
    label,
    description,
    isInteractive = false,
    name,
    author,
    version,
    limitTypes = ["depth", "movetime", "nodes"],
    options = {},
    sizeHalfKomis = {}, // Map of sizes to arrays of halfkomis
    state = {},
    settings = {},
    meta = {},
    onInit,
    onError,
    onInfo,
    onWarning,
  }) {
    this.id = id;
    this.icon = icon;
    this.label = label;
    this.description = description;

    // Callbacks
    this.onInit = onInit;
    this.onError = onError || ((e) => console.error(e));
    this.onInfo = onInfo || ((i) => console.info(i));
    this.onWarning = onWarning || ((w) => console.warn(w));
    this.onReady = null;
    this.onComplete = null;
    this.unwatchPosition = null;

    this.meta = {
      name,
      author,
      version,
      isInteractive,
      options,
      sizeHalfKomis,
      limitTypes,
      ...meta,
    };

    this.settings = { ...settings };
    // After initialization of the store,
    // this.settings will be overwritten with the stored version

    this.state = {
      isInitialized: false,
      isReadying: false,
      isReady: false,

      isInteractiveEnabled: false,
      isAnalyzingPosition: false,
      isAnalyzingGame: false,
      isRunning: false,
      progress: 0,
      analyzingPly: null,
      timer: null,
      time: null,
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

    this.init();
  }

  //#region init
  init(success) {
    success = Boolean(success);
    this.state.isInitialized = success;
    if (success && isFunction(this.onInit)) {
      this.onInit(this);
    }
    return success;
  }

  //#region Setters
  setMeta(key, value) {
    if (store.state.analysis && store.state.analysis.botID === this.id) {
      store.commit("analysis/SET_BOT_META", [key, value]);
    } else {
      this.meta[key] = value;
    }
  }

  setState(key, value) {
    if (store.state.analysis && store.state.analysis.botID === this.id) {
      store.commit("analysis/SET_BOT_STATE", [key, value]);
    } else {
      this.state[key] = value;
    }
  }

  setPosition(tps, suggestions) {
    if (store.state.analysis && store.state.analysis.botID === this.id) {
      store.commit("analysis/SET_BOT_POSITION", [tps, suggestions]);
    } else {
      this.positions[tps] = suggestions;
    }
  }

  logMessage(message, received = false) {
    if (isObject(message)) {
      message = JSON.stringify(message);
    }
    message = { message, received };
    if (store.state.analysis && store.state.analysis.botID === this.id) {
      store.commit("analysis/BOT_LOG", message);
    } else {
      this.log.push(message);
    }
  }

  clearLog() {
    if (store.state.analysis && store.state.analysis.botID === this.id) {
      store.commit("analysis/CLEAR_BOT_LOG");
    } else {
      this.log = [];
    }
  }

  //#region Getters

  get game() {
    return store.state.game;
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

  getPositionsToAnalyze() {
    const plies = this.plies.filter((ply) => !this.plyHasEvalComment(ply));
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
    positions = uniqBy(positions, (p) => p.tps).filter((p) => {
      return (
        !(p.tps in this.positions) ||
        this.positions[p.tps][0].hash !== hash ||
        (this.settings.nodes &&
          this.positions[p.tps][0].nodes < this.settings.nodes) ||
        (this.settings.depth &&
          this.positions[p.tps][0].depth < this.settings.depth) ||
        (this.settings.movetime &&
          this.positions[p.tps][0].time < this.settings.movetime * 0.7)
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
      }, 0);
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

  get isGameEnd() {
    return this.game.position.isGameEnd && !this.game.position.isGameEndDefault;
  }

  get isAnalyzeGameAvailable() {
    return (
      !this.isFullyAnalyzed &&
      this.state.isReady &&
      !this.state.isAnalyzingPosition &&
      !this.state.isInteractiveEnabled
    );
  }

  get isAnalyzePositionAvailable() {
    return (
      !this.isGameEnd &&
      this.plies.length &&
      this.state.isReady &&
      !this.state.isAnalyzingGame &&
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
    this.onReady = null;
    this.setState("isReadying", false);
    this.setState("isReady", false);
    this.setState("gameID", null);
    this.setState("size", null);
    this.setState("halfKomi", null);
    this.setState("nextTPS", null);
    this.setState("tps", null);
  }

  //#region terminate
  // Stop searching
  terminate() {
    this.isInteractiveEnabled = false;
    this.setState("isAnalyzingPosition", false);
    this.setState("isAnalyzingGame", false);
    this.setState("isRunning", false);
    this.setState("progress", 0);
    this.setState("analyzingPly", null);
    this.setState("nextTPS", null);
    this.onReady = null;
    this.onComplete = null;
    if (this.state.timer) {
      clearInterval(this.state.timer);
      this.setState("timer", null);
    }
  }

  //#region clearResults
  clearResults() {
    if (store.state.analysis && store.state.analysis.botID === this.id) {
      store.commit("analysis/CLEAR_BOT_POSITIONS");
    } else {
      this.positions = {};
    }
    this.setState("time", 0);
    this.setState("nps", 0);
  }

  //#region queryPosition
  queryPosition(tps, plyIndex) {
    let success = {
      isNewGame: false,
      halfKomi: this.halfKomi,
    };

    if (!tps && isNumber(plyIndex)) {
      // Validate arguments
      success = false;
    } else if (
      // Validate board size
      !isEmpty(this.meta.sizeHalfKomis) &&
      !(this.size in this.meta.sizeHalfKomis)
    ) {
      this.onError("Unsupported size");
      success = false;
    } else {
      // Get closest supported komi
      const halfKomi = this.halfKomi;
      const usingHalfKomi = this.getSupportedHalfKomi();
      success.halfKomi = usingHalfKomi;
      if (
        this.state.gameID !== this.game.name ||
        this.state.size !== this.size ||
        this.state.halfKomi !== halfKomi
      ) {
        // This is a new game
        success.isNewGame = true;
        this.setState("gameID", this.game.name);
        this.setState("size", this.size);
        this.setState("halfKomi", halfKomi);

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

    if (!success) {
      this.terminate();
    }
    return success;
  }

  //#region isInteractiveEnabled
  get isInteractiveEnabled() {
    return this.state.isInteractiveEnabled;
  }
  set isInteractiveEnabled(value) {
    if (!this.meta.isInteractive || this.state.isInteractiveEnabled === value) {
      return;
    }
    if (value) {
      this.setState("tps", null);
      this.setState("nextTPS", null);
      this.setState("isInteractiveEnabled", value);
      this.unwatchPosition = store.watch(
        (state) => state.game.position.tps,
        () => this.analyzeInteractive()
      );
      this.analyzeInteractive();
    } else if (this.unwatchPosition) {
      this.unwatchPosition();
      this.unwatchPosition = null;
      this.terminate();
      this.setState("isInteractiveEnabled", value);
    }
  }

  //#region analyzeInteractive
  analyzeInteractive() {
    if (!this.meta.isInteractive) {
      return false;
    }

    if (this.state.isRunning || this.isGameEnd) {
      this.send("stop");
    }

    if (this.isGameEnd) {
      this.isRunning = false;
      this.setState("nextTPS", null);
      return;
    }

    // Queue current position for pairing with future response
    const tps = this.tps;
    this.setState("nextTPS", tps);
    if (!this.state.tps) {
      this.setState("tps", this.state.nextTPS);
    }

    this.setState("analyzingPly", this.ply);
    this.setState("isRunning", true);

    this.queryPosition(
      tps,
      this.game.position.plyIndex - 1 * !this.game.position.plyIsDone
    );

    return true;
  }

  //#region analyzeCurrentPosition
  analyzeCurrentPosition() {
    if (this.state.isRunning || this.isGameEnd) {
      return false;
    }

    this.setState("tps", this.tps);
    this.setState("analyzingPly", this.ply);
    this.setState("isRunning", true);
    this.setState("isAnalyzingPosition", true);
    this.setState("progress", 0);
    if (
      this.settings.movetime &&
      (!this.settings.limitTypes ||
        this.settings.limitTypes.includes("movetime"))
    ) {
      const movetime = this.settings.movetime;
      const startTime = new Date().getTime();
      this.setState(
        "timer",
        setInterval(() => {
          this.setState(
            "progress",
            (100 * (new Date().getTime() - startTime)) / movetime
          );
        }, 250)
      );
    }

    this.onComplete = () => {
      this.setState("isAnalyzingPosition", false);
      this.setState("isRunning", false);
      this.setState("analyzingPly", null);
      if (this.state.timer) {
        clearInterval(this.state.timer);
        this.setState("timer", null);
      }
      this.onComplete = null;
    };

    this.queryPosition(
      this.tps,
      this.game.position.plyIndex - 1 * !this.game.position.plyIsDone
    );

    return true;
  }

  //#region analyzeGame
  async analyzeGame() {
    if (this.state.isRunning) {
      return false;
    }

    try {
      const positions = this.getPositionsToAnalyze();
      const total = positions.length;
      let completed = 0;
      let position = positions[0];
      this.onComplete = () => {
        this.setState("progress", (100 * ++completed) / total);
        if (completed < total) {
          // Proceed to next position
          position = positions[completed];
          this.setState("tps", position.tps);
          this.setState("analyzingPly", this.game.ptn.allPlies[position.plyID]);
          this.queryPosition(position.tps);
        } else {
          // Analysis complete
          this.onComplete = null;
          this.setState("isRunning", false);
          this.setState("isAnalyzingGame", false);
          this.saveEvalComments();
        }
      };
      this.setState("isRunning", true);
      this.setState("isAnalyzingGame", true);
      this.setState("progress", 0);
      this.setState("tps", position.tps);
      this.setState("analyzingPly", this.game.ptn.allPlies[position.plyID]);
      this.queryPosition(position.tps);
    } catch (error) {
      this.onError(error);
      this.setState("isRunning", false);
      this.setState("isAnalyzingGame", false);
    }
  }

  //#region storeResults
  storeResults({
    hash = this.getSettingsHash(),
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
      return;
    }

    if (this.state.isAnalyzingPosition && !this.meta.isInteractive) {
      this.setState("isAnalyzingPosition", false);
      this.setState("isRunning", false);
      this.setState("analyzingPly", null);
      clearInterval(this.state.timer);
      this.setState("timer", null);
    }

    // Determine ply colors
    const [initialPlayer, moveNumber] = tps.split(" ").slice(1).map(Number);
    const initialColor =
      this.openingSwap && moveNumber === 1
        ? initialPlayer == 1
          ? 2
          : 1
        : initialPlayer;
    const results = [];
    suggestions.forEach(
      ({
        pv,
        time = null,
        depth = null,
        nodes = null,
        visits = null,
        evaluation = null,
      }) => {
        let player = initialPlayer;
        let color = initialColor;
        pv = parsePV(player, color, pv);
        const ply = pv.splice(0, 1)[0];
        const followingPlies = pv;
        const result = {
          ply,
          followingPlies,
          evaluation,
          time,
          hash,
        };
        if (depth !== null) {
          result.depth = depth;
        }
        if (nodes !== null) {
          result.nodes = nodes;
        }
        if (visits !== null) {
          result.visits = visits;
        }
        results.push(result);
      }
    );
    deepFreeze(results);

    if (this.isInteractiveEnabled && !this.state.tps) {
      this.setState("tps", this.tps);
    }

    // Update time and nps
    if (results[0].time !== null) {
      this.setState("time", results[0].time);
    }
    if (nps !== null) {
      this.setState("nps", nps);
    }

    // Don't overwrite deeper searches for this position unless settings have changed
    if (
      !this.positions[tps] ||
      this.positions[tps][0].hash !== hash ||
      this.positions[tps][0].nodes < results[0].nodes ||
      this.positions[tps][0].depth < results[0].depth ||
      this.positions[tps][0].time < results[0].time
    ) {
      this.setPosition(tps, results);
    }
  }

  //#region Formatting

  get isFullyAnalyzed() {
    return !this.getPositionsToAnalyze().length;
  }

  plyHasEvalComment(ply) {
    return (
      ply.id in this.game.comments.notes &&
      this.game.comments.notes[ply.id].some(
        (comment) => comment.evaluation !== null
      )
    );
  }

  formatEvaluation(value) {
    formatEvaluation(value);
  }

  formatEvalComments(ply, pvLimit = 0) {
    let comments = [];
    let positionBefore = this.positions[ply.tpsBefore];
    let positionAfter = this.positions[ply.tpsAfter];
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

    // Evaluation
    if (
      evaluationAfter !== null ||
      (positionAfter && positionAfter[0].evaluation !== null)
    ) {
      let evaluationComment = "";

      evaluationAfter =
        Math.round(
          100 *
            (evaluationAfter !== null
              ? evaluationAfter
              : positionAfter[0].evaluation)
        ) / 1e4;
      if (evaluationAfter !== null && !isNaN(evaluationAfter)) {
        evaluationComment += `${
          evaluationAfter >= 0 ? "+" : ""
        }${evaluationAfter}`;

        // Find existing eval comment index
        if (ply.id in this.game.comments.notes) {
          const index = this.game.comments.notes[ply.id].findIndex(
            (comment) => comment.evaluation !== null
          );
          if (index >= 0) {
            evaluationComment = `!r${index}:${evaluationComment}`;
          }
        }

        comments.push(evaluationComment);
      }

      // Annotation marks
      if (
        evaluationBefore === null &&
        positionBefore &&
        positionBefore[0].evaluation !== null
      ) {
        evaluationBefore = positionBefore[0].evaluation;
      }
      if (evaluationBefore !== null) {
        evaluationBefore = Math.round(100 * evaluationBefore) / 1e4;
        const scoreLoss =
          (ply.player === 1
            ? evaluationAfter - evaluationBefore
            : evaluationBefore - evaluationAfter) / 2;
        if (scoreLoss > 0.06) {
          comments.push("!!");
        } else if (scoreLoss > 0.03) {
          comments.push("!");
        } else if (scoreLoss > -0.1) {
          // Do nothing
        } else if (scoreLoss > -0.25) {
          comments.push("?");
        } else {
          comments.push("??");
        }
      }
    }

    // PV
    if (positionBefore) {
      let position = positionBefore[0];
      if (position && position.ply) {
        let pv = [position.ply, ...position.followingPlies];
        if (pvLimit) {
          pv = pv.slice(0, pvLimit);
        }
        pv = pv.map((ply) => ply.ptn);
        let pvComment = `pv ${pv.join(" ")}`;

        // Find existing pv comment index
        if (ply.id in this.game.comments.notes) {
          const index = this.game.comments.notes[ply.id].findIndex(
            (comment) =>
              comment.pv !== null &&
              comment.pv.every(
                (cpv) =>
                  cpv.every((ply, i) => ply === pv[i]) ||
                  pv.every((ply, i) => ply === cpv[i])
              )
          );
          if (index >= 0) {
            pvComment = `!r${index}:${pvComment}`;
          }
        }

        comments.push(pvComment);
      }
    }
    return comments;
  }

  saveEvalComments(pvLimit = store.state.analysis.pvLimit, plies = this.plies) {
    const messages = {};
    plies.forEach((ply) => {
      const notes = [];
      const evaluations = this.formatEvalComments(ply, pvLimit);
      if (evaluations.length) {
        notes.push(...evaluations);
      }
      if (notes.length) {
        messages[ply.id] = notes;
      }
    });
    store.dispatch("game/ADD_NOTES", messages);
  }
}
