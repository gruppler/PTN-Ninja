<template>
  <q-slider
    v-if="$store.state.ui.showScrubber"
    class="scrubber"
    :step="0.5"
    :min="0"
    :max="maxPosition || 1"
    :value="position"
    :disable="!maxPosition"
    @input="scrub"
    @pan="pan"
    :dark="false"
    dense
  />
  <q-linear-progress
    v-else
    class="scrubber"
    :value="maxPosition ? position / maxPosition : 0"
    :dark="false"
  />
</template>

<script>
import { throttle } from "lodash";

export default {
  name: "Scrubber",
  computed: {
    plies() {
      return this.$store.state.game.ptn.branchPlies;
    },
    ply() {
      return this.$store.state.game.position.plyIndex;
    },
    plyIsDone() {
      return this.$store.state.game.position.plyIsDone;
    },
    position() {
      if (!this.plies.length) {
        return 0;
      }
      return this.ply + 0.5 * this.plyIsDone;
    },
    maxPosition() {
      return this.plies && this.plies.length ? this.plies.length - 0.5 : 0;
    },
  },
  methods: {
    scrub(position) {
      requestAnimationFrame(() => {
        if (this.plies && this.plies.length) {
          const ply = this.plies[Math.floor(position)];
          this.$store.dispatch("game/GO_TO_PLY", {
            plyID: ply.id,
            isDone: position > ply.index,
          });
        }
      });
    },
    pan(phase) {
      this.$store.commit("ui/SET_SCRUBBING", phase);
    },
  },
  created() {
    this.scrub = throttle(this.scrub, 10);
  },
};
</script>

<style lang="scss">
.scrubber {
  position: absolute;
  top: -10px;
  z-index: 1;

  &.q-linear-progress {
    height: 2px;
    top: -2px;
  }
}
</style>
