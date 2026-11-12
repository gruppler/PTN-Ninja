import { SAMPLE_RATE, SOUNDS, synth } from "./clack";

// A request made while this many landings are still to come is dropped
const MAX_PENDING = 8;
// How long to wait for a suspended context to start, in ms
const RESUME_TIMEOUT = 250;
const HISTORY_LENGTH = 50;
// How many of each sound, in each material, are kept made and ready to play
const POOL_SIZE = 2;
// The longest a refill waits for the page to be idle, in ms
const IDLE_TIMEOUT = 1000;

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
// Sounds made ahead of need, by name and material. Making one takes 10 to 25
// ms, too long to do while a move is being made.
let pools = new Map();
let refilling = false;

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
   * Make each sound in the given material ahead of need, in idle time. Makes
   * no context.
   */
  prime(material = "stone") {
    Object.keys(SOUNDS).forEach((name) => poolOf(name, material));
    refill();
  },

  /**
   * How many of a sound, in a material, are made and ready to play
   */
  ready(name, material = "stone") {
    const pool = pools.get(poolKey(name, material));
    return pool ? pool.samples.length : 0;
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
   * The current context is closed and forgotten, as are the sounds made
   * ahead, so that a test starts from nothing.
   */
  setContextFactory(newFactory) {
    const old = player.context;
    factory = newFactory || defaultFactory;
    player.context = null;
    master = null;
    unavailable = false;
    pending = [];
    waiting = [];
    pools = new Map();
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

const poolKey = (name, material) => `${name}|${material}`;

// The pool of a sound in a material, which is kept full from now on
function poolOf(name, material) {
  const key = poolKey(name, material);
  if (!pools.has(key)) {
    pools.set(key, { name, material, samples: [] });
  }
  return pools.get(key);
}

// Each sound is made with its own seed and its own wander in pitch and level,
// and is played once, so no two landings are alike
function make(name, material) {
  return synth(name, {
    seed: ++seed,
    pitch: 0.94 + Math.random() * 0.12,
    level: (Math.random() * 2 - 1) * 1.8,
    material,
  });
}

// A sound made ahead if there is one, else one made now
function take(name, material) {
  const samples = poolOf(name, material).samples.shift();
  refill();
  return samples || make(name, material);
}

const whenIdle = (callback) =>
  typeof requestIdleCallback === "function"
    ? requestIdleCallback(callback, { timeout: IDLE_TIMEOUT })
    : setTimeout(callback, 0);

// Make one sound in each idle moment until every pool is full again
function refill() {
  if (refilling) {
    return;
  }
  refilling = true;
  whenIdle(function refillOne() {
    const pool = [...pools.values()].find(
      ({ samples }) => samples.length < POOL_SIZE
    );
    if (!pool) {
      refilling = false;
      return;
    }
    pool.samples.push(make(pool.name, pool.material));
    whenIdle(refillOne);
  });
}

function schedule(context, requests, elapsed, volume) {
  master.gain.value = volume;
  for (const request of requests) {
    const samples = take(request.name, request.material);
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
