import Bot, { defaultEvalMarkThresholds } from "./bot";

const url = new URL("/topaz/topaz.worker.js", import.meta.url);
let worker = null;

export default class TopazWasm extends Bot {
  constructor(options = {}) {
    super({
      id: "topaz",
      icon: "local",
      label: "analysis.bots.topaz",
      description: "analysis.bots_description.topaz",
      isInteractive: false,
      sizeHalfKomis: { 6: [0] },
      settings: {
        limitTypes: ["depth", "movetime"],
        movetime: 5e3,
        depth: 12,
        evalMarkThresholds: { ...defaultEvalMarkThresholds },
      },
      limitTypes: {
        movetime: {},
        depth: {},
      },
      ...options,
    });

    this.init();
  }

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
        worker.onmessage = ({ data }) => {
          this.receive(data);
        };
        this.setState({ isReady: true });
        return true;
      } catch (error) {
        console.error("Failed to load Topaz (wasm):", error);
        return false;
      }
    }
  }

  //#region reset
  reset() {
    this.setState({ isReady: false });
    super.reset();
  }

  //#region searchPosition
  async searchPosition(size, halfKomi, tps) {
    return new Promise((resolve, reject) => {
      const query = {
        tps,
        size,
        komi: halfKomi / 2,
        movetime: 1e8,
        depth: 100,
        hash: this.getSettingsHash(),
      };
      // Set search limits
      this.settings.limitTypes.forEach((type) => {
        query[type] = this.settings[type];
      });

      this.onComplete = (results) => {
        this.onComplete = null;
        resolve(results);
      };

      try {
        this.send(query);
      } catch (error) {
        reject(error);
      }
    });
  }

  //#region handleResponse
  handleResponse(response) {
    if (response.error) {
      this.onError(response.error);
      return false;
    }

    const { tps, depth, score, nodes, pv, hash } = response;

    // Get player to move from TPS - score is from their perspective
    const initialPlayer = Number(tps.split(" ")[1]);
    // Normalize to player 1's perspective (positive = good for player 1)
    const evaluation = Number(score) * (initialPlayer === 1 ? 1 : -1);

    const results = {
      hash,
      tps,
      suggestions: [
        {
          pv,
          depth,
          nodes,
          evaluation,
        },
      ],
    };

    if (this.onComplete) {
      this.onComplete(results);
    }
    return results;
  }

  //#region terminate
  async terminate(state) {
    if (worker && this.state.isRunning) {
      try {
        await worker.terminate();
        this.onTerminate(state);
        worker = null;
        this.init();
      } catch (error) {
        this.onError(error);
      }
    }
  }
}
