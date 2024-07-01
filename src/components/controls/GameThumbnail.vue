<template>
  <div
    class="game-thumbnail"
    :style="{
      height: height + 'px',
      width: width + 'px',
      backgroundImage: imageLoaded ? `url(${url})` : '',
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
    };
  },
  computed: {
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
      try {
        const url = await this.$store.dispatch(
          "ui/GET_THUMBNAIL",
          this.options
        );
        this.url = url;
        let img = new Image();
        img.onload = () => {
          this.imageLoaded = true;
        };
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
