import Bot from "./bot";
import hashObject from "object-hash";
import { forEach, isEmpty, isNumber, throttle } from "lodash";

const normalizeCheckOptionValue = (value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "on", "yes"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "off", "no"].includes(normalized)) {
      return false;
    }
  }
  return value;
};

const formatCheckOptionValue = (value, option = null) => {
  const normalized = normalizeCheckOptionValue(value);
  if (typeof normalized !== "boolean") {
    return value;
  }
  if (option && option.checkValueStyle === "numeric") {
    return normalized ? "1" : "0";
  }
  return normalized ? "true" : "false";
};

const terminalResultPattern = /^(?:R-0|0-R|F-0|0-F|1-0|0-1|1\/2(?:-1\/2)?)$/i;

const terminalLabelFromPv = (pv = []) => {
  if (!Array.isArray(pv) || pv.length === 0) {
    return null;
  }
  const lastToken = String(pv[pv.length - 1] || "")
    .trim()
    .toUpperCase();
  if (!lastToken) {
    return null;
  }
  if (lastToken === "1/2" || lastToken === "1/2-1/2") {
    return "D";
  }
  if (lastToken === "R-0" || lastToken === "0-R") {
    return "R";
  }
  if (
    lastToken === "F-0" ||
    lastToken === "0-F" ||
    lastToken === "1-0" ||
    lastToken === "0-1"
  ) {
    return "F";
  }
  const inlineType = lastToken.match(/[RFD]$/);
  return inlineType ? inlineType[0] : null;
};

const normalizeTerminalScoreText = (scoreText, pv = []) => {
  if (!scoreText) {
    return scoreText;
  }
  const text = String(scoreText);
  const prefix = text.charAt(0).toUpperCase();
  if (!["T", "W", "L", "D", "R", "F"].includes(prefix)) {
    return scoreText;
  }
  const suffix = text.slice(1);
  if (prefix === "D") {
    return `D${suffix}`;
  }
  // Win/loss labels carry no information about whose side wins (the eval
  // sign + bg color already encode that), but they *do* hide whether it's
  // a road or flat-count win. Prefer the most specific label we can: PV
  // inference first, then default to R since road wins are the
  // overwhelming case for forced-mate scores in Tak — flat-count mates
  // are rare and engines that find one can advertise it by ending the PV
  // with `F-0`/`0-F` (the inference path picks that up).
  const inferredType = terminalLabelFromPv(pv);
  if (inferredType === "F" || inferredType === "R" || inferredType === "D") {
    return `${inferredType}${suffix}`;
  }
  if (prefix === "W" || prefix === "L") {
    return `R${suffix}`;
  }
  return `${prefix}${suffix}`;
};

const stripTerminalResultFromPv = (pv = []) => {
  if (!Array.isArray(pv) || pv.length === 0) {
    return;
  }
  const lastToken = String(pv[pv.length - 1] || "").trim();
  if (terminalResultPattern.test(lastToken)) {
    pv.pop();
  }
};

export default class TeiBot extends Bot {
  constructor(options = {}) {
    super({
      id: "tei",
      icon: "tei",
      label: "analysis.engines.tei",
      description: "analysis.engines_description.tei",
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
        normalizeEvaluation: true,
        sigma: 50,
        limitTypes: ["movetime"],
        depth: 10,
        nodes: 1000,
        movetime: 5000,
        options: {},
      },
      meta: {
        teiVersion: 0,
        pieceCountOptions: {},
      },
      ...options,
    });

