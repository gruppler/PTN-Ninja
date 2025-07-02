import TeiBot from "./tei";

const url = new URL("/tiltak-wasm/tiltak.worker.js", import.meta.url);
let worker = null;

export default class TiltakWasm extends TeiBot {
  constructor(options = {}) {
    super({
      id: "tiltak",
      icon: "local",
      label: "analysis.bots.tiltak",
      description: "analysis.bots_description.tiltak",
      isInteractive: true,
      sizeHalfKomis: { 5: [0, 4], 6: [0, 4] },
      state: {
        isTeiOk: false,
      },
      settings: {
        log: false,
        movetime: 5000,
      },
      limitTypes: ["movetime"],
      ...options,
    });
  }

  // Freeze meta
  setMeta() {}

  // Disable non-applicable inherited methods
  connect() {}
  disconnect() {}

  //#region send
  send(message) {
    if (worker) {
      if (this.settings.log) {
        console.info(">>", message);
      }
      worker.postMessage(message);
    }
  }

  //#region init
  init(force = false) {
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
          if (worker) {
            worker.terminate();
            worker = null;
          }
          this.isInteractiveEnabled = false;
          this.setState("isAnalyzingGame", false);
          this.setState("isRunning", false);
          this.setState("isReady", false);
          this.setState("time", null);
          this.setState("nps", null);
          this.setState("tps", null);
          this.setState("nextTPS", null);
          this.setState("halfkomi", null);
          this.setState("size", null);
          this.setState("initTPS", null);
        };

        // Message handling
        worker.onmessage = ({ data }) => {
          if (this.settings.log) {
            console.info("<<", data);
          }
          this.handleResponse(data);
        };

        // Init
        this.send("isready");
        return super.init(true);
      } catch (error) {
        console.error("Failed to load Tiltak (wasm):", error);
        return super.init(false);
      }
    }
  }

  //#region terminate
  async terminate() {
    if (worker && this.state.isRunning) {
      try {
        super.terminate();
      } catch (error) {
        await worker.terminate();
        this.init();
      }
    }
  }

  //#region analyzeInteractive
  analyzeInteractive() {
    if (!worker) {
      this.init();
      return;
    }

    // Abort if worker is not responding
    if (!this.state.isReady) {
      console.error("Tiltak worker failed to initialize");
      return;
    }

    return super.analyzeInteractive();
  }

  //#region analyzeCurrentPosition
  analyzeCurrentPosition() {
    if (!worker) {
      this.init();
      return;
    }

    // Abort if worker is not responding
    if (!this.state.isReady) {
      console.error("Tiltak worker failed to initialize");
      return;
    }

    super.analyzeCurrentPosition();
  }
}
