import Bot from "./bot";
import store from "./store";
import asyncPool from "tiny-async-pool";
import { uniq } from "lodash";

const url = "https://tdp04uo1d9.execute-api.eu-north-1.amazonaws.com/tiltak";

const botThinkBudgetInSeconds = Object.freeze({
  short: 5,
  long: 10,
});

export default class TiltakCloud extends Bot {
  constructor(options) {
    super({
      id: "tiltak-cloud",
      icon: "online",
      label: "analysis.bots.tiltak-cloud",
      description: "analysis.bots_description.tiltak-cloud",
      isInteractive: false,
      ...options,
    });
  }

  get isOffline() {
    return store.state.ui.offline;
  }

  //#region init
  init() {
    super.init(!this.isOffline);
  }

  //#region analyzePosition
  async analyzePosition(secondsToThink) {
    try {
      this.loadingTiltakMoves = true;
      this.analyzingPly = this.ply;
      const tps = this.tps;
      const komi = this.komi;
      await this.requestSuggestions(secondsToThink, tps, komi);
    } catch (error) {
      this.console.error("Failed to query position", {
        tps,
        komi,
        secondsToThink,
        error,
      });
    } finally {
      this.loadingTiltakMoves = false;
    }
  }

  //#region analyzeGame
  async analyzeGame() {
    if (this.isOffline) {
      this.handleError("Offline");
      return;
    }
    try {
      this.loadingTiltakAnalysis = true;
      this.progressTiltakAnalysis = 0;
      const concurrency = 10;
      const komi = this.komi;
      const secondsToThinkPerPly = botThinkBudgetInSeconds.short;
      const plies = this.plies.filter((ply) => !this.plyHasEvalComment(ply));
      const settingsKey = this.botSettingsKey;
      let positions = plies.map((ply) => ply.tpsBefore);
      plies.forEach((ply) => {
        if (!ply.result || ply.result.type === "1") {
          positions.push(ply.tpsAfter);
        }
      });
      positions = uniq(positions).filter(
        (tps) =>
          !(tps in this.positions) || !(settingsKey in this.positions[tps])
      );
      let total = positions.length;
      let completed = 0;

      for await (const result of asyncPool(concurrency, positions, (tps) =>
        this.requestSuggestions(
          secondsToThinkPerPly,
          tps,
          komi,
          settingsKey
        ).catch((error) => {
          console.error("Failed to query position", {
            tps,
            komi,
            secondsToThinkPerPly,
            error,
          });
        })
      )) {
        this.progressTiltakAnalysis = (100 * ++completed) / total;
      }
      // Insert comments
      this.saveEvalComments(this.settings.pvLimit, plies, settingsKey);
    } catch (error) {
      this.handleError(error);
    } finally {
      this.loadingTiltakAnalysis = false;
    }
  }

  //#region requestSuggestions
  async requestSuggestions(
    secondsToThink,
    tps,
    komi,
    settingsKey = this.botSettingsKey
  ) {
    if (this.isOffline) {
      this.handleError("Offline");
      return;
    }
    if (!tps) {
      throw new Error("Missing TPS");
    }
    const [initialPlayer, moveNumber] = tps.split(" ").slice(1).map(Number);
    const initialColor =
      this.openingSwap && moveNumber === 1
        ? initialPlayer == 1
          ? 2
          : 1
        : initialPlayer;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        komi: komi,
        size: this.size,
        tps,
        moves: [],
        time_control: {
          // FixedNodes: 100000, // can be used instead of `Time`
          Time: [
            { secs: secondsToThink, nanos: 0 }, // time budget for endpoint
            { secs: 0, nanos: 0 }, // increment, ignored
          ],
        },
        rollout_depth: 0,
        rollout_temperature: 0.25,
        action: "SuggestMoves",
      }),
    });
    if (!response.ok) {
      return this.handleError("HTTP-Error: " + response.status);
    }
    const data = await response.json();
    const { SuggestMoves: suggestedMoves } = data;

    const result = suggestedMoves.map(
      ({ mv: ptn, visits, winning_probability, pv }) => {
        let player = initialPlayer;
        let color = initialColor;
        let ply = new Ply(ptn, { id: null, player, color });
        let followingPlies = pv.map((ply) => {
          ({ player, color } = this.nextPly(player, color));
          return new Ply(ply, { id: null, player, color });
        });
        let evaluation = 200 * (winning_probability - 0.5);
        return { ply, followingPlies, visits, evaluation, secondsToThink };
      }
    );
    deepFreeze(result);
    this.$set(this.positions, tps, {
      ...(this.positions[tps] || {}),
      [settingsKey]: result,
    });
    return result;
  }

  //#region terminate
  terminate() {}
}
