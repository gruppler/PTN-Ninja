import Vue from "vue";
import Bot from "./bot";
import hashObject from "object-hash";
import { forEach } from "lodash";

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
      isTeiOk: false,
      isApplyingOptions: false,
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

  sendAction(name) {
    this.send(`setoption name ${name}`);
  }

  get protocol() {
    return this.settings.ssl ? "wss://" : "ws://";
  }

  get url() {
    let url = `${this.protocol}${this.settings.address}`;
    if (this.settings.port) {
      url += `:${this.settings.port}`;
    }
    return url;
  }

  init() {
    super.init(true);
    this.connect();
  }

  reset() {
    this.isInteractiveEnabled = false;
    this.status.isAnalyzingGame = false;
    this.status.isInteractiveRunning = false;
    this.status.isConnecting = false;
    this.status.isConnected = false;
    this.status.isTeiOk = false;
    this.status.isApplyingOptions = false;
    this.status.isReady = false;
    this.status.isRunning = false;
    this.status.time = null;
    this.status.nps = null;
    this.status.tps = null;
    this.status.nextTPS = null;
    this.status.komi = null;
    this.status.size = null;
    this.status.initTPS = null;
    this.meta.name = null;
    this.meta.author = null;
    this.meta.options = {};
  }

  applyOptions() {
    forEach(this.meta.options, ({ value }, name) => {
      if (name.toLowerCase() !== "halfkomi") {
        this.send(`setoption name ${name} value ${value}`);
      }
    });
    this.status.isApplyingOptions = true;
    this.status.isReady = false;
    this.send(`isready`);
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
            this.reset();
          };

          // Error handling
          socket.onerror = (error) => {
            this.reset();
            reject(error);
          };

          // Message handling
          socket.onmessage = ({ data }) => {
            if (this.settings.log) {
              console.info(`ws>: ${data}`);
            }
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

  //#region queryPosition
  queryPosition(tps, plyIndex) {
    // Send `teinewgame` if necessary
    const optionHalfKomi = this.meta.options.HalfKomi;
    let halfKomi = this.komi * 2;
    if (optionHalfKomi) {
      if (
        (optionHalfKomi.type === "spin" && halfKomi < optionHalfKomi.min) ||
        halfKomi > optionHalfKomi.max ||
        (optionHalfKomi.type === "combo" &&
          !optionHalfKomi.vars.includes(halfKomi.toString()))
      ) {
        // Invalid
        halfKomi = optionHalfKomi.value;
      } else {
        // Valid
        optionHalfKomi.value = halfKomi;
      }
    } else {
      halfKomi = null;
    }

    const initTPS = this.getInitTPS();
    if (
      this.status.gameID !== this.game.name ||
      this.status.size !== this.size ||
      this.status.komi !== halfKomi ||
      this.status.initTPS !== initTPS
    ) {
      // New game
      if (halfKomi !== null) {
        this.send(`setoption name HalfKomi value ${halfKomi}`);
      }
      this.send(`teinewgame ${this.size}`);
      this.status.gameID = this.game.name;
      this.status.size = this.size;
      this.status.komi = halfKomi;
      this.status.initTPS = initTPS;
      this.status.isApplyingOptions = true;
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
    if (this.status.isInteractiveRunning) {
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
    if (!socket) {
      this.init();
      return;
    }

    // Abort if worker is not responding
    if (!this.status.isReady) {
      console.error("TEI bot is not ready");
      return;
    }

    super.analyzeInteractive();
  }

  //#region analyzeCurrentPosition
  analyzeCurrentPosition() {
    if (!socket) {
      this.init();
      return;
    }

    // Abort if worker is not responding
    if (!this.status.isReady) {
      console.error("TEI bot is not ready");
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
      if (!this.hasNonKomiOptions) {
        this.applyOptions();
      }
    } else if (response === "readyok") {
      this.status.isApplyingOptions = false;
      this.status.isReady = true;
      if (this.onReady) {
        this.onReady();
      }
    } else if (response.startsWith("id name ")) {
      this.meta.name = response.substr(8);
    } else if (response.startsWith("id author ")) {
      this.meta.author = response.substr(10);
    } else if (response.startsWith("option ")) {
      const keys = /^(name|type|default|min|max|var)$/i;
      let key = "";
      let name = "";
      let option = { value: null };
      let tokens = response.substr(7).trim().split(/\s+/);
      let token;
      while ((token = tokens.shift())) {
        if (keys.test(token)) {
          key = token.toLowerCase();
        } else {
          if (key === "name") {
            if (!name) {
              name = token;
            } else {
              name += " " + token;
            }
          } else if (key === "var") {
            if (!option.vars) {
              option.vars = [];
            }
            while (tokens[0] !== "var" && !keys.test(tokens[0])) {
              token += " " + tokens.shift();
            }
            option.vars.push(token);
          } else if (name && key) {
            if (option.type === "spin") {
              token = Number(token);
            }
            option[key] = token;
          }
        }
      }
      if (this.settings.options && name in this.settings.options) {
        option.value = this.settings.options[name];
      } else if ("default" in option) {
        option.value = option.default;
      }
      Vue.set(this.meta.options, name, option);
    } else if (response.startsWith("bestmove")) {
      // Search ended
      this.status.isRunning = false;
      if (this.status.isInteractiveRunning) {
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
          pvs: [[response.substr(9)]],
        });
        if (this.status.isAnalyzingGame && this.onComplete) {
          this.onComplete();
        } else if (this.status.isAnalyzingPosition) {
          this.status.isAnalyzingPosition = false;
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
        string: "",
        error: "",
      };

      const keys = /^(pv|time|nps|depth|seldepth|score|nodes|string|error)$/i;
      let key = "";
      let multipv = 0;
      let scoreType = "";
      const initialPlayer = Number(tps.split(" ")[1]);
      let tokens = response.substr(5).trim().split(/\s+/);
      let token;
      while ((token = tokens.shift())) {
        if (keys.test(token)) {
          key = token.toLowerCase();
          if (key === "string" || key === "error") {
            results[key] = tokens.join(" ");
            break;
          }
        } else {
          if (key === "pv") {
            if (multipv && results.pvs.length < multipv) {
              results.pvs.push([]);
            }
            results.pvs[multipv ? multipv - 1 : 0].push(token);
          } else if (key === "score") {
            switch (scoreType) {
              case "cp":
              case "lowerbound":
              case "upperbound":
                results.evaluation =
                  Number(token) * (initialPlayer === 1 ? 1 : -1);
                break;
              case "mate":
                results.evaluation =
                  100 *
                  (Number(token) > 0 ? 1 : -1) *
                  (initialPlayer === 1 ? 1 : -1);
                break;
              default:
                scoreType = token;
            }
          } else if (results[key] === null) {
            results[key] = Number(token);
          }
        }
      }
      if (results.pvs[0].length) {
        return super.storeResults(results);
      }
    }
  }

  //#region terminate
  async terminate() {
    if (socket) {
      try {
        if (this.status.isRunning) {
          this.send("stop");
        }
        super.terminate();
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
      this.reset();
    }
  }
}
