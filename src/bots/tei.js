import Bot from "./bot";
import hashObject from "object-hash";
import { forEach, isEmpty, isNumber } from "lodash";

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
      meta: {
        teiVersion: 0,
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

  getTeiPosition(tps, plyIndex) {
    let posMessage = "position";
    if (isNumber(plyIndex)) {
      tps = this.getInitTPS();
      if (tps) {
        posMessage += " tps " + tps;
      } else {
        posMessage += " startpos";
      }
      posMessage += " moves";
      const plies = this.game.ptn.branchPlies
        .slice(0, 1 + plyIndex)
        .map((ply) => ply.text)
        .join(" ");
      if (plies) {
        posMessage += " " + plies;
      }
    } else {
      posMessage += " tps " + tps;
    }
    return posMessage;
  }

  //#region send
  send(message) {
    if (socket) {
      if (this.settings.log) {
        console.info(">>", message);
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
      this.send(`setoption name ${name} value ${value}`);
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
              console.info("<<", data);
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
    // Validate size/komi
    if (!super.queryPosition(tps, plyIndex)) {
      return false;
    }

    // Send `teinewgame` if necessary
    const initTPS = this.getInitTPS();
    const halfKomi = this.halfKomi;
    if (
      this.state.gameID !== this.game.name ||
      this.state.size !== this.size ||
      this.state.halfKomi !== halfKomi ||
      this.state.initTPS !== initTPS
    ) {
      // New game
      if (this.meta.teiVersion > 0) {
        this.send(`teinewgame size ${this.size} halfkomi ${halfKomi}`);
      } else {
        this.send(`setoption name HalfKomi value ${halfKomi}`);
        this.send(`teinewgame ${this.size}`);
      }
      this.setState("gameID", this.game.name);
      this.setState("size", this.size);
      this.setState("halfKomi", halfKomi);
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
    if (this.isInteractiveEnabled) {
      this.send(`go infinite`);
    } else {
      let goCommand = "go";
      this.meta.limitTypes.forEach((type) => {
        if (
          (!this.settings.limitTypes ||
            this.settings.limitTypes.includes(type)) &&
          this.settings[type]
        ) {
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
      this.onError(response.error);
      return;
    }

    const tps = this.state.tps;

    if (response === "teiok") {
      this.setState("isTeiOk", true);
      if (!this.hasOptions) {
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
    } else if (response.startsWith("id version ")) {
      this.setMeta("version", response.substr(11));
    } else if (response.startsWith("size ")) {
      // Supported sizes and komi
      const sizeHalfKomis = { ...this.meta.sizeHalfKomis };
      let sizes = [];
      let halfKomis = [];
      let tokens = response.trim().split(/\s+/);
      let token;
      while ((token = tokens.shift())) {
        if (token === "size") {
          while (
            tokens.length &&
            tokens[0] !== "size" &&
            tokens[0] !== "halfkomi"
          ) {
            sizes.push(tokens.shift);
          }
        } else if (token === "halfkomi") {
          while (tokens.length && tokens[0] !== "halfkomi") {
            halfKomis.push(Number(tokens.shift()));
          }
        }
      }
      sizes.forEach((size) => {
        sizeHalfKomis[size] = halfKomis;
      });
      if (this.meta.teiVersion < 1) {
        this.setMeta("teiVersion", 1);
      }
      this.setMeta("sizeHalfKomis", sizeHalfKomis);
    } else if (response.startsWith("option ")) {
      // Bot options
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
            while (
              tokens.length &&
              tokens[0] !== "var" &&
              !keys.test(tokens[0])
            ) {
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
      if (name.toLowerCase() === "halfkomi" && isEmpty(this.sizeHalfKomis)) {
        // Intercept half-komi option and translate to sizeHalfKomis
        const sizeHalfKomis = {};
        let halfKomis;
        if (option.type === "spin") {
          halfKomis = [];
          const min = "min" in option ? option.min : -9;
          const max = "max" in option ? option.max : 9;
          for (let k = min; k <= max; k++) {
            halfKomis.push(k);
          }
        } else if (
          option.type === "combo" &&
          option.vars &&
          option.vars.length
        ) {
          halfKomis = option.vars;
        }
        if (halfKomis.length) {
          for (let size of [3, 4, 5, 6, 7, 8]) {
            sizeHalfKomis[size] = halfKomis;
          }
          this.setMeta("sizeHalfKomis", sizeHalfKomis);
        }
      } else {
        if (this.settings.options && name in this.settings.options) {
          option.value = this.settings.options[name];
        } else if ("default" in option) {
          option.value = option.default;
        }
        this.setMeta("options", { ...this.meta.options, [name]: option });
      }
    } else if (response.startsWith("bestmove")) {
      // Search ended
      this.setState("isRunning", false);
      this.setState("isReady", true);
      if (this.isInteractiveEnabled) {
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
          suggestions: [{ pv: [response.substr(9)] }],
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
        nps: null,
        string: "",
        error: "",
        suggestions: [
          {
            pv: [],
            time: null,
            depth: null,
            seldepth: null,
            evaluation: null,
            nodes: null,
          },
        ],
      };

      const keys =
        /^(pv|multipv|time|depth|seldepth|score|nodes|nps|string|error)$/i;
      let key = "";
      let i = 0;
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
          if (key === "multipv") {
            multipv = Number(token);
          } else if (key === "pv") {
            if (multipv && results.suggestions.length < multipv) {
              i = results.suggestions.length - 1;
              results.suggestions.push({
                pv: [],
                time: null,
                depth: null,
                seldepth: null,
                evaluation: null,
                nodes: null,
              });
            }
            results.suggestions[i].pv.push(token);
          } else if (key === "score") {
            switch (scoreType) {
              case "cp":
                results.suggestions[i].evaluation =
                  Number(token) * (initialPlayer === 1 ? 1 : -1);
                break;
              case "win":
                results.suggestions[i].evaluation =
                  (Number(token) * 2 - 100) * (initialPlayer === 1 ? 1 : -1);
                break;
              case "mate":
                results.suggestions[i].evaluation =
                  100 *
                  (Number(token) > 0 ? 1 : -1) *
                  (initialPlayer === 1 ? 1 : -1);
                break;
              case "forced":
                if (token === "draw") {
                  results.suggestions[i].evaluation = 0;
                } else if (token === "win") {
                  results.suggestions[i].evaluation =
                    100 * (initialPlayer === 1 ? 1 : -1);
                } else if (token === "loss") {
                  results.suggestions[i].evaluation =
                    100 * (initialPlayer === 1 ? -1 : 1);
                }
                break;
              default:
                scoreType = token;
            }
          } else {
            switch (key) {
              case "nps":
              case "string":
              case "error":
                if (results[key] === null) {
                  results[key] = Number(token);
                }
                break;
              default:
                if (results.suggestions[i][key] === null) {
                  results.suggestions[i][key] = Number(token);
                }
            }
          }
        }
      }
      if (results.suggestions[0].pv.length) {
        return super.storeResults(results);
      }
    }
  }
}
