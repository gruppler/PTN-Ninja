import Bot from "./bot";

const url = new URL("/topaz/topaz.worker.js", import.meta.url);
let worker = null;

export default class TopazWasm extends Bot {
  constructor(options) {
    super({
      id: "topaz",
      icon: "local",
      label: "analysis.bots.topaz",
      description: "analysis.bots_description.topaz",
      isInteractive: false,
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
        return super.init(true);
      } catch (error) {
        console.error("Failed to load Topaz (wasm):", error);
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

    if (!super.analyzePosition(tps, false)) {
      return;
    }

    this.send({
      ...this.settings,
      tps,
      size: this.size,
      komi: this.komi,
      hash: this.settingsHash,
    });
  }

  //#region handleResponse
  handleResponse(response) {
    if (response.error) {
      this.handleError(response.error);
      return;
    }

    const { tps, depth, score, nodes, pv, hash } = response;

    // const initialPlayer = Number(tps.split(" ")[1]);
    // const evaluation = Number(score) * (initialPlayer === 1 ? 1 : -1);

    return super.storeResults({
      hash,
      tps,
      pv,
      depth,
      nodes,
      evaluation: null,
    });
  }

  //#region terminate
  async terminate() {
    if (worker && this.status.isRunning) {
      try {
        await worker.terminate();
        clearInterval(this.status.timer);
        this.status.isRunning = false;
        this.status.isAnalyzingPosition = false;
        this.status.timer = null;
        this.status.analyzingPly = null;
        worker = null;
        this.init();
      } catch (error) {
        this.handleError(error);
      }
    }
  }
}
