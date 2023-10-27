<template>
  <img
    :src="url"
    :height="height"
    :width="width"
    class="rounded-borders block"
  />
</template>

<script>
import Game from "../../Game";

export default {
  name: "GameThumbnail",
  props: {
    game: Object,
    height: {
      type: Number,
      default: 60,
    },
    width: {
      type: Number,
      default: 60,
    },
    config: {
      type: Object,
      default: () => {},
    },
    noCache: Boolean,
  },
  data() {
    return {
      thumbnail: null,
      url: "",
      thumbnailConfig: {
        imageSize: "xs",
        axisLabels: false,
        turnIndicator: false,
        highlightSquares: true,
        unplayedPieces: false,
        padding: false,
        bgAlpha: 0,
        ...this.config,
      },
    };
  },
  methods: {
    updateThumbnail() {
      let game = this.game;
      if (game.constructor !== Game && (!game.state || !game.state.tps)) {
        return;
      }

      let state = game.state || game.minState || game.board;

      let id;
      let themeID;
      // Existing render
      if (!this.noCache) {
        id = "game-" + (game.label || game.name);
        let existing = this.$store.state.ui.thumbnails[id];
        themeID = this.$store.state.ui.themeID;
        if (existing && existing.themeID === themeID) {
          this.thumbnail = existing;
          this.url = this.thumbnail.url;
          if (existing.tps === state.tps) {
            return;
          }
        }
      }

      // New render
      const ply = state.ply;
      const tps = state.tps;
      const config = game.config;
      try {
        if (game.constructor !== Game) {
          game = new Game({
            state,
            tags: {
              tps: state.tps,
              komi: config.komi,
              opening: config.opening,
            },
            config,
          });
        }
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
          this.url = url;
          if (!this.noCache) {
            this.thumbnail = { id, tps, url, themeID };
            this.$store.commit("ui/SET_THUMBNAIL", this.thumbnail);
          }
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
