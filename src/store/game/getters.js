import Vue from "vue";
import { findLastIndex } from "lodash";
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

export const openPlayer = (state) => {
  if (state.config.isOnline) {
    return state.config.players ? state.config.players.indexOf(null) + 1 : 1;
  } else {
    return null;
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
