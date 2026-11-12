// Synthesized "clacks": the sounds of pieces landing. No recordings are used.
//
// A clack as a struck object actually sounds: not a few ringing tones but
// dozens of resonances crowded together, all set off at once and dying within
// a few milliseconds, the high ones soonest, followed by the piece chattering
// as it settles.
//
// A sound is described by a table of third-octave bands (how loud each is and
// how fast it dies) and a list of hits (when, and how loud).

export const SAMPLE_RATE = 44100;

function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Measured from a clack test: stone pieces set down on an oak table, and on
// each other. Each table is [band Hz, level dB, ms to fall 20 dB], averaged
// over the impacts of its kind in the clip with the room's background taken
// out. What the clip shows a clack to be: a broad hump from 1 to 4 kHz, each
// band gone in about 10 ms, and three or four after-taps over the next
// 40 ms as the piece rocks flat. Piece on piece is brighter than piece on
// wood, and taps again almost at once.
//   hits: [milliseconds, dB]      contact: ms the surfaces press together
const MEASURED = {
  flat: [
    [125, -31.1, 7.3],
    [157, -33.1, 23.3],
    [198, -22.4, 7.3],
    [250, -19.6, 7.3],
    [315, -18.6, 7.3],
    [397, -12, 7.3],
    [500, -14.5, 10.6],
    [630, -11.3, 7.1],
    [794, -13.6, 11.1],
    [1000, -10.7, 8],
    [1260, -11.8, 12.1],
    [1587, -6.7, 8.5],
    [2000, -3.2, 21.2],
    [2520, -1.1, 9.3],
    [3175, -4.2, 7.7],
    [4000, -7.2, 5.9],
    [5040, -14.6, 14.5],
    [6350, -12.9, 19.8],
    [8000, -18, 13.9],
    [10079, -27.1, 21.8],
    [12699, -33.3, 23],
  ],
  flatStack: [
    [125, -12.7, 11.3],
    [157, -11.8, 11.5],
    [198, -10, 11.3],
    [250, -11.3, 11.3],
    [315, -14, 11.3],
    [397, -9.4, 11.3],
    [500, -12, 13.6],
    [630, -11.3, 10.3],
    [794, -7.8, 11.9],
    [1000, -6.1, 8.1],
    [1260, -5.8, 9],
    [1587, -6.5, 12.8],
    [2000, -5.3, 12],
    [2520, -2.3, 9.1],
    [3175, -2.8, 9.3],
    [4000, -8.9, 6.4],
    [5040, -16, 14.1],
    [6350, -9.7, 6.2],
    [8000, -9, 4.9],
    [10079, -7.9, 3.4],
    [12699, -12.4, 3.4],
  ],
  cap: [
    [125, -57.7, 17.8],
    [157, -22.5, 17.8],
    [198, -10.1, 17.8],
    [250, -14.6, 17.8],
    [315, -18.2, 17.8],
    [397, -15, 17.8],
    [500, -6.5, 14.1],
    [630, -8.2, 1.1],
    [794, -4, 13.8],
    [1000, -5.4, 13.8],
    [1260, 0, 12],
    [1587, -2.1, 14.9],
    [2000, -0.5, 14.5],
    [2520, -2.5, 7.3],
    [3175, -4.5, 18.9],
    [4000, -7.4, 13.8],
    [5040, -20.2, 13.1],
    [6350, -27.8, 13.4],
    [8000, -30.8, 25],
    [10079, -37.3, 13.1],
    [12699, -45.1, 25],
  ],
  capStack: [
    [125, -18.3, 8],
    [157, -16.8, 6.2],
    [198, -12.7, 8],
    [250, -14, 8],
    [315, -11.2, 8],
    [397, -14.9, 8],
    [500, -15.4, 12],
    [630, -18.2, 6.9],
    [794, -7.1, 5.1],
    [1000, -4.4, 4.7],
    [1260, -4.2, 4.7],
    [1587, -6.8, 6.5],
    [2000, 0, 7.3],
    [2520, -0.6, 6.2],
    [3175, -5.7, 6.2],
    [4000, -8.5, 7.6],
    [5040, -9.5, 6.5],
    [6350, -12, 4.7],
    [8000, -11.2, 5.4],
    [10079, -13.4, 3.3],
    [12699, -19.3, 2.9],
  ],
};
// The same table a step or more up the scale, ringing for a different time:
// for the sounds the clip has no example of
const shifted = (bands, steps, length) =>
  bands.map((b, i) => [
    b[0],
    bands[Math.max(0, i - steps)][1] - (i < steps ? 6 * (steps - i) : 0),
    b[2] * length,
  ]);

