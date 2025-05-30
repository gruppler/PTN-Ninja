import store from "./store";
import Ply from "../Game/PTN/Ply";
import { deepFreeze } from "../utilities";

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
    this.settings = store.state.ui.botSettings[id];

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

    this.analyzedPositions = {};

    Object.freeze(this);
  }

  get game() {
    return this.game;
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
      this.onInit();
    }
    return success;
  }

  analyzePosition() {}

  analyzeGame() {}

  terminate() {}

  handleError(error) {
    if (isFunction(this.onError)) {
      this.onError(error);
    } else {
      console.error(error);
    }
  }
}
