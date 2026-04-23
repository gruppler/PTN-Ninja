import TeiBot from "./tei";

const url = new URL("/tiltak-wasm/tiltak.worker.js", import.meta.url);
let worker = null;

export default class TiltakWasm extends TeiBot {
  constructor(options = {}) {
    super({
      id: "tiltak",
      icon: "local",
      label: "analysis.engines.tiltak",
      description: "analysis.engines_description.tiltak",
      isInteractive: true,
      requiresConnect: false,
      sizeHalfKomis: { 5: [0, 4], 6: [0, 4] },
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

  // Freeze meta
  setMeta() {}

  //#region send/receive
  send(message) {
    if (worker) {
      this.onSend(message);
      worker.postMessage(message);
    }
  }
  receive(message) {
    this.onReceive(message);
    this.handleResponse(message);
  }

  //#region handleResponse
  handleResponse(response) {
    const result = super.handleResponse(response);
    // TeiBot only auto-applies options on teiok when the bot has no options.
    // For the local wasm engine we want declared options (MultiPV) to be sent
    // automatically so the engine becomes ready without user intervention.
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
    if (force || !worker) {
      try {
        worker = new Worker(url);

        // Error handling
        worker.onerror = (error) => {
          console.info(
            "Tiltak (wasm) worker encountered an error. Restarting...",
            error.message
          );
          this.onError(error);
          this.terminate();
        };

        // Message handling
        worker.onmessage = ({ data }) => {
          this.receive(data);
        };

        // Init
        this.send("isready");
        return true;
      } catch (error) {
        console.error("Failed to load Tiltak (wasm):", error);
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
        this.init();
      }
    }
  }
}
