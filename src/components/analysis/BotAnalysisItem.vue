<template>
  <AnalysisItem
    :ply="suggestion.ply"
    :evaluation="'evaluation' in suggestion ? suggestion.evaluation : null"
    :following-plies="suggestion.followingPlies"
    :count="
      'visits' in suggestion
        ? suggestion.visits
        : 'nodes' in suggestion
        ? suggestion.nodes
        : null
    "
    :count-label="
      'visits' in suggestion
        ? 'analysis.visits'
        : 'nodes' in suggestion
        ? 'analysis.nodes'
        : null
    "
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
  },
  methods: { formatEvaluation },
};
</script>
