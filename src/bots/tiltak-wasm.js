import Bot from "./bot";

const url = new URL("/tiltak-wasm/tiltak.worker.js", import.meta.url);
let worker = null;

export default class TiltakWasm extends Bot {
  constructor(options) {
    super({
      id: "tiltak",
      icon: "local",
      label: "analysis.bots.tiltak",
      description: "analysis.bots_description.tiltak",
      isInteractive: true,
      sizes: [5, 6],
      halfkomis: { 5: [0, 4], 6: [0, 4] },
      ...options,
    });

    Object.assign(this.status, {
      isTeiOk: false,
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
          this.status.isAnalyzingGame = false;
          this.status.isInteractiveEnabled = false;
          this.status.isRunning = false;
          this.status.isReady = false;
          this.status.time = null;
          this.status.nps = null;
          this.status.tps = null;
          this.status.nextTPS = null;
          this.status.komi = null;
          this.status.size = null;
          this.status.initTPS = null;
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
    if (worker && this.status.isRunning) {
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
      this.status.gameID !== this.game.name ||
      this.status.size !== this.size ||
      this.status.komi !== this.komi ||
      this.status.initTPS !== initTPS
    ) {
      this.send(`setoption name HalfKomi value ${this.komi * 2}`);
      this.send(`teinewgame ${this.size}`);
      this.status.gameID = this.game.name;
      this.status.size = this.size;
      this.status.komi = this.komi;
      this.status.initTPS = initTPS;
      this.status.isReady = false;
      this.send(`isready`);
      this.onReady = () => {
        this.onReady = null;
        this.queryPosition(tps, plyIndex);
      };
      return;
    }

    // Set position
    this.send(this.getTeiPosition(tps, plyIndex));

    // Go
    if (this.status.isInteractiveEnabled) {
      this.send(`go infinite`);
    } else {
      if (!this.settings.limitType || this.settings.limitType === "movetime") {
        this.send(`go movetime ${this.settings.secondsToThink * 1e3}`);
      } else {
        this.send(
          `go ${this.settings.limitType} ${
            this.settings[this.settings.limitType]
          }`
        );
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
    if (!this.status.isReady) {
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
    if (!this.status.isReady) {
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

    const tps = this.status.tps;

    if (response === "teiok") {
      this.status.isTeiOk = true;
      this.send("isready");
    } else if (response === "readyok") {
      this.status.isReady = true;
      if (this.onReady) {
        this.onReady();
      }
    } else if (response.startsWith("bestmove")) {
      // Search ended
      this.status.isRunning = false;
      if (this.status.isInteractiveEnabled) {
        if (this.status.tps === this.status.nextTPS) {
          // No position queued
          this.status.tps = null;
          this.status.nextTPS = null;
        } else {
          this.status.tps = this.status.nextTPS;
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
      this.status.isRunning = true;
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
