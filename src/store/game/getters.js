import Vue from "vue";
import { findLastIndex } from "lodash";

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

export const disabledOptions = (state) => {
  const game = Vue.prototype.$game;
  const disabled = [];
  if (game.isOnline && !game.hasEnded) {
    if (!game.config.flatCounts) {
      disabled.push("flatCounts");
    }
    if (!game.config.stackCounts) {
      disabled.push("stackCounts");
    }
    if (!game.config.showRoads) {
      disabled.push("showRoads");
    }
    if (!game.config.scratchboard) {
      disabled.push("scratchboard");
    }
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

export const currentBranchIndex = (state) => {
  const branches = state.ptn.branchMenu;
  const index = findLastIndex(
    branches,
    (ply) =>
      state.ptn.branchPlies.find((p) => p.id === ply.id) &&
      ply.id <= state.position.plyID
  );
  return index >= 0 ? index : 0;
};
