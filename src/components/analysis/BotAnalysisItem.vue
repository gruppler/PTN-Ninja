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
    :done-count="sameNextCount"
    :selected-count="samePrevCount"
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
        if (!pv[count].isEqual(branchPlies[count])) {
          break;
        }
      }
      return count;
    },
  },
  methods: { formatEvaluation },
};
</script>
