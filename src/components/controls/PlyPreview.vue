<template>
  <tooltip v-bind="$attrs" square>
    <GameThumbnail :game="game" :config="config" :width="size" :height="size" />
  </tooltip>
</template>

<script>
import GameThumbnail from "./GameThumbnail";

export default {
  name: "PlyPreview",
  components: { GameThumbnail },
  props: {
    game: Object,
  },
  data() {
    return {
      size: 240,
      config: { imageSize: "md" },
    };
  },
};
</script>
