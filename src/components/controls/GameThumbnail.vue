<template>
  <div
    class="game-thumbnail"
    :style="{
      height: height + 'px',
      width: width + 'px',
      backgroundImage: backgroundImage,
    }"
  />
</template>

<style lang="scss">
.game-thumbnail {
  background-size: contain;
  background-repeat: no-repeat;
  background-position: 50% 50%;
}
</style>

<script>
import { isObject } from "lodash";

export default {
  name: "GameThumbnail",
  props: {
    tps: String,
    plies: Array,
    hl: String,
    plyIsDone: {
      type: Boolean,
      default: true,
    },
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
      prevUrl: "",
      requestId: 0,
    };
  },
  computed: {
    // Layer the previous image behind the current one so any sub-frame repaint
    // gap during a swap shows the old board rather than a blank flash. Board
    // thumbnails are opaque, so the top layer fully covers the one beneath once
    // painted.
    backgroundImage() {
      if (!this.imageLoaded || !this.url) {
        return "";
      }
      if (this.prevUrl && this.prevUrl !== this.url) {
        return `url("${this.url}"), url("${this.prevUrl}")`;
      }
      return `url("${this.url}")`;
    },
    options() {
      let options = {
        ...this.config,
        tps: this.tps,
        plies: this.plies,
        hl: this.hl,
        plyIsDone: this.plyIsDone,
      };
      if (isObject(options.pieceCounts)) {
        options.caps1 = options.pieceCounts[1].cap;
        options.flats1 = options.pieceCounts[1].flat;
        options.caps2 = options.pieceCounts[2].cap;
        options.flats2 = options.pieceCounts[2].flat;
      }
      return options;
    },
  },
  methods: {
    async updateThumbnail() {
      const currentRequestId = ++this.requestId;
      try {
        const url = await this.$store.dispatch(
          "ui/GET_THUMBNAIL",
          this.options
        );
        // Only apply if this is still the most recent request
        if (currentRequestId !== this.requestId) return;
        // Swap to the new image only once it has decoded, so the previously
        // shown thumbnail stays put instead of blanking during decode. When the
        // PNG was prefetched and decoded already, this resolves immediately.
        const apply = () => {
          if (currentRequestId === this.requestId) {
            if (this.url && this.url !== url) {
              this.prevUrl = this.url;
            }
            this.url = url;
            this.imageLoaded = true;
          }
        };
        const img = new Image();
        img.onload = apply;
        img.onerror = apply;
        img.src = url;
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
