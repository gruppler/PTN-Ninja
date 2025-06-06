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
      ...options,
    });
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
          this.status.isRunning = false;
          this.status.isInteractiveRunning = false;
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
          if (data === "teiok" || data === "readyok") {
            this.status.isReady = true;
          }
          this.handleResponse(data);
        };

        // Init
        worker.postMessage("isready");
        return super.init(true);
      } catch (error) {
        console.error("Failed to load Tiltak (wasm):", error);
        return super.init(false);
      }
    }
  }

  //#region analyzePosition
  analyzePosition(tps = this.tps) {
    if (!worker) {
      this.init();
      return;
    }

    // Send `stop` even if unnecessary
    worker.postMessage("stop");

    // Pause if game has ended
    if (this.isGameEnd) {
      this.isRunning = false;
      this.isInteractiveRunning = false;
      this.status.nextTPS = null;
      return;
    }

    // Abort if worker is not responding
    if (!this.status.isReady) {
      console.error("Tiltak worker failed to initialize");
      return;
    }

    // Send `teinewgame` if necessary
    const teiPosition = this.getTeiPosition();
    if (
      this.status.size !== this.size ||
      this.status.komi !== this.komi ||
      this.status.initTPS !== teiPosition
    ) {
      worker.postMessage(`teinewgame ${this.size}`);
      worker.postMessage(`setoption name HalfKomi value ${this.komi * 2}`);
      this.status.size = this.size;
      this.status.komi = this.komi;
      this.status.initTPS = teiPosition;
    }

    // Queue current position for pairing with future response
    this.status.nextTPS = tps;
    if (!this.status.tps) {
      this.status.tps = this.status.nextTPS;
    }

    // Send current position
    let posMessage = "position";
    if (this.status.initTPS) {
      posMessage += " tps " + this.status.initTPS;
    } else {
      posMessage += " startpos";
    }
    const teiMoves = this.getTeiMoves();
    if (teiMoves) {
      posMessage += " moves " + teiMoves;
    }
    worker.postMessage(posMessage);
    worker.postMessage("go infinite");
    this.status.isRunning = true;
    this.status.isInteractiveRunning = true;
  }

  //#region handleResponse
  handleResponse(response) {
    if (response.error) {
      this.handleError(response.error);
      return;
    }

    const tps = this.status.tps;

    if (response.startsWith("bestmove")) {
      // Search ended
      this.status.isLoading = false;
      if (this.status.tps === this.status.nextTPS) {
        // No position queued
        this.status.tps = null;
        this.status.nextTPS = null;
      } else {
        this.status.tps = this.status.nextTPS;
      }
      return;
    } else if (response.startsWith("info") && tps) {
      // Parse Results
      const results = {
        tps,
        pv: [],
        time: null,
        nps: null,
        depth: null,
        seldepth: null,
        score: null,
        nodes: null,
      };

      this.status.isLoading = true;
      const keys = ["pv", "time", "nps", "depth", "seldepth", "score", "nodes"];
      let key = "";
      for (const value of response.split(" ")) {
        if (keys.includes(value)) {
          key = value;
        } else {
          if (key === "pv") {
            results.pv.push(value);
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
      if (results.pv.length) {
        return super.storeResults(results);
      }
    }
  }

  //#region terminate
  async terminate() {
    if (worker && this.status.isRunning) {
      try {
        worker.postMessage("stop");
        this.status.isRunning = false;
        this.status.isInteractiveRunning = false;
        this.status.nextTPS = null;
      } catch (error) {
        await worker.terminate();
        this.init();
      }
    }
  }
}
