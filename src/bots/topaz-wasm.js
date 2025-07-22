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
      sizeHalfKomis: { 6: [0] },
      settings: {
        insertEvalMarks: false,
        limitTypes: ["depth", "movetime"],
        movetime: 5e3,
        depth: 12,
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
      super.onSend(message);
      worker.postMessage(message);
    }
  }
  receive(message) {
    super.onReceive(message);
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

  //#region queryPosition
  async queryPosition(tps, plyID) {
    return new Promise((resolve, reject) => {
      // Validate size/komi
      const init = super.validatePosition(tps, plyID);
      if (!init) {
        reject();
        return false;
      }
      this.onComplete = (results) => {
        this.onComplete = null;
        resolve(results);
      };

      const query = {
        movetime: 1e8,
        depth: 100,
        tps,
        size: this.size,
        komi: init.halfKomi / 2,
        hash: this.getSettingsHash(),
      };
      this.settings.limitTypes.forEach((type) => {
        query[type] = this.settings[type];
      });
      this.send(query);
    });
  }

  //#region normalizeEvaluation
  normalizeEvaluation(value) {
    return 100 * Math.tanh(value / 1000);
  }

  //#region handleResponse
  handleResponse(response) {
    if (response.error) {
      this.onError(response.error);
      return false;
    }

    const { tps, depth, score, nodes, pv, hash } = response;

    const initialPlayer = Number(tps.split(" ")[1]);
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
  async terminate() {
    if (worker && this.state.isRunning) {
      try {
        await worker.terminate();
        super.onTerminate();
        worker = null;
        this.init();
      } catch (error) {
        this.onError(error);
      }
    }
  }
}
