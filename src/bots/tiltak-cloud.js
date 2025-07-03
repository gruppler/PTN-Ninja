import Bot from "./bot";
import store from "../store";
import asyncPool from "tiny-async-pool";
import { uniq } from "lodash";

const url = "https://tdp04uo1d9.execute-api.eu-north-1.amazonaws.com/tiltak";

export default class TiltakCloud extends Bot {
  constructor(options = {}) {
    super({
      id: "tiltak-cloud",
      icon: "online",
      label: "analysis.bots.tiltak-cloud",
      description: "analysis.bots_description.tiltak-cloud",
      isInteractive: false,
      sizeHalfKomis: { 5: [0, 4], 6: [0, 4] },
      settings: {
        log: false,
        maxSuggestedMoves: 5,
        nodes: 1e5,
        movetime: 5e3,
        limitTypes: ["movetime"],
      },
      limitTypes: ["movetime", "nodes"],
      ...options,
    });
  }

  get isOffline() {
    return store.state.ui.offline;
  }

  //#region init
  init() {
    this.setState("isReady", true);
    super.init(true);
  }

  //#region queryPosition
  async queryPosition(tps) {
    // Validate size/komi
    const init = super.queryPosition(tps);
    if (!init) {
      return false;
    }

    if (this.isOffline) {
      this.onError("Offline");
      return;
    }

    const movetime = this.settings.movetime;

    const request = {
      komi: init.halfKomi / 2,
      size: this.size,
      tps,
      moves: [],
      time_control: {
        // FixedNodes: 100000, // can be used instead of `Time`
        Time: [
          { secs: movetime / 1e3, nanos: 0 }, // time budget for endpoint
          { secs: 0, nanos: 0 }, // increment, ignored
        ],
      },
      rollout_depth: 0,
      rollout_temperature: 0.25,
      action: "SuggestMoves",
    };
    if (this.settings.log) {
      console.log(">>", request);
    }
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });
      if (this.settings.log) {
        console.log("<<", response);
      }
    } catch (error) {
      this.onError(error);
      this.terminate();
      return;
    }
    if (!response.ok) {
      this.terminate();
      return this.onError("HTTP-Error: " + response.status);
    }
    const data = await response.json();
    if (this.settings.log) {
      console.log("<<", data);
    }
    const { SuggestMoves: suggestedMoves } = data;

    const results = {
      tps,
      suggestions: suggestedMoves.map(
        ({ mv, visits, winning_probability, pv }) => {
          pv.unshift(mv);
          const evaluation = 200 * (winning_probability - 0.5);
          return { pv, visits, evaluation, time: movetime };
        }
      ),
    };
    if (results.suggestions[0].pv.length) {
      return super.storeResults(results);
    }
  }

  //#region analyzeGame
  async analyzeGame() {
    if (this.isOffline) {
      this.onError("Offline");
      return;
    }
    try {
      this.setState("isRunning", true);
      this.setState("isAnalyzingGame", true);
      this.setState("progress", 0);
      const concurrency = 10;
      const movetime = this.settings.movetime;
      const plies = this.plies.filter((ply) => !this.plyHasEvalComment(ply));
      let positions = plies.map((ply) => ply.tpsBefore);
      plies.forEach((ply) => {
        if (!ply.result || ply.result.type === "1") {
          positions.push(ply.tpsAfter);
        }
      });
      positions = uniq(positions).filter(
        (tps) =>
          !(tps in this.positions) || this.positions[tps][0].time < movetime
      );
      let total = positions.length;
      let completed = 0;

      for await (const result of asyncPool(concurrency, positions, (tps) => {
        if (this.state.isAnalyzingGame) {
          this.queryPosition(tps);
        }
      })) {
        this.setState("progress", (100 * ++completed) / total);
      }
      // Insert comments if successful
      if (this.state.isAnalyzingGame) {
        this.saveEvalComments();
      }
    } catch (error) {
      this.onError(error);
    } finally {
      this.setState("isRunning", false);
      this.setState("isAnalyzingGame", false);
    }
  }

  //#region terminate
  terminate() {
    super.terminate();
  }
}
