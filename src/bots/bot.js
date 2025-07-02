import store from "../store";
import { i18n } from "../boot/i18n";
import Ply from "../Game/PTN/Ply";
import { deepFreeze } from "../utilities";

import hashObject from "object-hash";
import { cloneDeep, forEach, isFunction, isNumber, uniqBy } from "lodash";

export default class Bot {
  constructor({
    id,
    icon,
    label,
    description,
    isInteractive = false,
    name,
    author,
    meta = {},
    options = {},
    sizeHalfKomis = {}, // Map of sizes to arrays of halfkomis
    state = {},
    settings = {},
    onInit,
    onError,
  }) {
    this.id = id;
    this.icon = icon;
    this.label = label;
    this.description = description;
    this.isInteractive = isInteractive;

    // Callbacks
    this.onInit = onInit;
    this.onError = onError;
    this.onReady = null;
    this.onComplete = null;
    this.unwatchPosition = null;

    this.meta = {
      name: name,
      author: author,
      options: options,
      sizeHalfKomis: sizeHalfKomis,
      limitTypes: ["depth", "movetime", "nodes"],
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
      komi: null,
      size: null,
      initTPS: null,
      ...state,
    };

    this.positions = {};

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

  handleError(error) {
    if (isFunction(this.onError)) {
      this.onError(error);
    } else {
      console.error(error);
    }
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

  get openingSwap() {
    return this.game.config.openingSwap;
  }

  get tps() {
    return this.game.position.tps;
  }

  get ply() {
    return this.game.position.boardPly;
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
      this.state.isReady &&
      !this.state.isAnalyzingPosition &&
      !this.state.isInteractiveEnabled
    );
  }

  get isAnalyzePositionAvailable() {
    return (
      !this.isGameEnd &&
      !this.isFullyAnalyzed &&
      this.plies.length &&
      this.state.isReady &&
      !this.state.isAnalyzingGame &&
      !this.state.isInteractiveEnabled
    );
  }

  get isInteractiveAvailable() {
    return (
      this.state.isInteractiveEnabled ||
      (this.isInteractive &&
        !this.isGameEnd &&
        this.state.isReady &&
        !this.state.isAnalyzingGame &&
        !this.state.isAnalyzingPosition)
    );
  }

  getInitTPS() {
    return this.game.ptn.tags.tps ? this.game.ptn.tags.tps.text : null;
  }

  getTeiPosition(tps, plyIndex) {
    let posMessage = "position";
    if (isNumber(plyIndex)) {
      tps = this.getInitTPS();
      if (tps) {
        posMessage += " tps " + tps;
      } else {
        posMessage += " startpos";
      }
      posMessage += " moves";
      const plies = this.game.ptn.branchPlies
        .slice(0, 1 + plyIndex)
        .map((ply) => ply.text)
        .join(" ");
      if (plies) {
        posMessage += " " + plies;
      }
    } else {
      posMessage += " tps " + tps;
    }
    return posMessage;
  }

  nextPly(player, color) {
    if (player === 2 && color === 1) {
      return { player: 1, color: 1 };
    }
    return { player: player === 1 ? 2 : 1, color: color === 1 ? 2 : 1 };
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

  async setOptions(options) {
    const botSettings = cloneDeep(store.state.analysis.botSettings);
    botSettings[this.id].options = {
      ...(this.settings.options || {}),
      ...options,
    };
    return store.dispatch("analysis/SET", ["botSettings", botSettings]);
  }

  //#region reset
  // Reset status
  reset() {
    this.onReady = null;
    this.setState("isReadying", false);
    this.setState("isReady", false);
    this.setState("gameID", null);
    this.setState("size", null);
    this.setState("komi", null);
    this.setState("initTPS", null);
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
    this.setState("time", 0);
    this.setState("nps", 0);
    this.setState("tps", null);
    this.setState("nextTPS", null);
    this.onReady = null;
    this.onComplete = null;
    if (this.state.timer) {
      clearInterval(this.state.timer);
      this.setState("timer", null);
    }
  }

  queryPosition(tps, plyIndex) {}

  //#region isInteractiveEnabled
  get isInteractiveEnabled() {
    return this.state.isInteractiveEnabled;
  }
  set isInteractiveEnabled(value) {
    if (!this.isInteractive || this.state.isInteractiveEnabled === value) {
      return;
    }
    if (value) {
      this.unwatchPosition = store.watch(
        (state) => state.game.position.tps,
        () => this.analyzeInteractive()
      );
      this.analyzeInteractive();
    } else if (this.unwatchPosition) {
      this.unwatchPosition();
      this.unwatchPosition = null;
      this.terminate();
    }
    this.setState("isInteractiveEnabled", value);
  }

  //#region analyzeInteractive
  analyzeInteractive() {
    if (!this.isInteractive) {
      return false;
    }

    if (this.state.isRunning || this.isGameEnd) {
      this.send("stop");
    }

    if (this.isGameEnd) {
      this.isRunning = false;
      this.setState("time", 0);
      this.setState("nps", 0);
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
        }, 500)
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
      positions = uniqBy(positions, (p) => p.tps).filter(
        (p) =>
          !(p.tps in this.positions) ||
          this.positions[p.tps][0].nodes < this.settings.nodes ||
          this.positions[p.tps][0].depth < this.settings.depth ||
          this.positions[p.tps][0].time < this.settings.time
      );
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
          this.setState("isRunning", true);
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
      this.handleError(error);
      this.setState("isRunning", false);
      this.setState("isAnalyzingGame", false);
    }
  }

  //#region storeResults
  storeResults({
    hash = this.getSettingsHash(),
    tps,
    pvs = [],
    time = null,
    nps = null,
    depth = null,
    evaluation = null,
    nodes = null,
  }) {
    if (!tps) {
      return;
    }

    if (this.state.isAnalyzingPosition && !this.isInteractive) {
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
    const suggestions = [];
    pvs.forEach((pv) => {
      let player = initialPlayer;
      let color = initialColor;
      const ply = new Ply(pv.splice(0, 1)[0], {
        id: null,
        player,
        color,
      });
      const followingPlies = pv.map((ply) => {
        ({ player, color } = this.nextPly(player, color));
        return new Ply(ply, { id: null, player, color });
      });
      depth;
      nodes;
      suggestions.push({
        ply,
        followingPlies,
        evaluation,
        depth,
        nodes,
        time,
        hash,
      });
    });
    deepFreeze(suggestions);

    if (this.isInteractiveEnabled && !this.state.tps) {
      this.setState("tps", this.tps);
    }

    // Update time and nps
    if (!this.isGameEnd) {
      this.setState("time", time);
      this.setState("nps", nps);
    }

    // Don't overwrite deeper searches for this position unless settings have changed
    if (
      !this.positions[tps] ||
      this.positions[tps][0].hash !== hash ||
      this.positions[tps][0].nodes < suggestions[0].nodes ||
      this.positions[tps][0].depth < suggestions[0].depth ||
      this.positions[tps][0].time < suggestions[0].time
    ) {
      this.setPosition(tps, suggestions);
    }
  }

  //#region Formatting

  get isFullyAnalyzed() {
    return this.plies.every((ply) => this.plyHasEvalComment(ply));
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
    return value === null ? null : `+${i18n.n(Math.abs(value), "n0")}%`;
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

  saveEvalComments(
    pvLimit = store.state.ui.botSettings.pvLimit,
    plies = this.plies
  ) {
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
