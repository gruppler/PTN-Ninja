import Bot from "./bot";

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
      settings: {
        log: false,
        limitTypes: ["depth", "movetime"],
        movetime: 5000,
        depth: 12,
      },
      limitTypes: ["depth", "movetime"],
      ...options,
    });
  }

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
        worker.onmessage = ({ data }) => {
          this.handleResponse(data);
        };
        this.setState("isReady", true);
        return super.init(true);
      } catch (error) {
        console.error("Failed to load Topaz (wasm):", error);
        return super.init(false);
      }
    }
  }

  //#region reset
  reset() {
    this.setState("isReady", false);
    super.reset();
  }

  //#region queryPosition
  queryPosition(tps) {
    // Validate size/komi
    if (!super.queryPosition(tps, plyIndex)) {
      return false;
    }

    const query = {
      movetime: 1e8,
      depth: 100,
      tps,
      size: this.size,
      komi: this.komi,
      hash: this.getSettingsHash(),
      log: this.settings.log,
    };
    this.settings.limitTypes.forEach((type) => {
      query[type] = this.settings[type];
    });
    this.send(query);
  }

  //#region analyzeCurrentPosition
  analyzeCurrentPosition() {
    if (!worker) {
      this.init();
      return;
    }

    super.analyzeCurrentPosition();
  }

  //#region analyzeGame
  analyzeGame() {
    if (!worker) {
      this.init();
      return;
    }

    super.analyzeGame();
  }

  //#region handleResponse
  handleResponse(response) {
    if (response.error) {
      this.onError(response.error);
      return;
    }

    const { tps, depth, score, nodes, pv, hash } = response;

    // const initialPlayer = Number(tps.split(" ")[1]);
    // const evaluation = Number(score) * (initialPlayer === 1 ? 1 : -1);

    super.storeResults({
      hash,
      tps,
      suggestions: [
        {
          pv,
          depth,
          nodes,
          evaluation: null,
        },
      ],
    });

    if (this.onComplete) {
      this.onComplete();
    }
  }

  //#region terminate
  async terminate() {
    if (worker && this.state.isRunning) {
      try {
        await worker.terminate();
        super.terminate();
        worker = null;
        this.init();
      } catch (error) {
        this.onError(error);
      }
    }
  }
}
