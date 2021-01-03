<template>
  <q-slider
    v-if="!!game.plies.length"
    class="scrubber"
    :step="0.5"
    :min="0"
    :max="maxPosition"
    :value="position"
    @input="scrub"
    :dark="false"
    dense
  />
</template>

<script>
import { throttle } from "lodash";

export default {
  name: "Scrubber",
  computed: {
    game() {
      return this.$store.state.game.current;
    },
    position() {
      return this.game.state.ply && this.game.state.plies.length
        ? this.game.state.ply.index + 0.5 * this.game.state.plyIsDone
        : 0;
    },
    maxPosition() {
      return this.game.state.plies && this.game.state.plies.length
        ? this.game.state.plies.length - 0.5
        : 0;
    },
  },
  methods: {
    scrub(position) {
      requestAnimationFrame(() => {
        if (this.game && this.game.state.plies) {
          const ply = this.game.state.plies[Math.floor(position)];
          this.$store.dispatch("game/GO_TO_PLY", {
            ply: ply.id,
            isDone: position > ply.index,
          });
        }
      });
    },
  },
  created() {
    this.scrub = throttle(this.scrub, 10);
  },
};
</script>

<style lang="scss" scoped>
.scrubber {
  position: absolute;
  top: -11px;
  z-index: 1;
}
</style>
