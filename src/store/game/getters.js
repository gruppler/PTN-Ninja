import Vue from "vue";
import { parseURLparams } from "../../router/routes";
import router from "../../router";
import { parsePV } from "../../utilities";
import { bothPlayersHaveFlats } from "../../Game/PTN/TPS";

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

  // Check if this is the initial position (tps matches first ply's tpsBefore)
  // Also handle case where there are no plies (empty game with starting TPS)
  const firstPly = state.ptn.allPlies[0];
  const hasNoPlies = !state.ptn.allPlies || state.ptn.allPlies.length === 0;
  const isInitialPosition =
    (firstPly && firstPly.tpsBefore === tps) || hasNoPlies;

  // First, check ply -1 for initial position analysis
  if (isInitialPosition && state.comments.notes[-1]) {
    const notes = state.comments.notes[-1];
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
    }
  }

  // Then, find evaluation data (from ply whose tpsAfter matches tps)
  if (!evalData) {
    for (let id in state.comments.notes) {
      const notes = state.comments.notes[id];
      const ply = state.ptn.allPlies[id];
      if (!ply) {
        continue;
      }
      if (ply.tpsAfter === tps) {
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
  }

  // Check ply -1 for PVs in new format (initial position)
  if (isInitialPosition && state.comments.notes[-1]) {
    const notes = state.comments.notes[-1];
    // Parse TPS to get player and move number: "board player moveNumber"
    const tpsParts = tps.split(" ");
    const tpsPlayer = tpsParts.length >= 2 ? Number(tpsParts[1]) : 1;
    const tpsMoveNumber = tpsParts.length >= 3 ? Number(tpsParts[2]) : 1;
    // Opening swap: on move 1 when both players haven't placed flats yet
    const isFirstMove = tpsMoveNumber === 1 && !bothPlayersHaveFlats(tps);
    const tpsColor =
      state.config.openingSwap && isFirstMove
        ? tpsPlayer === 1
          ? 2
          : 1
        : tpsPlayer;
    for (const note of notes) {
      if (note.pvAfter !== null) {
        const noteIndex = notes.indexOf(note);
        for (let pvIndex = 0; pvIndex < note.pvAfter.length; pvIndex++) {
          const pvArray = note.pvAfter[pvIndex];
          const pv = parsePV(tpsPlayer, tpsColor, pvArray);
          const suggestion = {
            ply: pv.splice(0, 1)[0],
            followingPlies: pv,
            evaluation: note.evaluation !== null ? note.evaluation : null,
            depth: note.depth !== null ? note.depth : null,
            nodes: note.nodes !== null ? note.nodes : null,
            visits: note.visits !== null ? note.visits : null,
            time: note.ms !== null ? note.ms : null,
            botName: note.botName !== null ? note.botName : null,
            fromNotes: true,
            source: { plyID: -1, noteIndex, pvIndex, format: "pvAfter" },
          };
          results.push(suggestion);
        }
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
    if (ply.tpsAfter === tps) {
      // Find all notes with pvAfter (new format)
      for (const note of notes) {
        if (note.pvAfter !== null) {
          // Determine player/color for the position after this ply
          const nextPlayer = ply.player === 1 ? 2 : 1;
          // Parse TPS to get move number for opening swap check
          const tpsParts = tps.split(" ");
          const tpsMoveNumber = tpsParts.length >= 3 ? Number(tpsParts[2]) : 1;
          const isFirstMove = tpsMoveNumber === 1 && !bothPlayersHaveFlats(tps);
          const nextColor =
            state.config.openingSwap && isFirstMove
              ? nextPlayer === 1
                ? 2
                : 1
              : nextPlayer;
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

  // Check ply -1 for PVs in old format (initial position)
  if (isInitialPosition && state.comments.notes[-1]) {
    const notes = state.comments.notes[-1];
    // Parse TPS to get player and move number: "board player moveNumber"
    const tpsPartsOld = tps.split(" ");
    const tpsPlayerOld = tpsPartsOld.length >= 2 ? Number(tpsPartsOld[1]) : 1;
    const tpsMoveNumberOld =
      tpsPartsOld.length >= 3 ? Number(tpsPartsOld[2]) : 1;
    // Opening swap: on move 1 when both players haven't placed flats yet
    const isFirstMoveOld = tpsMoveNumberOld === 1 && !bothPlayersHaveFlats(tps);
    const tpsColorOld =
      state.config.openingSwap && isFirstMoveOld
        ? tpsPlayerOld === 1
          ? 2
          : 1
        : tpsPlayerOld;
    for (const note of notes) {
      if (note.pv !== null) {
        const noteIndex = notes.indexOf(note);
        for (let pvIndex = 0; pvIndex < note.pv.length; pvIndex++) {
          const pvArray = note.pv[pvIndex];
          const pv = parsePV(tpsPlayerOld, tpsColorOld, pvArray);
          const suggestion = {
            ply: pv.splice(0, 1)[0],
            followingPlies: pv,
            evaluation: evalData ? evalData.evaluation : null,
            depth: evalData ? evalData.depth : null,
            nodes: evalData ? evalData.nodes : null,
            visits: evalData ? evalData.visits : null,
            time: evalData ? evalData.time : null,
            botName: evalData ? evalData.botName : null,
            fromNotes: true,
            source: { plyID: -1, noteIndex, pvIndex, format: "pv" },
          };
          results.push(suggestion);
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
