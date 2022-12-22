<template>
  <q-item class="non-selectable" v-bind="$attrs" v-on="$listeners">
    <q-item-section side>
      <img
        :src="thumbnailURL"
        :width="thumbnailWidth"
        :style="{ maxHeight: thumbnailHeight + 'px' }"
      />
    </q-item-section>
    <q-item-section side v-if="showIcon">
      <q-icon :name="icon" :class="{ 'text-primary': option.value === 0 }">
        <q-badge v-if="option.config.unseen" floating />
      </q-icon>
    </q-item-section>
    <q-item-section>
      <q-item-label>{{ option.label }}</q-item-label>
    </q-item-section>
    <q-item-section v-if="!isLastGame" side>
      <q-btn @click.stop="close" icon="close" flat dense />
    </q-item-section>
  </q-item>
</template>

<script>
import Game from "../../Game";

export default {
  name: "GameSelectorOption",
  props: {
    option: Object,
    showIcon: Boolean,
  },
  data() {
    return {
      thumbnail: null,
      thumbnailURL: "",
      thumbnailHeight: 68,
      thumbnailWidth: 81,
      thumbnailConfig: {
        imageSize: "xs",
        axisLabels: false,
        turnIndicator: true,
        highlightSquares: true,
        includeNames: false,
        padding: false,
        bgAlpha: 0,
      },
    };
  },
  computed: {
    icon() {
      let game = this.option;
      if (game.config.isOnline) {
        return this.$store.getters["ui/playerIcon"](
          game.config.player,
          game.config.isPrivate
        );
      } else {
        return "file";
      }
    },
    isLastGame() {
      return this.$store.state.game.list.length === 1;
    },
  },
  methods: {
    updateThumbnail() {
      let game = this.option;
      if (!game.state || !game.state.tps) {
        return;
      }

      // Existing render
      const id = "game-" + game.label;
      const existing = this.$store.state.ui.thumbnails[id];
      const themeID = this.$store.state.ui.themeID;
      if (existing && existing.themeID === themeID) {
        this.thumbnail = existing;
        this.thumbnailURL = this.thumbnail.url;
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
          flatCounts: config.flatCounts
            ? this.$store.state.ui.flatCounts
            : false,
          stackCounts: config.stackCounts
            ? this.$store.state.ui.stackCounts
            : false,
          showRoads: config.showRoads ? false : this.$store.state.ui.showRoads,
          theme: this.$store.state.ui.theme,
        });

        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          this.thumbnail = { id, tps, url, themeID };
          this.thumbnailURL = this.thumbnail.url;
          this.$store.commit("ui/SET_THUMBNAIL", this.thumbnail);
        }, "image/png");
      } catch (error) {
        console.error(error);
      }
    },
    close() {
      this.$store.dispatch("game/REMOVE_GAME", this.option.value);
    },
  },
  mounted() {
    this.$nextTick(this.updateThumbnail);
  },
  watch: {
    "option.state.tps": "updateThumbnail",
  },
};
</script>
