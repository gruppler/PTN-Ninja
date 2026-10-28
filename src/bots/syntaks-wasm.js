import TeiBot from "./tei";

const url = new URL("/syntaks-wasm/syntaks.worker.js", import.meta.url);
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
export const isSyntaksSupported = () =>
  typeof SharedArrayBuffer !== "undefined" &&
  typeof Worker !== "undefined" &&
  window.crossOriginIsolated !== false;

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
        nodes: 1e5,
      },
      limitTypes: {
        movetime: {},
        nodes: {},
      },
      options: {
        MultiPV: { type: "spin", default: 5, min: 1, max: 8 },
      },
      ...options,
    });

    this.connect = null;
    this.disconnect = null;

    this.init();
  }

  //#region send/receive
  send(message) {
    if (!worker) return;
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
        worker = new Worker(url);

        // Error handling
        worker.onerror = (error) => {
          console.info(
            "Syntaks (wasm) worker encountered an error. Restarting...",
            error.message
          );
          this.onError(error);
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
