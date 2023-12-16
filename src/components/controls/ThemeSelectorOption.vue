<template>
  <q-item class="non-selectable" v-bind="$attrs" v-on="$listeners">
    <q-item-section side>
      <img
        :src="thumbnailURL"
        :height="thumbnailHeight"
        class="rounded-borders"
      />
    </q-item-section>
    <q-item-section>
      <q-item-label>{{ theme.name }}</q-item-label>
    </q-item-section>
    <q-item-section side>
      <q-btn
        v-if="!theme.isBuiltIn && !isCurrent"
        @click.stop="remove"
        icon="delete"
        flat
        dense
      />
    </q-item-section>
  </q-item>
</template>

<script>
import { TPStoCanvas } from "../../../functions/TPS-Ninja/src/index";
import { isEqual } from "lodash";

export default {
  name: "ThemeSelectorOption",
  props: {
    option: Object,
    isCurrent: Boolean,
  },
  data() {
    return {
      thumbnail: null,
      thumbnailURL: "",
      thumbnailHeight: 68,
      thumbnailConfig: {
        font: "Roboto",
        imageSize: "xs",
        axisLabels: true,
        turnIndicator: true,
        highlightSquares: true,
        includeNames: false,
        padding: true,
        bgAlpha: 1,
      },
    };
  },
  computed: {
    theme() {
      return this.option.theme;
    },
  },
  methods: {
    updateThumbnail() {
      const game = this.$game;
      const komi = game.config.komi;
      const opening = game.config.opening;
      const tps = game.board.tps;
      const transform = this.$store.state.ui.boardTransform;
      const ply = this.$store.state.game.position.ply;
      const hl = ply ? ply.text : null;
      const plyIsDone = this.$store.state.game.position.plyIsDone;

      // Existing render
      const id = "theme-" + this.theme.id;
      const existing = this.$store.state.ui.thumbnails[id];
      if (existing) {
        this.thumbnail = existing;
        this.thumbnailURL = this.thumbnail.url;
        if (existing.tps === tps && isEqual(existing.transform, transform)) {
          return;
        }
      }

      // New render
      const canvas = TPStoCanvas({
        ...this.thumbnailConfig,
        komi,
        opening,
        tps,
        hl,
        plyIsDone,
        transform,
        theme: this.theme,
      });

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        this.thumbnail = { id, tps, url, themeID: this.theme.id };
        this.thumbnailURL = this.thumbnail.url;
        this.$store.commit("ui/SET_THUMBNAIL", this.thumbnail);
      }, "image/png");
    },
    remove() {
      if (this.isCurrent) {
        return;
      }
      return this.$emit("remove", this.option.value);
    },
  },
  mounted() {
    this.$nextTick(this.updateThumbnail);
  },
};
</script>