export const SOUNDS = {
  flat: {
    bands: MEASURED.flat,
    hits: [
      [0, 0],
      [16, -17],
      [24, -16],
      [42, -20],
    ],
    contact: 1.4,
    gain: -3,
  },
  flatStack: {
    bands: MEASURED.flatStack,
    hits: [
      [0, 0],
      [8, -7],
      [17, -14],
      [24, -16],
    ],
    contact: 1.0,
    gain: -3,
  },
  cap: {
    bands: MEASURED.cap,
    hits: [
      [0, 0],
      [4, -3],
      [17, -13],
      [22, -17],
    ],
    contact: 1.0,
    gain: 0,
  },
  capStack: {
    bands: MEASURED.capStack,
    hits: [
      [0, 0],
      [21, -23],
      [27, -21],
      [42, -27],
    ],
    contact: 1.6,
    gain: 0,
  },
  // Not in the clip. A wall lands on its edge: a smaller contact, so a step
  // higher, shorter, quieter, and it chatters before it stands still.
  wall: {
    bands: shifted(MEASURED.flat, 1, 0.8),
    hits: [
      [0, 0],
      [6, -8],
      [12, -14],
      [17, -20],
      [23, -26],
    ],
    contact: 0.9,
    gain: -7,
  },
  wallStack: {
    bands: shifted(MEASURED.flatStack, 1, 0.8),
    hits: [
      [0, 0],
      [6, -8],
      [12, -14],
      [17, -20],
      [23, -26],
    ],
    contact: 0.8,
    gain: -7,
  },
  // Not in the clip either. The wall going over: piece on piece, rattling down.
  slap: {
    bands: MEASURED.flatStack,
    hits: [
      [0, 0],
      [9, -6],
      [19, -11],
      [27, -16],
      [34, -21],
      [39, -26],
    ],
    contact: 1.0,
    gain: 0,
  },
};
// A capstone flattening a wall: the capstone lands on it, and it slaps flat
SOUNDS.smash = {
  parts: [
    { sound: "capStack", at: 0, db: 0 },
    { sound: "slap", at: 55, db: -1 },
  ],
  gain: 0,
};

// The measurement is of stone, so stone changes nothing. The others are
// guesses at how the same pieces would differ. Wood is softer, so duller and
// rounder. Metal is harder, so brighter and sharper, but a small piece
// pressed against a board is damped by it and can't ring: it lasts barely
// longer than stone.
//   pitch: multiplier on every frequency; tilt: dB per octave, brighter when
//   positive; length: multiplier on every decay; contact: multiplier on how
//   long the surfaces touch
export const MATERIALS = {
  stone: { pitch: 1, tilt: 0, length: 1, contact: 1 },
  wood: { pitch: 0.8, tilt: -2.5, length: 0.9, contact: 1.7 },
  metal: { pitch: 1.15, tilt: 2, length: 1.2, contact: 0.6 },
};

// The most resonances a band gets, and the fewest
const DENSITY = 5;
const FILL = 3;

/**
 * The samples of a named sound, mono at SAMPLE_RATE.
 * @param {string} name - a key of SOUNDS
 * @param {Object} [options]
 * @param {number} [options.seed] - the same seed makes the same sound
 * @param {number} [options.pitch] - multiplies every frequency, on top of the
 *   material's own
 * @param {number} [options.level] - dB
 * @param {string} [options.material] - a key of MATERIALS
 * @returns {Float32Array}
 */
