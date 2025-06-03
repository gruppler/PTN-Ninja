import Vue from "vue";
import store from "../store";
import Ply from "../Game/PTN/Ply";
import { deepFreeze } from "../utilities";

import hashObject from "object-hash";
import { isFunction, omit } from "lodash";

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
    if (success && isFunction(this.onInit)) {
      this.onInit(this);
    }
    return success;
  }

  getSettingsHash() {
    return hashObject(omit(this.settings, "pvLimit"));
  }

  handleResults({
    tps = this.status.tps,
    hash = this.getSettingsHash(),
    pv = [],
    time = null,
    nps = null,
    depth = null,
    score = null,
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
    score * (initialPlayer === 1 ? 1 : -1);
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

  handleError(error) {
    if (isFunction(this.onError)) {
      this.onError(error);
    } else {
      console.error(error);
    }
  }

  analyzePosition() {}

  analyzeGame() {}

  terminate() {}
}
