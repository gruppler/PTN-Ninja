<template>
  <tooltip v-bind="$attrs" square>
    <GameThumbnail
      :game-id="gameID"
      :tps="tps"
      :plies="plies"
      :hl="hl"
      :config="config"
      :width="240"
      :height="240"
    />
  </tooltip>
</template>

<script>
import GameThumbnail from "./GameThumbnail";

export default {
  name: "PlyPreview",
  components: { GameThumbnail },
  props: {
    tps: String,
    plies: Array,
    hl: String,
  },
  computed: {
    gameID() {
      return `analysis/${this.tps}/${this.plies ? this.plies.join(",") : ""}`;
    },
    config() {
      return {
        imageSize: "md",
      };
    },
  },
};
</script>
