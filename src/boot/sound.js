import { getSyncedMainlinePlyIDs } from "../bots/liveFollow";
import { landingsOf, player } from "../sound";

// How long a piece takes to travel to its square, in seconds. Mirrors
// $transition-duration in src/css/quasar.variables.scss. A later plan replaces
// it with the 3D arcs' own landing times when the 3D view is showing.
export const PIECE_TRANSITION = 0.3;

// Seconds between the landings of one move's pieces
export const DROP_GAP = 0.09;

// The material of a player's pieces as the board shows them now. Nothing is
// textured yet, so every piece is stone; a later plan fills this in.
// eslint-disable-next-line no-unused-vars
export const materialOf = (state, player) => "stone";

// Identifies the newest ply, so that a plain APPEND_PLY, which adds one at the
// end of the game, can be told from one that added nothing.
const signatureOf = (state) => {
  const plies = state.game.ptn ? state.game.ptn.allPlies : [];
  const ply = plies[plies.length - 1];
  return ply ? `${state.game.name}|${plies.length}|${ply.id}|${ply.text}` : "";
};

// How many plies of a live game's main line the server has confirmed. A live
// move advances it; a duplicate or an illegal one doesn't.
const syncedOf = (state) => {
  const config = state.game.config;
  const count = config && config.playtakLive ? config.playtakSyncedMainline : 0;
  return { name: state.game.name, count: parseInt(count, 10) || 0 };
};

// Where the game stands, as each kind of move is told from the last mutation
const seenOf = (state) => ({
  signature: signatureOf(state),
  synced: syncedOf(state),
});

// The gain the stored volume (0 to 100) asks for, from 0 to 1. An embed's URL
// gives it as a string, which may not be a number at all.
export const gainOf = (volume) => {
  const gain = Number(volume) / 100;
  return Number.isFinite(gain) ? Math.min(1, Math.max(0, gain)) : 0;
};

const newestPly = (state) => {
  const plies = state.game.ptn.allPlies;
  return plies[plies.length - 1];
};

// The live move just confirmed: the main-line ply at the synced count. It need
// not be last in allPlies: a spectator's move it displaced may come after it.
const syncedPly = (state) => {
  const plies = state.game.ptn.allPlies;
  const ids = getSyncedMainlinePlyIDs(plies, state.game.config);
  return ids && ids.length ? plies[ids[ids.length - 1]] : null;
};

// The ply a mutation made, or null when it made none
const plyMade = ({ type, payload }, before, after, state) => {
  if (type === "game/APPEND_PLY" && payload && payload.playtakLive) {
    const advanced =
      after.synced.name === before.synced.name &&
      after.synced.count > before.synced.count;
    return advanced ? syncedPly(state) : null;
  }
  if (
    type === "game/APPEND_PLY" ||
    type === "game/INSERT_PLY" ||
    type === "game/INSERT_PLY_INTERACTIVE"
  ) {
    const added = after.signature && after.signature !== before.signature;
    return added ? newestPly(state) : null;
  }
  return null;
};

export default ({ store }) => {
  let seen = seenOf(store.state);

  // Runs inside the commit of the move: a failure here must not undo it
  store.subscribe((mutation, state) => {
    try {
      onMutation(mutation, state);
    } catch (error) {
      console.error(error);
    }
  });

  function onMutation(mutation, state) {
    const before = seen;
    seen = seenOf(state);
    const ply = plyMade(mutation, before, seen, state);
    if (!ply) return;

    const { type, payload } = mutation;
    const live = Boolean(
      type === "game/APPEND_PLY" && payload && payload.playtakLive
    );
    const mode = state.ui.sound;
    const volume = gainOf(state.ui.soundVolume);
    if (mode === "off" || !volume) return;
    if (mode === "live" && !live) return;

    const sounds = landingsOf(ply).map(({ name, player: owner }) => ({
      name,
      material: materialOf(state, owner),
    }));
    if (!sounds.length) return;

    if (
      type === "game/INSERT_PLY_INTERACTIVE" &&
      payload &&
      payload.isAlreadyDone
    ) {
      // The taps that made the move already set its pieces down
      player.play(sounds.slice(-1), { volume });
      return;
    }

    player.play(sounds, {
      delay: state.ui.animateBoard ? PIECE_TRANSITION : 0,
      gap: DROP_GAP,
      volume,
    });
  }
};
