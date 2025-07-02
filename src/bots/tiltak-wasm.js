import Bot from "./bot";

const url = new URL("/tiltak-wasm/tiltak.worker.js", import.meta.url);
let worker = null;

export default class TiltakWasm extends Bot {
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
        movetime: 5000,
      },
      meta: {
        limitTypes: ["movetime"],
      },
      ...options,
    });
  }

  //#region send
  send(message) {
    if (worker) {
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
          this.handleError(error);
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
          this.setState("komi", null);
          this.setState("size", null);
          this.setState("initTPS", null);
        };

        // Message handling
        worker.onmessage = ({ data }) => {
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
        this.send("stop");
        super.terminate();
      } catch (error) {
        await worker.terminate();
        this.init();
      }
    }
  }

  //#region queryPosition
  queryPosition(tps, plyIndex) {
    // Send `teinewgame` if necessary
    const initTPS = this.getInitTPS();
    if (
      this.state.gameID !== this.game.name ||
      this.state.size !== this.size ||
      this.state.komi !== this.komi ||
      this.state.initTPS !== initTPS
    ) {
      this.send(`setoption name HalfKomi value ${this.komi * 2}`);
      this.send(`teinewgame ${this.size}`);
      this.setState("gameID", this.game.name);
      this.setState("size", this.size);
      this.setState("komi", this.komi);
      this.setState("initTPS", initTPS);
      this.setState("isReady", false);
      this.send("isready");
      this.onReady = () => {
        this.onReady = null;
        this.queryPosition(tps, plyIndex);
      };
      return;
    }

    // Set position
    this.send(this.getTeiPosition(tps, plyIndex));

    // Go
    if (this.state.isInteractiveEnabled) {
      this.send(`go infinite`);
    } else {
      this.send(`go movetime ${this.settings.movetime}`);
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

  //#region handleResponse
  handleResponse(response) {
    if (response.error) {
      this.handleError(response.error);
      return;
    }

    const tps = this.state.tps;

    if (response === "teiok") {
      this.setState("isTeiOk", true);
      this.send("isready");
    } else if (response === "readyok") {
      this.setState("isReady", true);
      if (this.onReady) {
        this.onReady();
      }
    } else if (response.startsWith("bestmove")) {
      // Search ended
      this.setState("isRunning", false);
      if (this.state.isInteractiveEnabled) {
        if (this.state.tps === this.state.nextTPS) {
          // No position queued
          this.setState("tps", null);
          this.setState("nextTPS", null);
        } else {
          this.setState("tps", this.state.nextTPS);
        }
      } else {
        super.storeResults({
          tps,
          pvs: [[response.slice(9)]],
        });
        if (this.onComplete) {
          this.onComplete();
        }
      }
    } else if (response.startsWith("info") && tps) {
      // Parse Results
      this.setState("isRunning", true);
      const results = {
        tps,
        pvs: [[]],
        time: null,
        nps: null,
        depth: null,
        seldepth: null,
        score: null,
        nodes: null,
      };

      const keys = ["pv", "time", "nps", "depth", "seldepth", "score", "nodes"];
      let key = "";
      for (const value of response.split(" ")) {
        if (keys.includes(value)) {
          key = value;
        } else {
          if (key === "pv") {
            results.pvs[0].push(value);
          } else if (key === "score" && value === "cp") {
            continue;
          } else {
            results[key] = Number(value);
          }
        }
      }
      if (tps && results.score !== null) {
        const initialPlayer = Number(tps.split(" ")[1]);
        results.evaluation =
          Number(results.score) * (initialPlayer === 1 ? 1 : -1);
      }
      if (results.pvs[0].length) {
        return super.storeResults(results);
      }
    }
  }
}
