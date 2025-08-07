import Vue from "vue";
import { parseURLparams } from "../../router/routes";
import router from "../../router";
import { parsePV } from "../../utilities";

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

export const prevTPS = (state) =>
  state.position.plyIsDone
    ? state.position.ply.tpsBefore
    : state.position.prevPly
    ? state.position.prevPly.tpsBefore
    : null;

export const suggestion = (state) => (tps) => {
  if (!tps) {
    return null;
  }

  // Get suggestion from notes
  const suggestion = {
    ply: null,
    followingPlies: [],
    evaluation: null,
    depth: null,
    nodes: null,
    time: null,
    visits: null,
  };
  let notes;
  let note;
  let ply;
  for (let id in state.comments.notes) {
    notes = state.comments.notes[id];
    ply = state.ptn.allPlies[id];
    if (!ply) {
      continue;
    }
    if (suggestion.ply === null && ply.tpsBefore === tps) {
      note = notes.find((n) => n.pv !== null);
      if (note) {
        const pv = parsePV(ply.player, ply.color, note.pv[0]);
        suggestion.ply = pv.splice(0, 1)[0];
        suggestion.followingPlies = pv;
      }
    }
    if (ply.tpsAfter === tps || (ply.id === 0 && ply.tpsBefore === tps)) {
      note = notes.find((n) => n.evaluation !== null);
      if (note) {
        suggestion.evaluation = note.evaluation;
        if (note.depth !== null) {
          suggestion.depth = note.depth;
        }
        if (note.nodes !== null) {
          suggestion.nodes = note.nodes;
        }
        if (note.visits !== null) {
          suggestion.visits = note.visits;
        }
        if (note.ms !== null) {
          suggestion.time = note.ms;
        }
      }
    }
    if (suggestion.ply && suggestion.evaluation) {
      break;
    }
  }

  return suggestion.ply || suggestion.evaluation !== null ? suggestion : null;
};
