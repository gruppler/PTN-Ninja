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
      requiresConnect: true,
      state: {
        isConnecting: false,
        isConnected: false,
        isTeiOk: false,
        isGameInitialized: false,
      },
      settings: {
        ssl: false,
        address: "localhost",
        port: 7731,
        normalizeEvaluation: false,
        sigma: 100,
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

  getTeiPosition(tps, plyID) {
    let posMessage = "position";
    if (isNumber(plyID)) {
      const initTPS = this.getInitTPS();
      if (initTPS) {
        posMessage += " tps " + initTPS;
      } else {
        posMessage += " startpos";
      }
      posMessage += " moves ";
      const plies = this.getPrecedingPlies(
        plyID,
        tps === this.game.ptn.allPlies[plyID].tpsAfter
      )
        .map((ply) => ply.text)
        .join(" ");
      if (plies) {
        posMessage += plies;
      }
    } else {
      posMessage += " tps " + tps;
    }
    return posMessage;
  }

  //#region send/receive
  send(message) {
    if (socket) {
      this.onSend(message);
      socket.send(message);
    }
  }
  receive(message) {
    this.onReceive(message);
    this.handleResponse(message);
  }

  sendAction(name) {
    this.send(`setoption name ${name}`);
  }

  reset() {
    const meta = {
      name: null,
      author: null,
      options: {},
    };
    const state = {
      isTeiOk: false,
      isGameInitialized: false,
      isConnecting: false,
      isConnected: false,
    };
    this.setMeta(meta);
    this.setState(state);
    super.reset();
  }

  //#region terminate
  async terminate(state) {
    if (socket) {
      try {
        if (this.state.isRunning) {
          this.send("stop");
        }
        this.onTerminate(state);
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
    this.setState({ isReadying: true, isReady: false });
    this.send("isready");
  }

  //#region connect
  async connect(force = false) {
    if (force || !this.state.isConnected) {
      try {
        return await new Promise((resolve, reject) => {
          const url = this.url;

          this.setState({ isConnecting: true });
          socket = new WebSocket(url);
          socket.onopen = () => {
            this.setState({ isConnecting: false, isConnected: true });
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
            this.receive(data);
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

  //#region searchPosition
  async searchPosition(size, halfKomi, tps, plyID, isNewGame) {
    return new Promise((resolve, reject) => {
      if (!this.onComplete) {
        this.onComplete = (results) => {
          this.onComplete = null;
          resolve(results);
        };
      }

      try {
        // Send `teinewgame` if necessary
        if (isNewGame || !this.state.isGameInitialized) {
          if (this.meta.teiVersion > 0) {
            this.send(`teinewgame size ${size} halfkomi ${halfKomi}`);
          } else {
            this.send(`setoption name HalfKomi value ${halfKomi}`);
            this.send(`teinewgame ${size}`);
          }
          this.setState({ isReadying: true, isReady: false });
          this.send("isready");
          this.onReady = () => {
            this.onReady = null;
            this.setState({ isGameInitialized: true });
            this.searchPosition(size, halfKomi, tps, plyID, false);
          };
          return true;
        }

        // Set position
        this.send(this.getTeiPosition(tps, plyID));

        // Go
        if (this.isInteractiveEnabled) {
          this.send(`go infinite`);
        } else {
          let goCommand = "go";
          Object.keys(this.meta.limitTypes).forEach((type) => {
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

        return true;
      } catch (error) {
        reject(error);
      }
    });
  }

  analyzeInteractive() {
    if (this.state.isRunning || this.isGameEnd) {
      this.send("stop");
    }
    return super.analyzeInteractive();
  }

  //#region handleResponse
  handleResponse(response) {
    if (response.error) {
      this.onError(response.error);
      return false;
    }

    const tps = this.state.tps;

    response = response.trim();
    if (response === "teiok") {
      this.setState({ isTeiOk: true });
      if (!this.hasOptions) {
        return this.applyOptions();
      }
    } else if (response === "readyok") {
      this.setState({ isReadying: false, isReady: true });
      if (this.onReady) {
        return this.onReady();
      }
    } else if (response.startsWith("id name ")) {
      return this.setMeta({ name: response.substr(8) });
    } else if (response.startsWith("id author ")) {
      return this.setMeta({ author: response.substr(10) });
    } else if (response.startsWith("id version ")) {
      return this.setMeta({ version: response.substr(11) });
    } else if (response.startsWith("size ")) {
      // Supported sizes and komi
      const sizeHalfKomis = { ...this.meta.sizeHalfKomis };
      let sizes = [];
      let halfKomis = [];
      let tokens = response.split(/\s+/);
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
      const meta = { sizeHalfKomis: sizeHalfKomis };
      if (this.meta.teiVersion < 1) {
        meta.teiVersion = 1;
      }
      return this.setMeta(meta);
    } else if (response.startsWith("option ")) {
      // Bot options
      const keys = /^(name|type|default|min|max|var)$/i;
      let key = "";
      let name = "";
      let option = { type: null };
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
      if (name.toLowerCase() === "halfkomi") {
        if (!isEmpty(this.sizeHalfKomis) || this.meta.teiVersion > 0) {
          // Don't override explicitly defined size/komi
          return true;
        }
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
          halfKomis = option.vars.map(Number);
        }
        if (halfKomis.length) {
          for (let size of [3, 4, 5, 6, 7, 8]) {
            sizeHalfKomis[size] = halfKomis;
          }
          this.setMeta({ sizeHalfKomis: sizeHalfKomis });
        }
      } else {
        this.setMeta({ options: { ...this.meta.options, [name]: option } });
      }
      return;
    } else if (response.startsWith("bestmove")) {
      // Search ended
      const state = { isReady: true };
      const results = {
        tps,
        suggestions: [{ pv: [response.substr(9)] }],
      };
      if (this.isInteractiveEnabled) {
        if (this.state.tps === this.state.nextTPS) {
          // No position queued
          state.tps = null;
          state.nextTPS = null;
        } else {
          state.tps = this.state.nextTPS;
        }
      }
      if (!this.isInteractiveEnabled && !this.state.isAnalyzingGame) {
        state.isRunning = false;
      }
      this.setState(state);
      if (this.onComplete) {
        this.onComplete(results);
      }
      return results;
    } else if (response.startsWith("info") && tps) {
      // Parse Results
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
              case "solved":
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
