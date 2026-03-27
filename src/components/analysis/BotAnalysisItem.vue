<template>
  <AnalysisItem
    :ply="suggestion.ply"
    :evaluation="'evaluation' in suggestion ? suggestion.evaluation : null"
    :following-plies="suggestion.followingPlies"
    :count="isOpening ? suggestion.totalGames : suggestion.nodes"
    :count-label="isOpening ? 'analysis.n_games' : 'analysis.nodes'"
    :visits="suggestion.visits"
    :seconds="seconds"
    :player1-number="
      isOpening
        ? $n(suggestion.wins1, 'n0')
        : hasTerminalScore && suggestion.evaluation > 0
        ? suggestion.scoreText
        : 'evaluation' in suggestion && suggestion.evaluation >= 0
        ? formatEvaluation(suggestion.evaluation)
        : null
    "
    :middle-number="
      isOpening
        ? suggestion.draws
          ? $n(suggestion.draws, 'n0')
          : null
        : hasTerminalScore && suggestion.evaluation === 0
        ? suggestion.scoreText
        : null
    "
    :player2-number="
      isOpening
        ? $n(suggestion.wins2, 'n0')
        : hasTerminalScore && suggestion.evaluation < 0
        ? suggestion.scoreText
        : 'evaluation' in suggestion && suggestion.evaluation < 0
        ? formatEvaluation(suggestion.evaluation)
        : null
    "
    :player-numbers-tooltip="isOpening ? winsTooltip : null"
    :depth="suggestion.depth || null"
    :bot-name="showBotName && suggestion.botName ? suggestion.botName : null"
    :done-count="sameNextCount"
    :selected-count="samePrevCount"
    :fixed-height="fixedHeight"
    :expandable="expandable"
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
  methods: { formatEvaluation },
};
</script>
