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
    :animate="animate"
  />
</template>

<script>
import AnalysisItem from "./AnalysisItem";
import { formatEvaluation } from "../../bots/bot";

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
    animate() {
      return (
        this.botState.isRunning &&
        this.botState.tps === this.$store.state.game.position.tps
      );
    },
  },
  methods: { formatEvaluation },
};
</script>
