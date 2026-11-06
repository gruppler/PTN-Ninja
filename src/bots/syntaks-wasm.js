import TeiBot from "./tei";

const url = new URL("/syntaks-wasm/syntaks.worker.js", import.meta.url);

// Whether the bundled wasm accepts `go softnodes`
const SOFT_NODES_SUPPORTED = false;
let worker = null;
// Shared-memory ring buffer the worker's stdin reads from, see
// public/syntaks-wasm/syntaks.worker.js
let stdin = null;
let pending = [];

const writeStdin = (message) => {
  const { state, bytes } = stdin;
  const data = new TextEncoder().encode(message + "\n");
  let write = Atomics.load(state, 0);
  for (const byte of data) {
    bytes[write] = byte;
    write = (write + 1) % bytes.length;
  }
  Atomics.store(state, 0, write);
  Atomics.notify(state, 0);
};

// The engine runs threads on shared memory, which needs the page to be
// cross-origin isolated (see the COOP/COEP headers in quasar.conf.js and
// firebase.json)
// And it's built on SIMD, with a faster build for browsers that have relaxed
// SIMD too. These are minimal modules using one instruction of each.
const validates = (bytes) => {
  try {
    return WebAssembly.validate(new Uint8Array(bytes));
  } catch (error) {
    return false;
  }
};
const hasSimd = () =>
  validates([
    0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1,
    8, 0, 65, 0, 253, 15, 253, 98, 11,
  ]);
const hasRelaxedSimd = () =>
  validates([
    0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 15, 1,
    13, 0, 65, 1, 253, 15, 65, 2, 253, 15, 253, 128, 2, 11,
  ]);

export const isSyntaksSupported = () =>
  typeof SharedArrayBuffer !== "undefined" &&
  typeof Worker !== "undefined" &&
  window.crossOriginIsolated !== false &&
  hasSimd();

export default class SyntaksWasm extends TeiBot {
  constructor(options = {}) {
    super({
      id: "syntaks",
      icon: "local",
      label: "analysis.engines.syntaks",
      description: "analysis.engines_description.syntaks",
      isInteractive: true,
      requiresConnect: false,
      state: {
        isTeiOk: false,
      },
      settings: {
        limitTypes: ["nodes"],
        movetime: 5e3,
        nodes: 1e6,
        // The engine declares its options after these, so its own defaults
        // (MultiPV 1, HumanWDL off, Hash 64) have to be overridden here
        options: { MultiPV: 3, HumanWDL: true, Hash: 128 },
      },
      limitTypes: {
        movetime: {},
        nodes: {},
      },
      options: {
        MultiPV: { type: "spin", default: 3, min: 1, max: 8 },
      },
      ...options,
    });

    // Syntaks is harsher than most engines, so it takes a bigger drop in win
    // share to call a move a mistake or a blunder. Set here because passing
    // meta to the constructor would replace the TEI defaults.
    this.meta.reportsWdl = true;
    // The node limit becomes a soft one that finishes the current depth, with
    // the hard cap at this multiple of it. Needs `go softnodes`, which the
    // bundled wasm doesn't have yet: set this once it's rebuilt from upstream
    this.meta.softNodesCap = SOFT_NODES_SUPPORTED ? 4 : 0;
    this.meta.evalMarkThresholds = {
      brilliant: 6,
      good: 3,
      bad: -15,
      blunder: -30,
    };

    this.connect = null;
    this.disconnect = null;
  }

  // The engine is a 13 MB download and runs a search thread pool, so it
  // starts when it's first selected rather than with the app
  activate() {
    this.init();
  }

  //#region send/receive
  send(message) {
    if (!worker && !this.init()) return;
    this.onSend(message);
    if (stdin) {
      writeStdin(message);
    } else {
      // The worker hasn't handed over its stdin yet
      pending.push(message);
    }
  }
  receive(message) {
    this.onReceive(message);
    this.handleResponse(message);
  }

  //#region handleResponse
  handleResponse(response) {
    const result = super.handleResponse(response);
    // Like the other local engines, send the declared options as soon as the
    // engine is up so it becomes ready without user intervention.
    const trimmed = typeof response === "string" ? response.trim() : "";
    if (trimmed === "teiok" && this.hasOptions) {
      this.applyOptions();
    }
    return result;
  }

  //#region init
  init(force = false) {
    // Don't initialize worker in embed mode (iframe)
    if (window !== window.parent) return false;
    if (!isSyntaksSupported()) return false;
    if (force || !worker) {
      try {
        stdin = null;
        pending = [];
        worker = new Worker(hasRelaxedSimd() ? url + "?relaxed" : url);

        // Error handling
        worker.onerror = (error) => {
          console.info(
            "Syntaks (wasm) worker encountered an error. Restarting...",
            error.message
          );
          // A script the browser refused to start has no message
          this.onError(error.message || "Syntaks (wasm) failed to load");
          this.terminate();
        };

        // Message handling
        worker.onmessage = ({ data }) => {
          if (typeof data === "string") {
            this.receive(data);
          } else if (data && data.stdin) {
            stdin = {
              state: new Int32Array(data.stdin, 0, 2),
              bytes: new Uint8Array(data.stdin, 16),
            };
            const queued = pending;
            pending = [];
            queued.forEach(writeStdin);
          }
        };

        // Init
        this.send("tei");
        return true;
      } catch (error) {
        console.error("Failed to load Syntaks (wasm):", error);
        return false;
      }
    }
  }

  //#region terminate
  async terminate(state) {
    if (worker) {
      try {
        if (this.state.isRunning) {
          this.send("stop");
        }
        this.onTerminate(state);
      } catch (error) {
        await worker.terminate();
        worker = null;
        this.init();
      }
    }
  }
}