    this._socket = null;
    this._bufferedResults = {};
    this._lastSearchTPS = null;
    this._flushBufferedResultsThrottled = throttle(
      () => this.flushBufferedResults(),
      150,
      { leading: false, trailing: true }
    );
  }

  bufferResults(results) {
    if (!results || !results.tps) {
      return;
    }

    const tps = results.tps;
    const existing = this._bufferedResults[tps];
    if (!existing) {
      this._bufferedResults[tps] = {
        ...results,
        suggestions: results.suggestions ? [...results.suggestions] : [],
      };
      return;
    }

    if (results.nps !== null && results.nps !== undefined) {
      existing.nps = results.nps;
    }
    if (results.string) {
      existing.string = results.string;
    }
    if (results.error) {
      existing.error = results.error;
    }

    if (results.suggestions && results.suggestions.length) {
      if (!existing.suggestions) {
        existing.suggestions = [];
      }
      while (existing.suggestions.length < results.suggestions.length) {
        existing.suggestions.push(null);
      }
      results.suggestions.forEach((suggestion, i) => {
        if (suggestion !== null && suggestion !== undefined) {
          existing.suggestions[i] = suggestion;
        }
      });
    }
  }

  flushBufferedResults() {
    if (!this._bufferedResults || !Object.keys(this._bufferedResults).length) {
      return;
    }

    const buffered = this._bufferedResults;
    this._bufferedResults = {};

    const storeResults = (results) => super.storeResults(results);
    Object.keys(buffered).forEach((tps) => {
      const results = buffered[tps];
      if (results && results.tps) {
        storeResults(results);
      }
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
      let precedingPlies = this.getPrecedingPlies(
        plyID,
        tps === this.game.ptn.allPlies[plyID].tpsAfter
      );

      if (this.openingDoubleBlackStack && precedingPlies.length > 0) {
        const firstMovePlies = precedingPlies.filter(
          (ply) => ply.linenum && ply.linenum.number === 1
        );
        if (firstMovePlies.length > 0) {
          const lastFirstMovePly = firstMovePlies[firstMovePlies.length - 1];
          const initTPS = lastFirstMovePly.tpsAfter;
          if (initTPS) {
            posMessage += " tps " + initTPS;
            precedingPlies = precedingPlies.filter(
              (ply) => !ply.linenum || ply.linenum.number !== 1
            );
            const plies = precedingPlies.map((ply) => ply.text).join(" ");
            if (plies) {
              posMessage += " moves " + plies;
            }
            return posMessage;
          }
        }
      }

      const initTPS = this.getInitTPS();
      if (initTPS) {
        posMessage += " tps " + initTPS;
      } else {
        posMessage += " startpos";
      }
      const plies = precedingPlies.map((ply) => ply.text).join(" ");
      if (plies) {
        posMessage += " moves " + plies;
      }
    } else {
      posMessage += " tps " + tps;
    }
    return posMessage;
  }

  //#region send/receive
  send(message) {
    if (this._socket) {
      this.onSend(message);
      this._socket.send(message);
    }
  }
  receive(message) {
    String(message)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        this.onReceive(line);
        this.handleResponse(line);
      });
  }

  sendAction(name) {
    this.send(`setoption name ${name}`);
  }

  reset() {
    if (this._flushBufferedResultsThrottled) {
      this._flushBufferedResultsThrottled.cancel();
    }
    this._bufferedResults = {};

    const meta = {
      name: null,
      author: null,
      options: {},
      pieceCountOptions: {},
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
    if (this._socket) {
      try {
        if (this._flushBufferedResultsThrottled) {
          this._flushBufferedResultsThrottled.flush();
        }
        this.flushBufferedResults();

        if (this.state.isRunning) {
          this.send("stop");
        }
        this.onTerminate(state);
      } catch (error) {
        await this._socket.close();
        this.init();
      }
    }
  }

  applyOptions() {
    const options = this.getOptions();
    const optionEntries = Object.entries(options);
    const multipvEntry = optionEntries.find(
      ([name]) => name.toLowerCase() === "multipv"
    );
    const configuredMultipv = multipvEntry ? Number(multipvEntry[1]) : null;
    const shouldForceMinimalOff =
      Number.isFinite(configuredMultipv) && configuredMultipv > 1;
    const multipvEntries = optionEntries.filter(
      ([name]) => name.toLowerCase() === "multipv"
    );
    const otherEntries = optionEntries.filter(
      ([name]) => name.toLowerCase() !== "multipv"
    );
    [...otherEntries, ...multipvEntries].forEach(([name, value]) => {
      const optionMeta = this.meta.options && this.meta.options[name];
      if (shouldForceMinimalOff && name.toLowerCase() === "minimal") {
        const serialized = formatCheckOptionValue(false, optionMeta);
        this.send(`setoption name ${name} value ${serialized}`);
        return;
      }
      if (optionMeta && optionMeta.type === "check") {
        const serialized = formatCheckOptionValue(value, optionMeta);
        this.send(`setoption name ${name} value ${serialized}`);
        return;
      }
      this.send(`setoption name ${name} value ${value}`);
    });
    this.setState({ isReadying: true, isReady: false });
    this.send("isready");
  }

  applyPieceCountOptions() {
    const pcOpts = this.meta.pieceCountOptions;
    if (!pcOpts || !this.game.config.hasCustomPieceCount) return;
    const pc = this.game.config.pieceCounts;
    // Symmetric options
    if (pcOpts.flats) {
      this.send(`setoption name ${pcOpts.flats.name} value ${pc[1].flat}`);
    }
    if (pcOpts.caps) {
      this.send(`setoption name ${pcOpts.caps.name} value ${pc[1].cap}`);
    }
    // Per-player options
    if (pcOpts.flats1) {
      this.send(`setoption name ${pcOpts.flats1.name} value ${pc[1].flat}`);
    }
    if (pcOpts.flats2) {
      this.send(`setoption name ${pcOpts.flats2.name} value ${pc[2].flat}`);
    }
    if (pcOpts.caps1) {
      this.send(`setoption name ${pcOpts.caps1.name} value ${pc[1].cap}`);
    }
    if (pcOpts.caps2) {
      this.send(`setoption name ${pcOpts.caps2.name} value ${pc[2].cap}`);
    }
  }

  //#region connect
  async connect(force = false) {
    if (force || !this.state.isConnected) {
      try {
        return await new Promise((resolve, reject) => {
          const url = this.url;

          this.setState({ isConnecting: true });
          this._socket = new WebSocket(url);
          this._socket.onopen = () => {
            this.setState({ isConnecting: false, isConnected: true });
            console.info(`Connected to ${url}`);
            this.send("tei");
            resolve(true);
          };
          this._socket.onclose = () => {
            console.info(`Disconnected from ${url}`);
            this.terminate();
            this.reset();
          };

          // Error handling
          this._socket.onerror = (error) => {
            this.terminate();
            this.reset();
            reject(error);
          };

          // Message handling
          this._socket.onmessage = ({ data }) => {
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
    if (this._socket && this.state.isConnected) {
      this.terminate();
      this.reset();
      this._socket.close();
      this._socket = null;
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
          this.applyPieceCountOptions();
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
        this._lastSearchTPS = tps;
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
    if (this.state.isRunning) {
      const target = this.interactiveIsGameEnd ? null : this.interactiveTPS;
      // If we're already searching the target position, just sync nextTPS
      // so the running search completes naturally instead of being stopped
      // and dropped (handleResponse treats tps === nextTPS as "finished").
      if (target && this.state.tps === target) {
        this.setState({ nextTPS: target });
        return;
      }
      // Engine is running on a different target; update nextTPS and stop.
      // handleResponse will start the new search when bestmove is received.
      this.setState({ nextTPS: target });
      this.send("stop");
      return;
    }
    if (this.interactiveIsGameEnd) {
      this.onSearchEnd({ nextTPS: null });
      return;
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
            sizes.push(tokens.shift());
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
      if (option.type === "check" && "default" in option) {
        const defaultToken = String(option.default).trim().toLowerCase();
        if (defaultToken === "0" || defaultToken === "1") {
          option.checkValueStyle = "numeric";
        } else {
          option.checkValueStyle = "boolean";
        }
        option.default = normalizeCheckOptionValue(option.default);
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
      } else if (
        ["flats", "caps", "flats1", "flats2", "caps1", "caps2"].includes(
          name.toLowerCase()
        )
      ) {
        // Intercept piece count options - hide from user, apply automatically
        const pieceCountOptions = { ...(this.meta.pieceCountOptions || {}) };
        pieceCountOptions[name.toLowerCase()] = { ...option, name };
        this.setMeta({ pieceCountOptions });
      } else {
        this.setMeta({ options: { ...this.meta.options, [name]: option } });
      }
      return;
    } else if (response.startsWith("bestmove")) {
      if (this._flushBufferedResultsThrottled) {
        this._flushBufferedResultsThrottled.flush();
      }
      this.flushBufferedResults();

      // Search ended
      const state = { isReady: true };
      const bestmoveTps = tps || this._lastSearchTPS;
      const results = {
        tps: bestmoveTps,
        suggestions: [{ pv: [response.substr(9)] }],
      };
      let hasQueuedPosition = false;
      if (this.isInteractiveEnabled) {
        if (this.state.tps === this.state.nextTPS) {
          // No position queued; engine finished naturally on this position
          state.tps = null;
          state.nextTPS = null;
        } else {
          // A different position was queued while the engine was running
          state.tps = this.state.nextTPS;
          hasQueuedPosition = true;
        }
      }
      if (this.isInteractiveEnabled) {
        this.autoSaveEvalComments(bestmoveTps, "position");
      }
      if (!this.state.isAnalyzingGame && !this.state.isAnalyzingBranch) {
        state.isRunning = false;
      }
      this.setState(state);
      if (this.onComplete) {
        this.onComplete(results);
      }
      if (this.isInteractiveEnabled && hasQueuedPosition) {
        this.analyzeInteractive();
      }
      return results;
    } else if (response.startsWith("info") && tps) {
      // Check if this line has multipv
      const hasMultipv = /\bmultipv\b/i.test(response);

      const bufferedForTps = this._bufferedResults[tps];
      const bufferedHasMultipv =
        bufferedForTps &&
        bufferedForTps.suggestions &&
        bufferedForTps.suggestions.filter((s) => s !== null).length > 1;

      // For non-multipv lines when we already have multiple results:
      // Don't skip entirely — allow updates to slot 0 if the new line has
      // deeper/more complete data (e.g., Topaz sends a final info line after
      // stop without multipv token that contains the best result for PV 1)
      const existingMultipv =
        (this.positions[tps] && this.positions[tps].length > 1) ||
        bufferedHasMultipv;
      if (!hasMultipv && existingMultipv) {
        // Parse depth/nodes from the line to check if it's an improvement
        const depthMatch = response.match(/\bdepth\s+(\d+)/);
        const nodesMatch = response.match(/\bnodes\s+(\d+)/);
        const newDepth = depthMatch ? Number(depthMatch[1]) : null;
        const newNodes = nodesMatch ? Number(nodesMatch[1]) : null;

        const existingSlot0 =
          (bufferedForTps &&
            bufferedForTps.suggestions &&
            bufferedForTps.suggestions[0]) ||
          (this.positions[tps] && this.positions[tps][0]);
        const existingDepth = existingSlot0 ? existingSlot0.depth : null;
        const existingNodes = existingSlot0 ? existingSlot0.nodes : null;

        const isDeeper =
          newDepth !== null &&
          (existingDepth === null || newDepth >= existingDepth);
        const hasMoreNodes =
          newNodes !== null &&
          (existingNodes === null || newNodes >= existingNodes);

        if (isDeeper || hasMoreNodes) {
          // Allow through — will update slot 0 only
        } else {
          return;
        }
      }

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
            wdl: null,
            rawCp: null,
            scoreText: null,
            nodes: null,
          },
        ],
      };

      const keys =
        /^(pv|multipv|time|depth|seldepth|wdl|score|nodes|nps|hashfull|string|error)$/i;
      let key = "";
      let i = 0;
      let scoreType = "";
      const initialPlayer = Number(tps.split(" ")[1]);
      let tokens = response.substr(5).trim().split(/\s+/);
      let token;
      // Properties before multipv need to be applied to the correct suggestion index
      const propsBeforeMultipv = {};
      let seenMultipv = false;
      while ((token = tokens.shift())) {
        if (keys.test(token)) {
          key = token.toLowerCase();
          if (key === "string" || key === "error") {
            results[key] = tokens.join(" ");
            break;
          }
        } else {
          if (key === "multipv") {
            // multipv is 1-indexed; use it to determine suggestion index
            i = Number(token) - 1;
            seenMultipv = true;
            // Ensure suggestions array has enough entries
            while (results.suggestions.length <= i) {
              results.suggestions.push({
                pv: [],
                time: null,
                depth: null,
                seldepth: null,
                evaluation: null,
                wdl: null,
                rawCp: null,
                scoreText: null,
                nodes: null,
              });
            }
            // Apply properties that appeared before multipv to this suggestion
            Object.keys(propsBeforeMultipv).forEach((prop) => {
              if (results.suggestions[i][prop] === null) {
                results.suggestions[i][prop] = propsBeforeMultipv[prop];
              }
            });
            // Move evaluation from suggestion[0] to correct index
            if ("evaluation" in propsBeforeMultipv && i !== 0) {
              results.suggestions[i].evaluation = propsBeforeMultipv.evaluation;
              results.suggestions[0].evaluation = null;
            }
            if ("wdl" in propsBeforeMultipv && i !== 0) {
              results.suggestions[i].wdl = propsBeforeMultipv.wdl;
              results.suggestions[0].wdl = null;
            }
            if ("rawCp" in propsBeforeMultipv && i !== 0) {
              results.suggestions[i].rawCp = propsBeforeMultipv.rawCp;
              results.suggestions[0].rawCp = null;
            }
            if ("scoreText" in propsBeforeMultipv && i !== 0) {
              results.suggestions[i].scoreText = propsBeforeMultipv.scoreText;
              results.suggestions[0].scoreText = null;
            }
          } else if (key === "pv") {
            results.suggestions[i].pv.push(token);
          } else if (key === "wdl") {
            // Prefer `wdl` over non-terminal `score cp`
            const winChance = Number(token);
            const drawChance = Number(tokens.shift());
            const lossChance = Number(tokens.shift());
            if (
              [winChance, drawChance, lossChance].every(
                (value) => !Number.isNaN(value)
              )
            ) {
              const wdl =
                initialPlayer === 1
                  ? {
                      player1: winChance,
                      draw: drawChance,
                      player2: lossChance,
                    }
                  : {
                      player1: lossChance,
                      draw: drawChance,
                      player2: winChance,
                    };
              results.suggestions[i].wdl = wdl;
              if (!seenMultipv) {
                propsBeforeMultipv.wdl = wdl;
              }
              const total = wdl.player1 + wdl.draw + wdl.player2;
              if (total > 0 && results.suggestions[i].scoreText === null) {
                const eval_ =
                  ((wdl.player1 + wdl.draw * 0.5) / total) * 200 - 100;
                results.suggestions[i].evaluation = eval_;
                // Save evaluation for later if multipv hasn't been seen yet
                if (!seenMultipv) {
                  propsBeforeMultipv.evaluation = eval_;
                }
              }
            }
          } else if (key === "score") {
            let eval_ = null;
            let rawCp = null;
            let scoreText = null;
            switch (scoreType) {
              case "cp":
                {
                  const cpScore = Number(token);
                  if (!Number.isNaN(cpScore)) {
                    rawCp = cpScore * (initialPlayer === 1 ? 1 : -1);
                    if (results.suggestions[i].evaluation === null) {
                      eval_ = rawCp;
                    }
                  }
                }
                break;
              case "mate": {
                const matePly = Number(token);
                if (!Number.isNaN(matePly)) {
                  eval_ =
                    100 *
                    (matePly > 0 ? 1 : -1) *
                    (initialPlayer === 1 ? 1 : -1);
                  const mateLabel = matePly >= 0 ? "W" : "L";
                  scoreText = `${mateLabel}${Math.abs(matePly)}`;
                }
                break;
              }
              case "solved": {
                const solvedResult = token;
                let solvedPly = null;
                if (tokens.length) {
                  const nextToken = tokens[0];
                  const maybeSolvedPly = Number(nextToken);
                  if (Number.isFinite(maybeSolvedPly)) {
                    solvedPly = maybeSolvedPly;
                    tokens.shift();
                  }
                }
                if (solvedResult === "draw") {
                  eval_ = 0;
                } else if (solvedResult === "win") {
                  eval_ = 100 * (initialPlayer === 1 ? 1 : -1);
                } else if (solvedResult === "loss") {
                  eval_ = 100 * (initialPlayer === 1 ? -1 : 1);
                }
                if (eval_ !== null) {
                  const solvedDepth = Number.isFinite(solvedPly)
                    ? `${Math.abs(solvedPly)}`
                    : "";
                  const solvedLabel =
                    solvedResult === "draw"
                      ? "D"
                      : solvedResult === "win"
                      ? "W"
                      : "L";
                  scoreText = solvedDepth
                    ? `${solvedLabel}${solvedDepth}`
                    : solvedLabel;
                }
                break;
              }
              case "win":
              case "loss":
              case "draw": {
                const solvedResult = scoreType;
                const solvedPly = Number(token);
                if (solvedResult === "draw") {
                  eval_ = 0;
                } else if (solvedResult === "win") {
                  eval_ = 100 * (initialPlayer === 1 ? 1 : -1);
                } else {
                  eval_ = 100 * (initialPlayer === 1 ? -1 : 1);
                }
                const solvedDepth = Number.isFinite(solvedPly)
                  ? `${Math.abs(solvedPly)}`
                  : "";
                const solvedLabel =
                  solvedResult === "draw"
                    ? "D"
                    : solvedResult === "win"
                    ? "W"
                    : "L";
                scoreText = solvedDepth
                  ? `${solvedLabel}${solvedDepth}`
                  : solvedLabel;
                break;
              }
              default:
                scoreType = token;
            }
            if (rawCp !== null) {
              results.suggestions[i].rawCp = rawCp;
              if (!seenMultipv) {
                propsBeforeMultipv.rawCp = rawCp;
              }
            }
            if (eval_ !== null) {
              results.suggestions[i].evaluation = eval_;
              if (scoreText) {
                results.suggestions[i].scoreText = scoreText;
              }
              // Save evaluation for later if multipv hasn't been seen yet
              if (!seenMultipv) {
                propsBeforeMultipv.evaluation = eval_;
                if (scoreText) {
                  propsBeforeMultipv.scoreText = scoreText;
                }
              }
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
                // If we haven't seen multipv yet, save for later
                if (i === 0 && results.suggestions[0].pv.length === 0) {
                  propsBeforeMultipv[key] = Number(token);
                }
                // Always store on current suggestion
                if (results.suggestions[i][key] === null) {
                  results.suggestions[i][key] = Number(token);
                }
            }
          }
        }
      }

      results.suggestions.forEach((suggestion) => {
        if (!suggestion || !Array.isArray(suggestion.pv)) {
          return;
        }
        if (suggestion.scoreText) {
          suggestion.scoreText = normalizeTerminalScoreText(
            suggestion.scoreText,
            suggestion.pv
          );
        }
        stripTerminalResultFromPv(suggestion.pv);
      });

      // Store if any suggestions have PV data
      // Keep empty slots as null so storeResults knows which indices to update
      const hasValidSuggestion = results.suggestions.some((s) => s.pv.length);
      if (hasValidSuggestion) {
        // Replace empty suggestions with null to preserve index positions
        results.suggestions = results.suggestions.map((s) =>
          s.pv.length ? s : null
        );

        this.bufferResults(results);
        if (this._flushBufferedResultsThrottled) {
          this._flushBufferedResultsThrottled();
        }
        return true;
      }
    }
  }
}
