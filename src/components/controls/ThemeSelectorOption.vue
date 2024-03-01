<template>
  <q-item class="non-selectable" v-bind="$attrs" v-on="$listeners">
    <q-item-section thumbnail>
      <GameThumbnail
        :width="size.width"
        :height="size.height"
        :tps="game.position.tps"
        :hl="game.position.ply ? game.position.ply.text : null"
        :plyIsDone="game.position.plyIsDone"
        :config="config"
        class="rounded-borders"
      />
    </q-item-section>
    <q-item-section>
      <q-item-label>{{ theme.name }}</q-item-label>
    </q-item-section>
    <q-item-section class="fg-inherit" side>
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
import GameThumbnail from "./GameThumbnail";

const width = 85;
export const heights = {
  3: width * 0.7105263157894737,
  4: width * 0.782608695652174,
  5: width * 0.8333333333333334,
  6: width * 0.8709677419354839,
  7: width * 0.907563025210084,
  8: width * 0.9230769230769231,
};

const thumbnailConfig = {
  axisLabels: true,
  turnIndicator: true,
  unplayedPieces: true,
  padding: true,
  bgAlpha: 1,
};

export default {
  name: "ThemeSelectorOption",
  components: { GameThumbnail },
  props: {
    option: Object,
    isCurrent: Boolean,
  },
  data() {
    return {};
  },
  computed: {
    theme() {
      return this.option.theme;
    },
    game() {
      return this.$store.state.game;
    },
    config() {
      return { ...thumbnailConfig, theme: this.theme };
    },
    size() {
      return {
        width,
        height: heights[this.game.config.size],
      };
    },
  },
  methods: {
    remove() {
      if (this.isCurrent) {
        return;
      }
      return this.$emit("remove", this.option.value);
    },
  },
};
</script>
