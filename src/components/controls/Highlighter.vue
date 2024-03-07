<template>
  <div
    class="highlighter row no-wrap justify-around items-center full-height absolute-fit"
    v-shortkey="hotkeys"
    @shortkey="hotkey($event.srcKey)"
  >
    <ColorPicker v-model="selectedColor" :palette="palette" icon="edit" stretch>
      <hint>{{ $t("Edit") }}</hint>
    </ColorPicker>

    <q-btn
      v-for="(color, i) in palette.slice(
        0,
        $q.screen.gt.xs ? palette.length : -1
      )"
      :key="i"
      :style="{ background: color }"
      round
      @click="selectedColor = color"
    >
      <hint>{{ $t(colorNames["color" + (i + 1)]) }}</hint>
    </q-btn>

    <q-btn
      @click="clear"
      :icon="isEmpty ? 'close' : 'clear'"
      :dense="$q.screen.lt.sm"
      stretch
      flat
    >
      <hint>{{ $t(isEmpty ? "Close" : "Clear") }}</hint>
    </q-btn>
  </div>
</template>

<script>
import ColorPicker from "./ColorPicker";
import { colors } from "quasar";
import { HOTKEYS, HOTKEY_NAMES } from "../../keymap";
import { isEmpty } from "lodash";

export default {
  name: "Highlighter",
  components: { ColorPicker },
  data() {
    return {
      hotkeys: HOTKEYS.HIGHLIGHTER,
      colorNames: HOTKEY_NAMES.HIGHLIGHTER,
    };
  },
  computed: {
    selectedColor: {
      get() {
        return (
          this.$store.state.ui.highlighterColor ||
          this.$store.state.ui.theme.colors.primary
        );
      },
      set(color) {
        this.$store.dispatch("ui/SET_UI", ["highlighterColor", color || ""]);
        if (color && !this.palette.includes(color)) {
          this.$store.dispatch("ui/SET_UI", ["highlighterCustomColor", color]);
          this.$set(this.palette, 0, color);
        }
      },
    },
    palette() {
      const themeColors = this.$store.state.ui.theme.colors;
      const palette = [
        this.$store.state.ui.highlighterCustomColor || themeColors.primary,
        themeColors.player1,
        themeColors.player2,
        colors.getBrand("positive"),
        colors.getBrand("negative"),
        themeColors.primary,
      ];
      return palette;
    },
    isEmpty() {
      return isEmpty(this.$store.state.ui.highlighterSquares);
    },
  },
  methods: {
    clear() {
      if (this.isEmpty) {
        this.$store.dispatch("ui/SET_UI", ["highlighterEnabled", false]);
      } else {
        this.$store.dispatch("ui/SET_UI", ["highlighterSquares", {}]);
      }
    },
    hotkey(key) {
      if (key.startsWith("color")) {
        let color = this.palette[key.slice(5) - 1];
        if (color) {
          this.selectedColor = color;
        }
      } else if (key === "clear") {
        this.clear();
      }
    },
  },
};
</script>
