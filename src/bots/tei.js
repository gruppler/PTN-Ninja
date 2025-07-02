import Bot from "./bot";
import hashObject from "object-hash";
import { forEach } from "lodash";

let socket = null;

export default class TeiBot extends Bot {
  constructor(options = {}) {
    super({
      id: "tei",
      icon: "tei",
      label: "analysis.bots.tei",
      description: "analysis.bots_description.tei",
      isInteractive: true,
      state: {
        isConnecting: false,
        isConnected: false,
        isTeiOk: false,
      },
      settings: {
        log: false,
        ssl: false,
        address: "localhost",
        port: 7731,
        limitTypes: ["movetime"],
        depth: 10,
        nodes: 1000,
        movetime: 5000,
        options: {},
      },
      ...options,
    });
  }

  //#region Getters
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

  get hasNonKomiOptions() {
    const keys = Object.keys(this.meta.options);
    return (
      keys.length > 1 ||
      (keys.length === 1 && !keys[0].toLowerCase().endsWith("komi"))
    );
  }

  //#region send
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

  //#region init
  init() {
    super.init(true);
    this.connect();
  }

  reset() {
    this.setMeta("name", null);
    this.setMeta("author", null);
    this.setMeta("options", {});
    this.setState("isTeiOk", false);
    this.setState("isConnecting", false);
    this.setState("isConnected", false);
    super.reset();
  }

  //#region terminate
  async terminate() {
    if (socket) {
      try {
        if (this.state.isRunning) {
          this.send("stop");
        }
        super.terminate();
      } catch (error) {
        await socket.close();
        this.init();
      }
    }
  }

  applyOptions() {
    const options = this.getOptions();
    forEach(options, (value, name) => {
      if (name.toLowerCase() !== "halfkomi") {
        this.send(`setoption name ${name} value ${value}`);
      }
    });
    this.setState("isReadying", true);
    this.setState("isReady", false);
    this.send("isready");
  }

  //#region connect
  async connect(force = false) {
    if (force || !this.state.isConnected) {
      try {
        return await new Promise((resolve, reject) => {
          const url = this.url;

          this.setState("isConnecting", true);
          socket = new WebSocket(url);
          socket.onopen = () => {
            this.setState("isConnecting", false);
            this.setState("isConnected", true);
            console.info(`Connected to ${url}`);
            this.send("tei");
            resolve(true);
          };
          socket.onclose = () => {
            console.info(`Disconnected from ${url}`);
            this.terminate();
            this.reset();
          };

          // Error handling
          socket.onerror = (error) => {
            this.terminate();
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

  //#region disconnect
  disconnect() {
    if (socket && this.state.isConnected) {
      this.terminate();
      this.reset();
      socket.close();
      socket = null;
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
        if (this.settings.options && "HalfKomi" in this.settings.options) {
          halfKomi = this.settings.options.HalfKomi;
        } else if ("default" in optionHalfKomi) {
          halfKomi = optionHalfKomi.default;
        }
      }
      this.setOptions({ HalfKomi: halfKomi });
    } else {
      halfKomi = null;
    }

    const initTPS = this.getInitTPS();
    if (
      this.state.gameID !== this.game.name ||
      this.state.size !== this.size ||
      this.state.komi !== halfKomi ||
      this.state.initTPS !== initTPS
    ) {
      // New game
      if (halfKomi !== null) {
        this.send(`setoption name HalfKomi value ${halfKomi}`);
      }
      this.send(`teinewgame ${this.size}`);
      this.setState("gameID", this.game.name);
      this.setState("size", this.size);
      this.setState("komi", halfKomi);
      this.setState("initTPS", initTPS);
      this.setState("isReadying", true);
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
      let goCommand = "go";
      this.settings.limitTypes.forEach((type) => {
        if (this.settings[type]) {
          goCommand += ` ${type} ${this.settings[type]}`;
        }
      });
      this.send(goCommand);
    }
  }

  //#region analyzeInteractive
  analyzeInteractive() {
    if (!socket) {
      this.init();
      return;
    }

    // Abort if worker is not responding
    if (!this.state.isReady) {
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
    if (!this.state.isReady) {
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

    const tps = this.state.tps;

    if (response === "teiok") {
      this.setState("isTeiOk", true);
      if (!this.hasNonKomiOptions) {
        this.applyOptions();
      }
    } else if (response === "readyok") {
      this.setState("isReadying", false);
      this.setState("isReady", true);
      if (this.onReady) {
        this.onReady();
      }
    } else if (response.startsWith("id name ")) {
      this.setMeta("name", response.substr(8));
    } else if (response.startsWith("id author ")) {
      this.setMeta("author", response.substr(10));
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
            while (tokens[0] && tokens[0] !== "var" && !keys.test(tokens[0])) {
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
      this.setMeta("options", { ...this.meta.options, [name]: option });
    } else if (response.startsWith("bestmove")) {
      // Search ended
      this.setState("isRunning", false);
      this.setState("isReady", true);
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
          pvs: [[response.substr(9)]],
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
}
