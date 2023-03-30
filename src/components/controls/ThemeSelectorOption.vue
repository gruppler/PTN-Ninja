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
      const tps = game.board.tps;

      // Existing render
      const id = "theme-" + this.theme.id;
      const existing = this.$store.state.ui.thumbnails[id];
      if (existing) {
        this.thumbnail = existing;
        this.thumbnailURL = this.thumbnail.url;
        if (existing.tps === tps) {
          return;
        }
      }

      // New render
      const canvas = game.board.render({
        ...this.thumbnailConfig,
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
