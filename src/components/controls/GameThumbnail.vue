<template>
  <img
    :src="url"
    :height="height"
    :style="{ maxWidth: width + 'px' }"
    class="rounded-borders block"
  />
</template>

<script>
import Game from "../../Game";

export default {
  name: "GameThumbnail",
  props: {
    game: Object,
  },
  data() {
    return {
      thumbnail: null,
      url: "",
      height: 60,
      width: 60,
      thumbnailConfig: {
        imageSize: "xs",
        axisLabels: false,
        turnIndicator: false,
        highlightSquares: true,
        unplayedPieces: false,
        padding: false,
        bgAlpha: 0,
      },
    };
  },
  methods: {
    updateThumbnail() {
      let game = this.game;
      if (!game.state || !game.state.tps) {
        return;
      }

      // Existing render
      const id = "game-" + game.label;
      const existing = this.$store.state.ui.thumbnails[id];
      const themeID = this.$store.state.ui.themeID;
      if (existing && existing.themeID === themeID) {
        this.thumbnail = existing;
        this.url = this.thumbnail.url;
        if (existing.tps === game.state.tps) {
          return;
        }
      }

      // New render
      const ply = game.state.ply;
      const tps = game.state.tps;
      const config = game.config;
      try {
        game = new Game({
          state: game.minState || game.state,
          tags: {
            tps: game.state.tps,
            komi: config.komi,
            opening: config.opening,
          },
          config,
        });
        const canvas = game.board.render({
          ...this.thumbnailConfig,
          ply,
          textSize: "xl",
          flatCounts:
            !config.isOnline || config.flatCounts
              ? this.$store.state.ui.flatCounts
              : false,
          stackCounts: false,
          showRoads:
            !config.isOnline || config.showRoads
              ? this.$store.state.ui.showRoads
              : false,
          theme: this.$store.state.ui.theme,
        });

        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          this.thumbnail = { id, tps, url, themeID };
          this.url = this.thumbnail.url;
          this.$store.commit("ui/SET_THUMBNAIL", this.thumbnail);
        }, "image/png");
      } catch (error) {
        console.error(error);
      }
    },
  },
  mounted() {
    this.$nextTick(this.updateThumbnail);
  },
  watch: {
    "game.state.tps": "updateThumbnail",
  },
};
</script>
