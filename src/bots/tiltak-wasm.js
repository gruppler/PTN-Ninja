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
          this.parseResponse(data);
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
  analyzePosition() {
    if (!worker) {
      this.init();
      return;
    }

    // Send `stop` even if unnecessary
    worker.postMessage("stop");

    // Pause if game has ended
    if (isGameEnd) {
      this.isRunning = false;
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
  }

  //#region parseResponse
  parseResponse(response) {
    if (response.error) {
      this.handleError(response.error);
      return;
    }

    const results = {
      pv: [],
      time: null,
      nps: null,
      depth: null,
      seldepth: null,
      score: null,
      nodes: null,
    };
    if (response.startsWith("bestmove")) {
      // Search ended
      this.status.isRunning = false;
      if (this.status.tps === this.status.nextTPS) {
        // No position queued
        this.status.tps = null;
        this.status.nextTPS = null;
      } else {
        this.status.tps = this.status.nextTPS;
      }
      return;
    } else if (response.startsWith("info")) {
      // Parse Results
      this.status.isRunning = true;
      const keys = ["pv", "time", "nps", "depth", "seldepth", "score", "nodes"];
      let key = "";
      for (const value of response.split(" ")) {
        if (keys.includes(value)) {
          key = value;
        } else {
          if (key === "pv") {
            results.pv.push(value);
          } else {
            results[key] = Number(value);
          }
        }
      }
      // Ignore other `info` messages
      if (!results.pv.length) {
        return;
      }
    } else {
      // Ignore all other messages
      return;
    }

    if (!this.status.tps) {
      this.status.tps = this.tps;
    }
    const id = this.getBotSettingsKey({ bot: "tiltak" });
    const tps = this.status.tps;

    // Update time and nps
    if (!this.isGameEnd) {
      this.status.time = results.time;
      this.status.nps = results.nps;
    }

    // Determine ply colors
    const [initialPlayer, moveNumber] = tps.split(" ").slice(1).map(Number);
    const initialColor =
      this.openingSwap && moveNumber === 1
        ? initialPlayer == 1
          ? 2
          : 1
        : initialPlayer;
    let player = initialPlayer;
    let color = initialColor;
    const ply = new Ply(results.pv.splice(0, 1)[0], {
      id: null,
      player,
      color,
    });
    const followingPlies = results.pv.map((ply) => {
      ({ player, color } = this.nextPly(player, color));
      return new Ply(ply, { id: null, player, color });
    });
    const evaluation = results.score * (initialPlayer === 1 ? 1 : -1);
    const depth = results.depth;
    const nodes = results.nodes;
    const suggestions = [{ ply, followingPlies, evaluation, depth, nodes }];
    deepFreeze(suggestions);
    if (
      !this.positions[tps] ||
      !this.positions[tps][id] ||
      this.positions[tps][id][0].depth < suggestions[0].depth
    ) {
      // Don't overwrite deeper searches for this position
      this.$set(this.positions, tps, {
        ...(this.positions[tps] || {}),
        [id]: suggestions,
      });
      return suggestions;
    }
  }

  //#region terminate
  async terminate() {
    if (worker && this.status.isRunning) {
      try {
        worker.postMessage("stop");
        this.status.isRunning = false;
        this.status.tps = null;
        this.status.nextTPS = null;
      } catch (error) {
        await worker.terminate();
        this.init();
      }
    }
  }
}
