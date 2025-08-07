<template>
  <AnalysisItem
    :ply="suggestion.ply"
    :evaluation="'evaluation' in suggestion ? suggestion.evaluation : null"
    :following-plies="suggestion.followingPlies"
    :count="suggestion.nodes"
    count-label="analysis.nodes"
    :visits="suggestion.visits"
    :seconds="seconds"
    :player1-number="
      'evaluation' in suggestion && suggestion.evaluation >= 0
        ? formatEvaluation(suggestion.evaluation)
        : null
    "
    :player2-number="
      'evaluation' in suggestion && suggestion.evaluation < 0
        ? formatEvaluation(suggestion.evaluation)
        : null
    "
    :depth="suggestion.depth || null"
    :done-count="samePrevCount"
    :selected-count="sameNextCount"
    animate
    v-bind="$attrs"
    v-on="$listeners"
  />
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
  },
  computed: {
    botState() {
      return this.$store.state.analysis.botState;
    },
    seconds() {
      return isNumber(this.suggestion.time) ? this.suggestion.time / 1e3 : null;
    },
    pv() {
      return [this.suggestion.ply].concat(this.suggestion.followingPlies);
    },
    previousSuggestion() {
      const tps = this.$store.getters["game/prevTPS"];

      if (!tps) {
        return null;
      }

      const suggestions = this.$store.state.analysis.botPositions[tps];
      if (suggestions) {
        return suggestions[0];
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
        if (!thisPV[count].isEqual(thatPV[count])) {
          break;
        }
      }
      return count;
    },
    sameNextCount() {
      return 0;
    },
  },
  methods: { formatEvaluation },
};
</script>
