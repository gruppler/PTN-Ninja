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

// Identifies the newest ply, so that a mutation that adds or replaces one can
// be told from any other. The newest ply is always last in allPlies, including
// when a tap turns the flat just placed into a wall (same id, new text).
const signatureOf = (state) => {
  const plies = state.game.ptn ? state.game.ptn.allPlies : [];
  const ply = plies[plies.length - 1];
  return ply ? `${state.game.name}|${plies.length}|${ply.id}|${ply.text}` : "";
};

const newestPly = (state) => {
  const plies = state.game.ptn.allPlies;
  return plies[plies.length - 1];
};

export default ({ store }) => {
  let signature = signatureOf(store.state);

  store.subscribe((mutation, state) => {
    const before = signature;
    signature = signatureOf(state);
    if (signature === before || !signature) return;

    const { type, payload } = mutation;
    let live;
    if (type === "game/APPEND_PLY") {
      live = Boolean(payload && payload.playtakLive);
    } else if (
      type === "game/INSERT_PLY" ||
      type === "game/INSERT_PLY_INTERACTIVE"
    ) {
      live = false;
    } else {
      return;
    }

    const mode = state.ui.sound;
    const volume = state.ui.soundVolume;
    if (mode === "off" || !volume) return;
    if (mode === "live" && !live) return;

    const sounds = landingsOf(newestPly(state)).map(({ name, player }) => ({
      name,
      material: materialOf(state, player),
    }));
    if (!sounds.length) return;

    if (
      type === "game/INSERT_PLY_INTERACTIVE" &&
      payload &&
      payload.isAlreadyDone
    ) {
      // The taps that made the move already set its pieces down
      player.play(sounds.slice(-1), { volume: volume / 100 });
      return;
    }

    player.play(sounds, {
      delay: state.ui.animateBoard ? PIECE_TRANSITION : 0,
      gap: DROP_GAP,
      volume: volume / 100,
    });
  });
};
