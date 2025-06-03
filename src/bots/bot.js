import Vue from "vue";
import store from "../store";
import { i18n } from "../boot/i18n";
import Ply from "../Game/PTN/Ply";
import { deepFreeze } from "../utilities";

import hashObject from "object-hash";
import { isFunction, omit, uniq } from "lodash";

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
      options: options,
      sizes: sizes,
    };

    this.status = {
      isReady: false,
      isEnabled: false,
      isRunning: false,
      progress: 0,
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

    this.isInitialized = false;
    this.init();
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

  getTeiPosition() {
    return this.game.ptn.tags.tps ? this.game.ptn.tags.tps.text : null;
  }

  getTeiMoves() {
    return this.game.ptn.branchPlies
      .slice(
        0,
        1 + this.game.position.plyIndex - 1 * !this.game.position.plyIsDone
      )
      .map((ply) => ply.text)
      .join(" ");
  }

  nextPly(player, color) {
    if (player === 2 && color === 1) {
      return { player: 1, color: 1 };
    }
    return { player: player === 1 ? 2 : 1, color: color === 1 ? 2 : 1 };
  }

  init(success) {
    this.isInitialized = success;
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
    return hashObject(omit(this.settings, "pvLimit"));
  }

  formatEvaluation(value) {
    return value === null ? null : `+${i18n.n(Math.abs(value), "n0")}%`;
  }

  handleResults({
    hash = this.getSettingsHash(),
    tps,
    pv = [],
    time = null,
    nps = null,
    depth = null,
    evaluation = null,
    nodes = null,
  }) {
    if (!this.isInteractive) {
      this.status.isRunning = false;
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
    const suggestions = [
      { ply, followingPlies, evaluation, depth, nodes, hash },
    ];
    deepFreeze(suggestions);

    if (!this.status.tps) {
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
      this.positions[tps][0].depth < suggestions[0].depth ||
      this.positions[tps][0].hash !== hash
    ) {
      Vue.set(this.positions, tps, suggestions);
      return suggestions;
    }
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
        evaluationBefore !== null ||
        (positionBefore && positionBefore[0].evaluation !== null)
      ) {
        evaluationBefore =
          Math.round(
            100 *
              (evaluationBefore !== null
                ? evaluationBefore
                : positionBefore[0].evaluation)
          ) / 1e4;
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

  saveEvalComments(pvLimit = this.settings.pvLimit, plies = this.plies) {
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

  analyzePosition() {}

  async analyzeGame() {
    try {
      this.status.isRunning = true;
      this.status.progress = 0;
      const plies = this.plies.filter((ply) => !this.plyHasEvalComment(ply));
      let positions = plies.map((ply) => ply.tpsBefore);
      plies.forEach((ply) => {
        if (!ply.result || ply.result.type === "1") {
          positions.push(ply.tpsAfter);
        }
      });
      positions = uniq(positions).filter(
        (tps) =>
          !(tps in this.positions) || !(settingsKey in this.positions[tps])
      );
      const total = positions.length;
      let completed = 0;

      positions.forEach((tps) => {
        this.analyzePosition(secondsToThink, tps, komi);
        this.status.progress = (100 * ++completed) / total;
      });
      // Insert comments
      this.saveEvalComments();
    } catch (error) {
      this.handleError(error);
    } finally {
      this.status.isRunning = false;
    }
  }

  terminate() {}
}
