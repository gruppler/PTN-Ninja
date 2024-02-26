<template>
  <tooltip v-bind="$attrs" square>
    <GameThumbnail
      :tps="tps"
      :plies="plies"
      :hl="hl"
      :config="config"
      :width="size.width"
      :height="size.height"
    />
  </tooltip>
</template>

<script>
import GameThumbnail from "./GameThumbnail";

const width = 270;
export const heights = {
  3: width * 0.7105263157894737,
  4: width * 0.782608695652174,
  5: width * 0.8333333333333334,
  6: width * 0.8709677419354839,
  7: width * 0.907563025210084,
  8: width * 0.9230769230769231,
};

export default {
  name: "PlyPreview",
  components: { GameThumbnail },
  props: {
    tps: String,
    plies: Array,
    hl: String,
    options: Object,
  },
  computed: {
    config() {
      return {
        imageSize: "md",
        turnIndicator: true,
        unplayedPieces: true,
        komi: this.$store.state.game.config.komi,
        ...this.options,
      };
    },
    size() {
      return {
        width,
        height: heights[this.$store.state.game.config.size],
      };
    },
  },
};
</script>
