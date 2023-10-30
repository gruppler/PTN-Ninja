<template>
  <img
    v-if="imageLoaded"
    :src="url"
    :height="height"
    :width="width"
    class="rounded-borders block"
  />
  <div
    v-else
    :style="{
      height: height + 'px',
      width: width + 'px',
    }"
  />
</template>

<script>
import { TPStoCanvas } from "../../../functions/TPS-Ninja/src/index";
import { isEqual } from "lodash";

export default {
  name: "GameThumbnail",
  props: {
    gameId: String,
    tps: String,
    plies: Array,
    hl: String,
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
  },
  data() {
    return {
      imageLoaded: false,
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
      },
    };
  },
  computed: {
    options() {
      return {
        theme: this.$store.state.ui.theme,
        showRoads: this.$store.state.ui.showRoads,
        stackCounts: this.$store.state.ui.stackCounts,
        ...this.thumbnailConfig,
        ...this.config,
        tps: this.tps,
        plies: this.plies,
        hl: this.hl,
      };
    },
  },
  methods: {
    updateThumbnail() {
      const options = this.options;

      // Check for existing image
      let id;
      if (this.gameId) {
        id = "game-" + this.gameId;
        let existing = this.$store.state.ui.thumbnails[id];
        if (existing && isEqual(existing.options, options)) {
          this.thumbnail = existing;
          this.url = this.thumbnail.url;
          this.imageLoaded = true;
          return;
        }
      }

      // Create new image
      try {
        TPStoCanvas(options).toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          this.url = url;
          if (id) {
            this.thumbnail = { id, options, url };
            this.$store.commit("ui/SET_THUMBNAIL", this.thumbnail);
          }
          let img = new Image();
          img.onload = () => {
            this.imageLoaded = true;
          };
          img.src = url;
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
    options: {
      handler: "updateThumbnail",
      deep: true,
    },
  },
};
</script>