export function synth(
  name,
  { seed = 1, pitch = 1, level = 0, material = "stone" } = {}
) {
  const sound = SOUNDS[name];
  const m = MATERIALS[material];
  const SR = SAMPLE_RATE;

  if (sound.parts) {
    const parts = sound.parts.map((p, i) => ({
      ...p,
      data: synth(p.sound, {
        seed: seed + i * 7919,
        pitch,
        level: 0,
        material,
      }),
    }));
    const out = new Float32Array(
      Math.max(
        ...parts.map((p) => Math.round((p.at / 1000) * SR) + p.data.length)
      )
    );
    parts.forEach((p) => {
      const start = Math.round((p.at / 1000) * SR),
        g = 10 ** (p.db / 20);
      for (let i = 0; i < p.data.length; i++) out[start + i] += p.data[i] * g;
    });
    return finish(out, (sound.gain || 0) + level);
  }

  const rand = rng(seed);
  const freq = pitch * m.pitch;
  const longest = Math.max(...sound.bands.map((b) => b[2])) * m.length;
  const lastHit = Math.max(...sound.hits.map((h) => h[0]));
  const out = new Float32Array(
    Math.ceil(((lastHit * 1.2 + longest * 4) / 1000 + 0.01) * SR)
  );

  const attack = Math.max(0.02, (sound.contact ?? 0.6) * m.contact) / 3000; // seconds
  const ring = (start, f, amp, t20) => {
    if (f > SR * 0.45 || amp < 1e-4) return;
    const tau = ((t20 * m.length) / 1000 / Math.LN10) * (0.7 + rand() * 0.6); // seconds to fall by e
    // Every resonance starts from rest, as a struck object does: starting
    // mid-swing would add a click that isn't in the sound
    const w = (2 * Math.PI * f) / SR,
      phase = rand() < 0.5 ? 0 : Math.PI,
      k = Math.exp(-1 / (tau * SR));
    const n = Math.min(
      out.length - start,
      Math.ceil((tau * 9 + attack * 3) * SR)
    );
    // Contact isn't instant: the two surfaces press together for a moment,
    // so each resonance swells before it dies. A longer contact (softer
    // material, heavier piece) gives a rounder, duller sound.
    const ka = Math.exp(-1 / (attack * SR));
    let env = amp,
      rise = 1;
    for (let i = 0; i < n; i++) {
      const swell = 1 - rise;
      out[start + i] += env * swell * swell * Math.sin(w * i + phase);
      env *= k;
      rise *= ka;
    }
  };

  sound.hits.forEach(([ms, db], h) => {
    const start = Math.round(
      ((ms * (h ? 0.85 + rand() * 0.3 : 1)) / 1000) * SR
    );
    const gain = 10 ** (db / 20);
    sound.bands.forEach(([f0, bandLevel, t20]) => {
      // A real impact sets off so many resonances that its spectrum is
      // nearly continuous. One tone per band leaves peaks and valleys the
      // ear takes for pitch, so each band gets several, spread evenly
      // across it; a band that rings on gets more.
      const count = Math.max(
        FILL,
        Math.min(DENSITY, Math.round((t20 * m.length) / 12))
      );
      for (let i = 0; i < count; i++) {
        const f = f0 * 2 ** (((i + rand()) / count - 0.5) / 3) * freq;
        // A band's level is its share of the energy, so a resonance that
        // dies sooner starts louder to carry the same amount
        ring(
          start,
          f,
          (gain *
            10 ** ((bandLevel + m.tilt * Math.log2(f / 1000)) / 20) *
            (0.6 + rand() * 0.8)) /
            Math.sqrt(t20 * m.length * count),
          t20
        );
      }
    });
  });
  return finish(out, (sound.gain || 0) + level);
}

// Normalize to a fixed peak, then apply the level
function finish(out, db) {
  for (let i = 0; i < 8 && i < out.length; i++) out[i] *= i / 8; // no step at the very start
  let peak = 1e-9;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = (0.8 / peak) * 10 ** (db / 20);
  for (let i = 0; i < out.length; i++) out[i] *= g;
  return out;
}
