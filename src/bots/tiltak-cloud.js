import Bot from "./bot";
import store from "../store";

const url = "https://tdp04uo1d9.execute-api.eu-north-1.amazonaws.com/tiltak";

export default class TiltakCloud extends Bot {
  constructor(options = {}) {
    super({
      id: "tiltak-cloud",
      icon: "online",
      label: "analysis.bots.tiltak-cloud",
      description: "analysis.bots_description.tiltak-cloud",
      concurrency: 10,
      isInteractive: false,
      sizeHalfKomis: { 5: [0, 4], 6: [0, 4] },
      settings: {
        maxSuggestedMoves: 5,
        nodes: 1e5,
        movetime: 5e3,
        limitTypes: ["movetime"],
      },
      limitTypes: {
        movetime: { min: 1e3, max: 1e4, step: 1e3 },
        nodes: {},
      },
      state: {
        isReady: true,
      },
      ...options,
    });
  }

  get isOffline() {
    return store.state.ui.offline;
  }

  //#region queryPosition
  async queryPosition(tps) {
    // Validate size/komi
    const init = super.validatePosition(tps);
    if (!init) {
      return false;
    }

    if (this.isOffline) {
      this.onError("Offline");
      return false;
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
    super.onSend(request);
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });
    } catch (error) {
      this.onError(error);
      this.terminate();
      return false;
    }
    if (!response.ok) {
      this.terminate();
      return this.onError("HTTP-Error: " + response.status);
    }
    const data = await response.json();
    super.onReceive(data);
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
}
