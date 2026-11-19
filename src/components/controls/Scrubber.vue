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
    @mousedown.native.capture="onlyFromThumb"
    @touchstart.native.capture="onlyFromThumb"
    @click.native.capture="onlyFromThumb"
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

// How far from the thumb a press still takes hold of it, in pixels: the bar
// is thin, and a finger wider than a mouse pointer
const THUMB_REACH_MOUSE = 8;
const THUMB_REACH_TOUCH = 16;

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
    // Only the thumb moves the bar: a press on the track, all too easy to
    // make by accident, would jump the game there. Stopped on its way down,
    // before the slider's own handlers on the track see it.
    onlyFromThumb(event) {
      const thumb = this.$el.querySelector(".q-slider__thumb");
      if (!thumb) {
        return;
      }
      const touch = event.touches && event.touches[0];
      const x = touch ? touch.clientX : event.clientX;
      const rect = thumb.getBoundingClientRect();
      const reach =
        rect.width / 2 + (touch ? THUMB_REACH_TOUCH : THUMB_REACH_MOUSE);
      if (Math.abs(x - (rect.left + rect.width / 2)) > reach) {
        event.stopPropagation();
      }
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

  .q-slider__track {
    border-radius: 0;
  }
}
</style>
