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

// The ply the board is on, if it is done: a move made on the board or as text
// leaves the board there, whether the move is new or one the game already had
const positionOf = (state) => {
  const position = state.game.position;
  const ply = position && position.plyIsDone ? position.ply : null;
  return ply ? `${state.game.name}|${ply.id}|${ply.text}` : "";
};

// The pieces in hand while a move is being made on the board, and how many
// squares the move has reached (1 while it is still on its own square)
const handOf = (state) => {
  const selected = state.game.selected;
  return {
    pieces: selected && selected.pieces ? selected.pieces.map((p) => p.id) : [],
    squares: selected && selected.squares ? selected.squares.length : 0,
  };
};

// Where the game stands, as each kind of move is told from the last mutation
const seenOf = (state) => ({
  signature: signatureOf(state),
  synced: syncedOf(state),
  position: positionOf(state),
  hand: handOf(state),
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
  if (type === "game/APPEND_PLY") {
    const added = after.signature && after.signature !== before.signature;
    return added ? newestPly(state) : null;
  }
  if (type === "game/INSERT_PLY" || type === "game/INSERT_PLY_INTERACTIVE") {
    const moved = after.position && after.position !== before.position;
    return moved ? state.game.position.ply : null;
  }
  return null;
};

// The pieces a tap set down, of those that were in hand: the move has left its
// own square, fewer pieces are in hand than before, and some still are. (The
// tap that sets down the last of them completes the move instead.)
const setDown = (before, after) =>
  after.squares >= 2 && after.pieces.length > 0
    ? before.pieces.filter((id) => !after.pieces.includes(id))
    : [];

// The sound of pieces being set down together, as the board now holds them:
// named for the one on top, and on a stack if anything lies under them
const landingOf = (state, ids) => {
  const pieces = state.game.board.pieces;
  const group = ids
    .map((id) => pieces[id])
    .filter(Boolean)
    .sort((a, b) => a.z - b.z);
  if (!group.length) return null;
  const top = group[group.length - 1];
  const name = top.isCapstone ? "cap" : top.isStanding ? "wall" : "flat";
  return {
    name: group[0].z > 0 ? name + "Stack" : name,
    material: materialOf(state, top.color),
  };
};

// Whether the person wants to hear moves at all
const isOn = (state) =>
  state.ui.sound !== "off" && gainOf(state.ui.soundVolume) > 0;

export default ({ store }) => {
  let seen = seenOf(store.state);
  // Sounds are made ahead of need only for someone who will hear them
  let on = isOn(store.state);
  if (on) player.prime();

  // Some browsers (Safari) start audio only while a gesture is being handled,
  // and a live move arrives outside of one: start it on the first touch
  const gestures = ["pointerdown", "keydown"];
  const options = { capture: true, passive: true };
  const unlock = () => {
    if (!isOn(store.state)) return;
    player.unlock();
    if (player.context && player.context.state === "running") {
      gestures.forEach((type) =>
        document.removeEventListener(type, unlock, options)
      );
    }
  };
  gestures.forEach((type) => document.addEventListener(type, unlock, options));

  // Runs inside the commit of the move: a failure here must not undo it
  store.subscribe((mutation, state) => {
    try {
      onMutation(mutation, state);
    } catch (error) {
      console.error(error);
    }
  });

  function onMutation(mutation, state) {
    const wasOn = on;
    on = isOn(state);
    if (on && !wasOn) player.prime();

    const before = seen;
    seen = seenOf(state);
    if (mutation.type === "game/SET_GAME") {
      // A move can re-init the game while it is being made (a tap that turns
      // a flat into a wall the game already has), which commits SET_GAME
      // just before the move's own mutation is seen. Where the board was
      // before the move is still where it was before SET_GAME.
      seen.position = before.position;
      seen.hand = before.hand;
    }
    const { type, payload } = mutation;

    // A move being made on the board, one tap at a time: each piece set down
    // lands when it gets there
    if (type === "game/SELECT_SQUARE") {
      const landing = landingOf(state, setDown(before.hand, seen.hand));
      if (landing && on && state.ui.sound !== "live") {
        player.play([landing], {
          delay: state.ui.animateBoard ? PIECE_TRANSITION : 0,
          volume: gainOf(state.ui.soundVolume),
        });
      }
      return;
    }

    const ply = plyMade(mutation, before, seen, state);
    if (!ply) return;

    const live = Boolean(
      type === "game/APPEND_PLY" && payload && payload.playtakLive
    );
    if (!on) return;
    if (state.ui.sound === "live" && !live) return;
    const volume = gainOf(state.ui.soundVolume);

    const sounds = landingsOf(ply).map(({ name, player: owner }) => ({
      name,
      material: materialOf(state, owner),
    }));
    if (!sounds.length) return;

    const delay = state.ui.animateBoard ? PIECE_TRANSITION : 0;

    if (
      type === "game/INSERT_PLY_INTERACTIVE" &&
      payload &&
      payload.isAlreadyDone
    ) {
      // The move was made by taps, which sounded each piece as it was set
      // down. What is left is what was still in hand: it lands now, on
      // whatever the earlier taps left there. A flattened wall is its own
      // sound, which only the ply knows about.
      const last = sounds[sounds.length - 1];
      const landing =
        last.name === "smash" ? null : landingOf(state, before.hand.pieces);
      player.play([landing || last], { delay, volume });
      return;
    }

    player.play(sounds, { delay, gap: DROP_GAP, volume });
  }
};
