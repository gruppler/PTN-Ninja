import { SAMPLE_RATE, synth } from "./clack";

// A request made while this many landings are still to come is dropped
const MAX_PENDING = 8;
// How long to wait for a suspended context to start, in ms
const RESUME_TIMEOUT = 250;
const HISTORY_LENGTH = 50;

const defaultFactory = () => new AudioContext({ sampleRate: SAMPLE_RATE });

let factory = defaultFactory;
let master = null;
let unavailable = false;
let seed = 0;
// Start times, on the context's clock, of the landings that may still be ahead
let pending = [];
// Landings waiting for a suspended context to start, each until the time, on
// performance.now()'s clock, it would be too late to play
let waiting = [];

export const player = {
  context: null,
  history: [],

  /**
   * Sound each of the given sounds, `gap` seconds apart, after `delay` seconds.
   * @param {{name: string, material?: string}[]} sounds
   * @param {{delay?: number, gap?: number, volume?: number}} [options]
   */
  play(sounds, { delay = 0, gap = 0, volume = 1 } = {}) {
    const requests = sounds.map(({ name, material = "stone" }, i) => ({
      name,
      material,
      at: delay + i * gap,
      played: false,
    }));
    player.history.push(...requests);
    player.history.splice(0, player.history.length - HISTORY_LENGTH);

    const context = getContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    pending = pending.filter((time) => time > now);
    const asked = performance.now();
    waiting = waiting.filter((landing) => landing.until > asked);
    if (pending.length + waiting.length >= MAX_PENDING) {
      return;
    }

    if (context.state === "running") {
      schedule(context, requests, 0, volume);
      return;
    }

    // Audio only starts after the person has touched the page. A move made
    // before then is not heard, and is never played late.
    const landings = requests.map(() => ({ until: asked + RESUME_TIMEOUT }));
    waiting.push(...landings);
    const stopWaiting = () => {
      waiting = waiting.filter((landing) => !landings.includes(landing));
    };
    Promise.resolve(context.resume())
      .then(() => {
        stopWaiting();
        const waited = performance.now() - asked;
        if (waited <= RESUME_TIMEOUT && context === player.context) {
          schedule(context, requests, waited / 1000, volume);
        }
      })
      .catch(stopWaiting);
  },

  /**
   * Make the context and start it, if it isn't running. Browsers that start
   * audio only while a gesture is being handled need this called then.
   */
  unlock() {
    const context = getContext();
    if (!context || context.state === "running") {
      return;
    }
    try {
      Promise.resolve(context.resume()).catch(() => {});
    } catch (error) {
      // Nothing to do: the next gesture tries again
    }
  },

  /**
   * Replace the way the context is made, or restore the default with null.
   * The current context is closed and forgotten.
   */
  setContextFactory(newFactory) {
    const old = player.context;
    factory = newFactory || defaultFactory;
    player.context = null;
    master = null;
    unavailable = false;
    pending = [];
    waiting = [];
    if (old && typeof old.close === "function") {
      Promise.resolve(old.close()).catch(() => {});
    }
  },
};

function getContext() {
  if (player.context || unavailable) {
    return player.context;
  }
  try {
    const context = factory();
    master = context.createGain();
    master.connect(context.destination);
    player.context = context;
  } catch (error) {
    unavailable = true;
  }
  return player.context;
}

function schedule(context, requests, elapsed, volume) {
  master.gain.value = volume;
  for (const request of requests) {
    const samples = synth(request.name, {
      seed: ++seed,
      pitch: 0.94 + Math.random() * 0.12,
      level: (Math.random() * 2 - 1) * 1.8,
      material: request.material,
    });
    const buffer = context.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(master);
    const start = context.currentTime + Math.max(0, request.at - elapsed);
    source.start(start);
    pending.push(start);
    request.played = true;
  }
}
