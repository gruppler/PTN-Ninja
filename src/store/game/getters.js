import Vue from "vue";
import { parseURLparams } from "../../router/routes";
import router from "../../router";

export const uniqueName =
  (state) =>
  (name, ignoreFirst = false) => {
    const names = state.list.slice(1 * ignoreFirst).map((game) => game.name);
    while (names.includes(name)) {
      if (/\(\d+\)$/.test(name)) {
        name = name.replace(/\((\d+)\)$/, (match, number) => {
          number = parseInt(number, 10) + 1;
          return `(${number})`;
        });
      } else {
        name += " (1)";
      }
    }
    return name;
  };

export const disabledOptions = () => {
  const game = Vue.prototype.$game;
  const disabled = Object.keys(parseURLparams(router.currentRoute).state);
  if (game.config.disableFlatCounts) {
    disabled.push("flatCounts");
  }
  if (game.config.disableShowRoads) {
    disabled.push("showRoads");
  }
  if (!navigator.canShare) {
    disabled.push("nativeSharing");
  }
  return disabled;
};

export const isValidSquare = () => (square) => {
  const game = Vue.prototype.$game;
  if (game) {
    return game.board.isValidSquare(square);
  }
};

export const precedingPlies =
  (state) =>
  (plyID, isDone = false) => {
    const game = Vue.prototype.$game;
    const ply = game.plies[plyID];
    if (!ply) {
      return [];
    }
    const branch = ply.branch;
    return game.plies
      .slice(0, plyID + 1 * isDone)
      .filter((p) => p && p.isInBranch(branch))
      .map((p) => state.ptn.allPlies[p.id]);
  };
