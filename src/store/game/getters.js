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
  if (game && game.config.disableFlatCounts) {
    disabled.push("flatCounts");
  }
  if (game && game.config.disableShowRoads) {
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
    if (!game) {
      return [];
    }
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

export const suggestions = (state) => (tps) => {
  if (!tps) {
    return [];
  }

  const results = [];
  let evalData = null;

  // First, find evaluation data (from ply whose tpsAfter matches tps)
  for (let id in state.comments.notes) {
    const notes = state.comments.notes[id];
    const ply = state.ptn.allPlies[id];
    if (!ply) {
      continue;
    }
    if (ply.tpsAfter === tps || (ply.id === 0 && ply.tpsBefore === tps)) {
      const note = notes.find((n) => n.evaluation !== null);
      if (note) {
        evalData = {
          evaluation: note.evaluation,
          depth: note.depth,
          nodes: note.nodes,
          visits: note.visits,
          time: note.ms,
          botName: note.botName,
        };
        break;
      }
    }
  }

  // Find all PVs in new format (pvAfter on ply whose tpsAfter matches tps)
  for (let id in state.comments.notes) {
    const notes = state.comments.notes[id];
    const ply = state.ptn.allPlies[id];
    if (!ply) {
      continue;
    }
    if (ply.tpsAfter === tps || (ply.id === 0 && ply.tpsBefore === tps)) {
      // Find all notes with pvAfter (new format)
      for (const note of notes) {
        if (note.pvAfter !== null) {
          // Determine player/color for the position after this ply
          const nextPlayer = ply.player === 1 ? 2 : 1;
          const nextColor = nextPlayer;
          // Each note.pvAfter can contain multiple PV arrays
          const noteIndex = notes.indexOf(note);
          for (let pvIndex = 0; pvIndex < note.pvAfter.length; pvIndex++) {
            const pvArray = note.pvAfter[pvIndex];
            const pv = parsePV(nextPlayer, nextColor, pvArray);
            const suggestion = {
              ply: pv.splice(0, 1)[0],
              followingPlies: pv,
              // New format: eval/stats are in the same comment
              evaluation: note.evaluation !== null ? note.evaluation : null,
              depth: note.depth !== null ? note.depth : null,
              nodes: note.nodes !== null ? note.nodes : null,
              visits: note.visits !== null ? note.visits : null,
              time: note.ms !== null ? note.ms : null,
              botName: note.botName !== null ? note.botName : null,
              fromNotes: true,
              // Source tracking for deletion
              source: { plyID: id, noteIndex, pvIndex, format: "pvAfter" },
            };
            results.push(suggestion);
          }
        }
      }
    }
  }

  // Find all PVs in old format (pv on ply whose tpsBefore matches tps)
  for (let id in state.comments.notes) {
    const notes = state.comments.notes[id];
    const ply = state.ptn.allPlies[id];
    if (!ply) {
      continue;
    }
    if (ply.tpsBefore === tps) {
      // Find all notes with pv (old format)
      for (const note of notes) {
        if (note.pv !== null) {
          // Each note.pv can contain multiple PV arrays
          const noteIndex = notes.indexOf(note);
          for (let pvIndex = 0; pvIndex < note.pv.length; pvIndex++) {
            const pvArray = note.pv[pvIndex];
            const pv = parsePV(ply.player, ply.color, pvArray);
            const suggestion = {
              ply: pv.splice(0, 1)[0],
              followingPlies: pv,
              // Old format: eval is from separate comment
              evaluation: evalData ? evalData.evaluation : null,
              depth: evalData ? evalData.depth : null,
              nodes: evalData ? evalData.nodes : null,
              visits: evalData ? evalData.visits : null,
              time: evalData ? evalData.time : null,
              botName: evalData ? evalData.botName : null,
              fromNotes: true,
              // Source tracking for deletion
              source: { plyID: id, noteIndex, pvIndex, format: "pv" },
            };
            results.push(suggestion);
          }
        }
      }
    }
  }

  // If no PVs found but we have eval data, return a single suggestion with just eval
  if (results.length === 0 && evalData) {
    results.push({
      ply: null,
      followingPlies: [],
      evaluation: evalData.evaluation,
      depth: evalData.depth,
      nodes: evalData.nodes,
      visits: evalData.visits,
      time: evalData.time,
      botName: evalData.botName,
      fromNotes: true,
    });
  }

  return results;
};

// Convenience getter that returns the first suggestion or null
export const suggestion = (state) => (tps) => {
  const all = suggestions(state)(tps);
  return all.length > 0 ? all[0] : null;
};
