<template>
  <AnalysisItem
    :ply="suggestion.ply"
    :evaluation="'evaluation' in suggestion ? suggestion.evaluation : null"
    :wdl="suggestion.wdl || null"
    :following-plies="suggestion.followingPlies"
    :count="isOpening ? suggestion.totalGames : suggestion.nodes"
    :count-label="isOpening ? 'analysis.n_games' : 'analysis.nodes'"
    :visits="suggestion.visits"
    :seconds="seconds"
    :player1-number="
      isOpening ? $n(suggestion.wins1, 'n0') : displayNumbers.player1
    "
    :middle-number="
      isOpening
        ? suggestion.draws
          ? $n(suggestion.draws, 'n0')
          : null
        : displayNumbers.middle
    "
    :player2-number="
      isOpening ? $n(suggestion.wins2, 'n0') : displayNumbers.player2
    "
    :show-wdl-bars="showWdlBars"
    :player-numbers-tooltip="isOpening ? winsTooltip : null"
    :depth="suggestion.depth || null"
    :bot-name="showBotName && suggestion.botName ? suggestion.botName : null"
    :done-count="sameNextCount"
    :selected-count="samePrevCount"
    :fixed-height="fixedHeight"
    :expandable="expandable"
    :engine-key="engineKey"
    :pv-index="pvIndex"
    :show-continuation="showContinuation"
    :hide-count="hideCount"
    :hide-seconds="hideSeconds"
    v-bind="$attrs"
    v-on="$listeners"
  >
    <template v-if="$slots.before" v-slot:before>
      <slot name="before" />
    </template>
    <template v-slot:after>
      <slot name="after" />
      <q-btn
        v-if="showMenu && !isBoardDisabled"
        class="analysis-item-menu-btn"
        icon="menu_vertical"
        :color="$store.state.ui.theme.panelDark ? 'textLight' : 'textDark'"
        flat
        dense
      >
        <q-menu auto-close transition-show="none" transition-hide="none">
          <q-list>
            <q-item @click="$emit('delete')" clickable>
              <q-item-section side>
                <q-icon name="delete" />
              </q-item-section>
              <q-item-section>{{ $t("Delete") }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </template>
  </AnalysisItem>
</template>

<script>
import AnalysisItem from "./AnalysisItem";
import { formatEvaluation } from "../../bots/bot";
import { normalizeWDL } from "../../bots/wdl";
import { isNumber } from "lodash";

export default {
  name: "BotAnalysisItem",
  components: { AnalysisItem },
  props: {
    suggestion: Object,
    prevSuggestion: {
      type: Object,
      default: null,
    },
    showBotName: {
      type: Boolean,
      default: false,
    },
    showMenu: {
      type: Boolean,
      default: false,
    },
    fixedHeight: {
      type: Boolean,
      default: false,
    },
    expandable: {
      type: Boolean,
      default: false,
    },
    engineKey: {
      type: String,
      default: null,
    },
    pvIndex: {
      type: [Number, String],
      default: null,
    },
    showContinuation: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    isBoardDisabled() {
      return this.$store.state.ui.disableBoard;
    },
    seconds() {
      return isNumber(this.suggestion.time) ? this.suggestion.time / 1e3 : null;
    },
    hideCount() {
      if (!this.prevSuggestion) return false;
      return (
        this.suggestion.nodes !== null &&
        this.suggestion.nodes !== undefined &&
        this.suggestion.nodes === this.prevSuggestion.nodes
      );
    },
    hideSeconds() {
      if (!this.prevSuggestion) return false;
      return (
        this.suggestion.time !== null &&
        this.suggestion.time !== undefined &&
        this.suggestion.time === this.prevSuggestion.time
      );
    },
    isOpening() {
      return (
        "wins1" in this.suggestion &&
        "wins2" in this.suggestion &&
        "totalGames" in this.suggestion
      );
    },
    hasTerminalScore() {
      return !this.isOpening && !!this.suggestion.scoreText;
    },
    hasRawCp() {
      return !this.isOpening && isNumber(this.suggestion.rawCp);
    },
    hasEvaluation() {
      return !this.isOpening && isNumber(this.suggestion.evaluation);
    },
    hasWdl() {
      return (
        !this.isOpening && normalizeWDL(this.suggestion.wdl, null) !== null
      );
    },
    evalNumberPriority() {
      const value = this.$store.state.analysis?.evalNumberPriority;
      if (value === "wdl" || value === "evaluation") {
        return value;
      }
      return "cp";
    },
    evalNumberOrder() {
      if (this.evalNumberPriority === "wdl") {
        return ["wdl", "cp", "evaluation"];
      }
      if (this.evalNumberPriority === "evaluation") {
        return ["evaluation", "cp", "wdl"];
      }
      return ["cp", "wdl", "evaluation"];
    },
    terminalScoreDisplay() {
      if (!this.hasTerminalScore || !this.hasEvaluation) {
        return null;
      }
      if (this.suggestion.evaluation > 0) {
        return {
          player1: this.suggestion.scoreText,
          middle: null,
          player2: null,
        };
      }
      if (this.suggestion.evaluation < 0) {
        return {
          player1: null,
          middle: null,
          player2: this.suggestion.scoreText,
        };
      }
      return {
        player1: null,
        middle: this.suggestion.scoreText,
        player2: null,
      };
    },
    cpDisplay() {
      if (!this.hasRawCp) {
        return null;
      }
      if (this.suggestion.rawCp > 0) {
        return {
          player1: this.formatRawCp(this.suggestion.rawCp),
          middle: null,
          player2: null,
        };
      }
      if (this.suggestion.rawCp < 0) {
        return {
          player1: null,
          middle: null,
          player2: this.formatRawCp(this.suggestion.rawCp),
        };
      }
      return {
        player1: null,
        middle: this.formatRawCp(this.suggestion.rawCp),
        player2: null,
      };
    },
    wdlDisplay() {
      if (!this.hasWdl) {
        return null;
      }
      const normalized = normalizeWDL(this.suggestion.wdl, null);
      if (!normalized) {
        return null;
      }
      return {
        player1: this.formatPercent(normalized.player1),
        middle:
          normalized.draw > 0 ? this.formatPercent(normalized.draw) : null,
        player2: this.formatPercent(normalized.player2),
      };
    },
    evaluationDisplay() {
      if (!this.hasEvaluation) {
        return null;
      }
      if (this.suggestion.evaluation < 0) {
        return {
          player1: null,
          middle: null,
          player2: formatEvaluation(this.suggestion.evaluation),
        };
      }
      return {
        player1: formatEvaluation(this.suggestion.evaluation),
        middle: null,
        player2: null,
      };
    },
    activeDisplaySource() {
      if (this.isOpening) {
        return "wdl";
      }
      if (this.terminalScoreDisplay) {
        return "terminal";
      }

      const bySource = {
        cp: this.cpDisplay,
        wdl: this.wdlDisplay,
        evaluation: this.evaluationDisplay,
      };
      for (const source of this.evalNumberOrder) {
        if (bySource[source]) {
          return source;
        }
      }
      return null;
    },
    showWdlBars() {
      return this.activeDisplaySource === "wdl";
    },
    displayNumbers() {
      if (this.isOpening) {
        return { player1: null, middle: null, player2: null };
      }
      if (this.terminalScoreDisplay) {
        return this.terminalScoreDisplay;
      }

      const bySource = {
        cp: this.cpDisplay,
        wdl: this.wdlDisplay,
        evaluation: this.evaluationDisplay,
      };
      if (this.activeDisplaySource && bySource[this.activeDisplaySource]) {
        return bySource[this.activeDisplaySource];
      }
      return { player1: null, middle: null, player2: null };
    },
    winsTooltip() {
      if (!this.isOpening) return null;
      const s = this.suggestion;
      const pct = (count) => this.$n(count / s.totalGames, "percent");
      return (
        `${this.$t("Player1")} \u2013 ${this.$n(s.wins1)} ${this.$tc(
          "analysis.wins",
          s.wins1
        )} \u2013 ${pct(s.wins1)}\n` +
        `${this.$t("Player2")} \u2013 ${this.$n(s.wins2)} ${this.$tc(
          "analysis.wins",
          s.wins2
        )} \u2013 ${pct(s.wins2)}\n` +
        `${this.$n(s.draws)} ${this.$tc(
          "analysis.draws",
          s.draws
        )} \u2013 ${pct(s.draws)}`
      );
    },
    pv() {
      return [this.suggestion.ply].concat(this.suggestion.followingPlies);
    },
    previousSuggestion() {
      const tps = this.$store.getters["game/prevTPS"];

      if (!tps) {
        return null;
      }

      if (this.$store.state.analysis) {
        const suggestions = this.$store.state.analysis.botPositions[tps];
        if (suggestions) {
          return suggestions[0];
        }
      }

      return this.$store.getters["game/suggestion"](tps);
    },
    samePrevCount() {
      if (!this.previousSuggestion) {
        return 0;
      }
      const thisPV = this.pv;
      const thatPV = this.previousSuggestion.followingPlies;
      let count;
      for (count = 0; count < thisPV.length && count < thatPV.length; count++) {
        if (thisPV[count] && !thisPV[count].isEqual(thatPV[count])) {
          break;
        }
      }
      return count;
    },
    sameNextCount() {
      const boardPly = this.$store.state.game.position.boardPly;
      if (!boardPly) {
        return 0;
      }
      const pv = this.pv;
      const plyIndex = boardPly.isDone
        ? this.$store.state.game.ptn.allPlies[boardPly.id].index + 1
        : 0;
      const branchPlies =
        this.$store.state.game.ptn.branchPlies.slice(plyIndex);
      let count;
      for (
        count = 0;
        count < pv.length && count < branchPlies.length;
        count++
      ) {
        if (pv[count] && !pv[count].isEqual(branchPlies[count])) {
          break;
        }
      }
      return count;
    },
  },
  methods: {
    formatEvaluation,
    formatRawCp(value) {
      if (!isNumber(value)) {
        return null;
      }
      const pawns = value / 100;
      const abs = Math.abs(pawns).toFixed(2);
      if (pawns > 0) {
        return `+${abs}`;
      }
      if (pawns < 0) {
        return `-${abs}`;
      }
      return "0.00";
    },
    formatPercent(value) {
      if (!isNumber(value)) {
        return null;
      }
      return `${this.$n(value, "n0")}%`;
    },
  },
};
</script>
