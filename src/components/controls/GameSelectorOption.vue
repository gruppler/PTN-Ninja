<template>
  <q-item class="non-selectable" v-bind="$attrs" v-on="$listeners">
    <q-item-section side>
      <img :src="thumbnailURL" :height="thumbnailHeight" />
    </q-item-section>
    <q-item-section side v-if="showIcon">
      <q-icon :name="icon" :class="{ 'text-primary': option.value === 0 }">
        <q-badge v-if="option.config.unseen" floating />
      </q-icon>
    </q-item-section>
    <q-item-section>
      <q-item-label>{{ option.label }}</q-item-label>
    </q-item-section>
    <q-item-section side>
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
      thumbnailConfig: {
        imageSize: "xs",
        axisLabels: false,
        turnIndicator: true,
        highlightSquares: true,
        pieceShadows: false,
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
  },
  methods: {
    updateThumbnail() {
      let game = this.option;
      if (!game.state || !game.state.tps) {
        return;
      }

      // Existing render
      const id = game.label;
      const existing = this.$store.state.ui.thumbnails[id];
      const themeID = this.$store.state.ui.themeID;
      if (
        existing &&
        existing.tps === game.state.tps &&
        existing.themeID === themeID
      ) {
        this.thumbnail = existing;
        this.thumbnailURL = this.thumbnail.url;
        return;
      }

      // New render
      const ply = game.state.ply;
      const tps = game.state.tps;
      const config = game.config;
      game = new Game("", {
        state: { ...game.state },
        tags: { tps: game.state.tps },
      });
      const canvas = game.board.render({
        ...this.thumbnailConfig,
        ply,
        flatCounts: config.disableFlatCounts
          ? false
          : this.$store.state.ui.flatCounts,
        showRoads: config.disableShowRoads
          ? false
          : this.$store.state.ui.showRoads,
        theme: this.$store.state.ui.theme,
      });

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        this.thumbnail = { id, tps, url, themeID };
        this.thumbnailURL = this.thumbnail.url;
        this.$store.commit("ui/SET_THUMBNAIL", this.thumbnail);
      }, "image/png");
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
