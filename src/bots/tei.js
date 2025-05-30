import Bot from "./bot";

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
      if (this.settings.tei.log) {
        console.info(`>ws: ${message}`);
      }
      socket.send(message);
    }
  }

  get url() {
    const protocol = this.settings.ssl ? "wss://" : "ws://";
    return `${protocol}${this.settings.address}:${this.settings.port}/`;
  }

  //#region init
  async init(force = false) {
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
            this.status.isLoading = false;
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
            this.status.isLoading = false;
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
            if (this.settings.tei.log) {
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
            this.parseResponse(data);
          };
          return super.init(true);
        });
      } catch (error) {
        return super.init(false);
      }
    }
  }

  //#region analyzePosition
  analyzePosition() {
    if (!socket) {
      this.initTei();
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
    this.status.isLoading = true;
  }

  //#region parseResponse
  parseResponse(response) {
    if (response.error) {
      this.handleError(response.error);
      return;
    }

    const results = {
      pv: [],
      time: null,
      nps: null,
      depth: null,
      seldepth: null,
      score: null,
      nodes: null,
    };
    if (response.startsWith("bestmove")) {
      // Search ended
      this.status.isLoading = false;
      this.status.nps = 0;
      if (this.status.tps === this.status.nextTPS) {
        // No position queued
        this.status.tps = null;
        this.status.nextTPS = null;
      } else {
        this.status.tps = this.status.nextTPS;
      }
      return;
    } else if (response.startsWith("info")) {
      // Parse Results
      this.status.isLoading = true;
      const keys = ["pv", "time", "nps", "depth", "seldepth", "score", "nodes"];
      let key = "";
      for (const value of response.split(" ")) {
        if (keys.includes(value)) {
          key = value;
        } else {
          if (key === "pv") {
            results.pv.push(value);
          } else {
            results[key] = Number(value);
          }
        }
      }
      // Ignore other `info` messages
      if (!results.pv.length) {
        return;
      }
    } else {
      // Ignore all other messages
      return;
    }

    if (!this.status.tps) {
      this.status.tps = this.tps;
    }
    const id = this.getBotSettingsKey({ bot: "tei" });
    const tps = this.status.tps;

    // Update time and nps
    if (!this.isGameEnd) {
      this.status.time = results.time;
      this.status.nps = results.nps;
    }

    // Determine ply colors
    const [initialPlayer, moveNumber] = tps.split(" ").slice(1).map(Number);
    const initialColor =
      this.openingSwap && moveNumber === 1
        ? initialPlayer == 1
          ? 2
          : 1
        : initialPlayer;
    let player = initialPlayer;
    let color = initialColor;
    const ply = new Ply(results.pv.splice(0, 1)[0], {
      id: null,
      player,
      color,
    });
    const followingPlies = results.pv.map((ply) => {
      ({ player, color } = this.nextPly(player, color));
      return new Ply(ply, { id: null, player, color });
    });
    const evaluation = results.score * (initialPlayer === 1 ? 1 : -1);
    const depth = results.depth;
    const nodes = results.nodes;
    const name = this.status.name;
    const author = this.status.author;
    const suggestions = [
      { ply, followingPlies, evaluation, depth, nodes, name, author },
    ];
    deepFreeze(suggestions);
    if (
      !this.positions[tps] ||
      !this.positions[tps][id] ||
      this.positions[tps][id][0].depth < suggestions[0].depth ||
      this.positions[tps][id][0].name !== name ||
      this.positions[tps][id][0].author !== author
    ) {
      // Don't overwrite deeper searches for this position unless it's a different bot
      this.$set(this.positions, tps, {
        ...(this.positions[tps] || {}),
        [id]: suggestions,
      });
      return suggestions;
    }
  }

  //#region terminate
  async terminate() {
    if (socket) {
      try {
        if (this.status.isConnected) {
          this.sendTei("stop");
        }
        this.status.isLoading = false;
        this.status.nps = null;
        this.status.tps = null;
        this.status.nextTPS = null;
      } catch (error) {
        await socket.close();
        this.initTei();
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
