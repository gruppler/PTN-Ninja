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
          this.setState({
            isAnalyzingGame: false,
            isRunning: false,
            isReady: false,
            time: null,
            nps: null,
            tps: null,
            nextTPS: null,
            halfkomi: null,
            size: null,
          });
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
    if (worker && this.state.isRunning) {
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
