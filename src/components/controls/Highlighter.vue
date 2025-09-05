<template>
  <div
    class="highlighter row no-wrap justify-around items-center full-height absolute-fit"
    v-shortkey="isDialogOpen ? null : hotkeys"
    @shortkey="hotkey($event.srcKey)"
  >
    <ColorPicker
      v-model="selectedColor"
      :palette="pickerPalette"
      icon="edit"
      stretch
    >
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
import { compact, isEmpty, omit, uniq } from "lodash";

export default {
  name: "Highlighter",
  components: { ColorPicker },
  data() {
    return {
      hotkeys: { ...omit(HOTKEYS.HIGHLIGHTER, "toggle"), ...HOTKEYS.CONTROLS },
      colorNames: HOTKEY_NAMES.HIGHLIGHTER,
      recentColors: [],
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
    usedColors() {
      return Object.values(this.$store.state.game.highlighterSquares);
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
    pickerPalette() {
      return this.palette.slice(1).concat(this.recentColors);
    },
    isEmpty() {
      return isEmpty(this.$store.state.game.highlighterSquares);
    },
    isDialogOpen() {
      return this.$route.name !== "localGame";
    },
  },
  methods: {
    clear() {
      if (this.isEmpty) {
        this.$store.dispatch("game/SET_HIGHLIGHTER_ENABLED", false);
      } else {
        this.$store.dispatch("game/SET_HIGHLIGHTER_SQUARES", {});
      }
    },
    hotkey(key) {
      if (key.startsWith("color")) {
        let color = this.palette[key.slice(5) - 1];
        if (color) {
          this.selectedColor = color;
        }
      } else {
        switch (key) {
          case "clear":
            this.clear();
            break;
          case "prev":
            this.$store.dispatch("game/PREV", { half: false });
            break;
          case "prevHalf":
            this.$store.dispatch("game/PREV", { half: true });
            break;
          case "next":
            this.$store.dispatch("game/NEXT", { half: false });
            break;
          case "nextHalf":
            this.$store.dispatch("game/NEXT", { half: true });
            break;
          case "first":
            this.$store.dispatch("game/FIRST");
            break;
          case "last":
            this.$store.dispatch("game/LAST");
            break;
        }
      }
    },
  },
  mounted() {
    this.recentColors = uniq(
      compact(
        [this.$store.state.ui.highlighterCustomColor].concat(
          this.recentColors,
          this.usedColors
        )
      )
    );
  },
  watch: {
    usedColors(colors) {
      this.recentColors = uniq(this.recentColors.concat(colors));
    },
  },
};
</script>
