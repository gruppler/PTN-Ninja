import Vue from "vue";
import store from "../store";
import { i18n } from "../boot/i18n";
import Ply from "../Game/PTN/Ply";
import { deepFreeze } from "../utilities";

import hashObject from "object-hash";
import { isFunction, isNumber, uniq } from "lodash";

export default class Bot {
  constructor({
    id,
    icon,
    label,
    description,
    isInteractive,
    name,
    author,
    options,
    sizes,
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

    this.meta = {
      name: name,
      author: author,
      options: options || {},
      sizes: sizes,
    };

    this.status = {
      isInitialized: false,
      isReady: false,
      isInteractiveEnabled: false,
      isInteractiveRunning: false,
      isAnalyzingPosition: false,
      isAnalyzingGame: false,
      isRunning: false,
      progress: 0,
      onComplete: null,
      analyzingPly: null,
      timer: null,
      time: null,
      nps: null,
      tps: null,
      nextTPS: null,
      komi: null,
      size: null,
      initTPS: null,
    };

    this.positions = {};
    this.unwatchPosition = null;

    this.init();
  }

  get isInteractiveEnabled() {
    return this.status.isInteractiveEnabled;
  }
  set isInteractiveEnabled(value) {
    if (!this.isInteractive || this.status.isInteractiveEnabled === value) {
      return;
    }
    if (value) {
      this.unwatchPosition = store.watch(
        (state) => state.game.position.tps,
        () => this.analyzeInteractive()
      );
      this.analyzeInteractive();
    } else if (this.unwatchPosition) {
      this.terminate();
      this.unwatchPosition();
      this.unwatchPosition = null;
    }
    this.status.isInteractiveEnabled = value;
  }

  get settings() {
    return store.state.ui.botSettings[this.id];
  }

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

  init(success) {
    success = Boolean(success);
    this.status.isInitialized = success;
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

  getSettingsHash() {
    return hashObject(this.settings);
  }

  queryPosition(tps, plyIndex) {}

  //#region analyzeInteractive
  analyzeInteractive() {
    if (!this.isInteractive) {
      return false;
    }

    if (this.status.isRunning || this.isGameEnd) {
      this.send("stop");
    }

    if (this.isGameEnd) {
      this.isInteractiveRunning = false;
      this.isRunning = false;
      this.status.time = 0;
      this.status.nps = 0;
      this.status.nextTPS = null;
      return;
    }

    // Queue current position for pairing with future response
    const tps = this.tps;
    this.status.nextTPS = tps;
    if (!this.status.tps) {
      this.status.tps = this.status.nextTPS;
    }

    this.status.analyzingPly = this.ply;
    this.status.isRunning = true;
    this.status.isInteractiveRunning = true;

    this.queryPosition(
      tps,
      this.game.position.plyIndex - 1 * !this.game.position.plyIsDone
    );

    return true;
  }

  //#region analyzeCurrentPosition
  analyzeCurrentPosition() {
    if (this.status.isRunning || this.isGameEnd) {
      return false;
    }

    this.status.tps = this.tps;
    this.status.analyzingPly = this.ply;
    this.status.isRunning = true;
    this.status.isAnalyzingPosition = true;
    this.status.progress = 0;
    if (
      this.settings.secondsToThink &&
      (!this.settings.limitType || this.settings.limitType === "secondsToThink")
    ) {
      const secondsToThink = this.settings.secondsToThink;
      const startTime = new Date().getTime();
      this.status.timer = setInterval(() => {
        this.status.progress =
          (new Date().getTime() - startTime) / (secondsToThink * 10);
      }, 1000);
    }

    this.queryPosition(
      this.tps,
      this.game.position.plyIndex - 1 * !this.game.position.plyIsDone
    );

    return true;
  }

  //#region analyzeGame
  async analyzeGame() {
    if (this.status.isRunning) {
      return false;
    }

    try {
      this.status.isRunning = true;
      this.status.isAnalyzingGame = true;
      this.status.progress = 0;
      const plies = this.plies.filter((ply) => !this.plyHasEvalComment(ply));
      let positions = plies.map((ply) => ply.tpsBefore);
      plies.forEach((ply) => {
        if (!ply.result || ply.result.type === "1") {
          positions.push(ply.tpsAfter);
        }
      });
      positions = uniq(positions).filter((tps) => !(tps in this.positions));
      const total = positions.length;
      let completed = 0;
      let tps = positions[0];
      this.status.onComplete = () => {
        this.status.progress = (100 * ++completed) / total;
        if (completed < total) {
          // Proceed to next position
          tps = positions[completed];
          this.status.tps = tps;
          this.queryPosition(tps);
        } else {
          // Analysis complete
          this.status.onComplete = null;
          this.status.isRunning = false;
          this.status.isAnalyzingGame = false;
          this.saveEvalComments();
        }
      };
      this.status.tps = tps;
      this.queryPosition(tps);
    } catch (error) {
      this.handleError(error);
      this.status.isRunning = false;
      this.status.isAnalyzingGame = false;
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

    if (this.status.isAnalyzingPosition && !this.isInteractive) {
      this.status.isAnalyzingPosition = false;
      this.status.isRunning = false;
      this.status.analyzingPly = null;
      clearInterval(this.status.timer);
      this.status.timer = null;
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

    if (this.isInteractiveEnabled && !this.status.tps) {
      this.status.tps = this.tps;
    }

    // Update time and nps
    if (!this.isGameEnd) {
      this.status.time = time;
      this.status.nps = nps;
    }

    // Don't overwrite deeper searches for this position unless settings have changed
    if (
      !this.positions[tps] ||
      this.positions[tps][0].hash !== hash ||
      this.positions[tps][0].nodes < suggestions[0].nodes ||
      this.positions[tps][0].depth < suggestions[0].depth ||
      this.positions[tps][0].time < suggestions[0].time
    ) {
      Vue.set(this.positions, tps, suggestions);
    }
  }

  terminate() {
    this.status.isInteractiveRunning = false;
    this.status.isAnalyzingPosition = false;
    this.status.isAnalyzingGame = false;
    this.status.isRunning = false;
    this.status.nps = null;
    this.status.nextTPS = null;
    this.status.onComplete = null;
    if (this.status.timer) {
      clearInterval(this.status.timer);
      this.status.timer = null;
    }
  }

  //#region Formatting
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
