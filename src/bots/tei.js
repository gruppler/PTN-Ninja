import Bot from "./bot";
import hashObject from "object-hash";

let socket = null;

export default class TeiBot extends Bot {
  constructor(options) {
    super({
      id: "tei",
      icon: "tei",
      label: "analysis.bots.tei",
      description: "analysis.bots_description.tei",
      isInteractive: true,
      ...options,
    });

    Object.assign(this.status, {
      isConnecting: false,
      isConnected: false,
    });
  }

  send(message) {
    if (socket) {
      if (this.settings.log) {
        console.info(`>ws: ${message}`);
      }
      socket.send(message);
    }
  }

  get protocol() {
    return this.settings.ssl ? "wss://" : "ws://";
  }

  get url() {
    return `${this.protocol}${this.settings.address}:${this.settings.port}/`;
  }

  init() {
    this.connect();
    super.init(true);
  }

  //#region connect
  async connect(force = false) {
    if (force || !this.status.isConnected) {
      try {
        return await new Promise((resolve, reject) => {
          const url = this.url;

          this.status.isConnecting = true;
          socket = new WebSocket(url);
          socket.onopen = () => {
            this.status.isConnecting = false;
            this.status.isConnected = true;
            console.info(`Connected to ${url}`);
            this.send("tei");
            resolve(true);
          };
          socket.onclose = () => {
            console.info(`Disconnected from ${url}`);
            this.status.isEnabled = false;
            this.status.isConnecting = false;
            this.status.isConnected = false;
            this.status.isRunning = false;
            this.status.isReady = false;
            this.status.time = null;
            this.status.nps = null;
            this.status.tps = null;
            this.status.nextTPS = null;
            this.status.komi = null;
            this.status.size = null;
            this.status.initTPS = null;
            this.meta.name = null;
            this.meta.author = null;
          };

          // Error handling
          socket.onerror = (error) => {
            this.status.isEnabled = false;
            this.status.isConnecting = false;
            this.status.isConnected = false;
            this.status.isRunning = false;
            this.status.isReady = false;
            this.status.time = null;
            this.status.nps = null;
            this.status.tps = null;
            this.status.nextTPS = null;
            this.status.komi = null;
            this.status.size = null;
            this.status.initTPS = null;
            this.meta.name = null;
            this.meta.author = null;
            reject(error);
          };

          // Message handling
          socket.onmessage = ({ data }) => {
            if (this.settings.log) {
              console.info(`ws>: ${data}`);
            }
            if (data === "teiok" || data === "readyok") {
              this.status.isReady = true;
              if (this.status.isEnabled) {
                this.requestTeiSuggestions();
              }
            }
            if (data.startsWith("id name ")) {
              this.meta.name = data.substr(8);
            }
            if (data.startsWith("id author ")) {
              this.meta.author = data.substr(10);
            }
            // TODO: Handle options
            this.handleResponse(data);
          };
          return true;
        });
      } catch (error) {
        console.error(error);
      }
    }
  }

  getSettingsHash() {
    return hashObject({
      name: this.meta.name,
      author: this.meta.author,
    });
  }

  //#region analyzePosition
  analyzePosition(tps = this.tps) {
    if (!socket) {
      this.init();
      return;
    }

    // Send `stop` even if unnecessary
    this.send("stop");

    // Pause if game has ended
    if (this.isGameEnd) {
      this.status.time = 0;
      this.status.nps = 0;
      this.status.nextTPS = null;
      return;
    }

    // Abort if worker is not responding
    if (!this.status.isReady) {
      console.error("TEI bot is not ready");
      return;
    }

    // Send `teinewgame` if necessary
    const teiPosition = this.getTeiPosition();
    if (
      this.status.size !== this.size ||
      this.status.komi !== this.komi ||
      this.status.initTPS !== teiPosition
    ) {
      this.send(`teinewgame ${this.size}`);
      this.send(`setoption name HalfKomi value ${this.komi * 2}`);
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
      posMessage += " startpos moves ";
    }
    const teiMoves = this.getTeiMoves();
    if (teiMoves) {
      posMessage += teiMoves;
    }
    this.send(posMessage);
    this.send(`go infinite`);
    this.status.isRunning = true;
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
      this.status.isRunning = false;
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

      this.status.isRunning = true;
      const keys = /^(pv|time|nps|depth|seldepth|score|nodes)$/i;
      let key = "";
      for (const value of response.split(" ")) {
        if (keys.test(value)) {
          key = value.toLowerCase();
        } else {
          if (key === "pv" && value) {
            results.pv.push(value);
          } else if (key === "score" && value === "cp") {
            continue;
          } else if (results[key] === null) {
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
        return super.handleResults(results);
      }
    }
  }

  //#region terminate
  async terminate() {
    if (socket) {
      try {
        if (this.status.isConnected) {
          this.send("stop");
        }
        this.status.isRunning = false;
        this.status.nps = null;
        this.status.nextTPS = null;
      } catch (error) {
        await socket.close();
        this.init();
      }
    }
  }

  //#region disconnect
  disconnect() {
    if (socket && this.status.isConnected) {
      socket.close();
      socket = null;
    }
  }
}
