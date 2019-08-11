<template>
  <q-slider
    class="scrubber"
    :step="0.5"
    :min="0"
    :max="maxPosition"
    :value="position"
    @input="scrub"
    color="accent"
    dense
  />
</template>

<script>
import { throttle } from "lodash";

export default {
  name: "Scrubber",
  props: ["game"],
  computed: {
    position() {
      return this.game.state.plies && this.game.state.plies.length
        ? this.game.state.ply.index + 0.5 * this.game.state.plyIsDone
        : 0;
    },
    maxPosition() {
      return this.game.state.plies && this.game.state.plies.length
        ? this.game.state.plies.length - 0.5
        : 0;
    }
  },
  methods: {
    scrub(position) {
      if (this.game) {
        const ply = this.game.state.plies[Math.floor(position)];
        this.game.goToPly(ply.id, position > ply.index);
      }
    }
  },
  created() {
    this.scrub = throttle(this.scrub, 350);
  }
};
</script>

<style lang="stylus" scoped>
.scrubber
  margin-top -10px
  margin-bottom -8px
  z-index 1
</style>
