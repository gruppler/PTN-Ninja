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
import { compact, isEmpty, map, omit, uniq } from "lodash";

// The highlighter and the arrow tool share this toolbar but remember their
// selected color independently.
const MODES = {
  highlighter: {
    section: "HIGHLIGHTER",
    colorKey: "highlighterColor",
    customColorKey: "highlighterCustomColor",
  },
  arrows: {
    section: "ARROWS",
    colorKey: "arrowColor",
    customColorKey: "arrowCustomColor",
  },
};

export default {
  name: "AnnotationControls",
  components: { ColorPicker },
  props: {
    mode: {
      type: String,
      default: "highlighter",
      validator: (value) => value in MODES,
    },
  },
  data() {
    return {
      recentColors: [],
    };
  },
  computed: {
    config() {
      return MODES[this.mode];
    },
    hotkeys() {
      return {
        ...omit(HOTKEYS[this.config.section], "toggle"),
        ...HOTKEYS.CONTROLS,
      };
    },
    colorNames() {
      return HOTKEY_NAMES[this.config.section];
    },
    selectedColor: {
      get() {
        return (
          this.$store.state.ui[this.config.colorKey] ||
          this.$store.state.ui.theme.colors.primary
        );
      },
      set(color) {
        this.$store.dispatch("ui/SET_UI", [this.config.colorKey, color || ""]);
        if (color && !this.palette.includes(color)) {
          this.$store.dispatch("ui/SET_UI", [
            this.config.customColorKey,
            color,
          ]);
          this.$set(this.palette, 0, color);
        }
      },
    },
    usedColors() {
      const game = this.$store.state.game;
      return Object.values(game.highlighterSquares)
        .concat(Object.values(game.tempHighlighterSquares))
        .concat(map(game.highlighterArrows, "color"))
        .concat(map(game.tempHighlighterArrows, "color"));
    },
    palette() {
      const themeColors = this.$store.state.ui.theme.colors;
      const palette = [
        this.$store.state.ui[this.config.customColorKey] || themeColors.primary,
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
      const game = this.$store.state.game;
      return (
        isEmpty(game.highlighterSquares) &&
        isEmpty(game.tempHighlighterSquares) &&
        isEmpty(game.highlighterArrows) &&
        isEmpty(game.tempHighlighterArrows)
      );
    },
    isDialogOpen() {
      return !["local", "game"].includes(this.$route.name);
    },
  },
  methods: {
    clear() {
      this.$store.dispatch("game/CLEAR_ANNOTATIONS_OR_CLOSE");
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
        [this.$store.state.ui[this.config.customColorKey]].concat(
          this.recentColors,
          this.usedColors
        )
      )
    );
  },
  watch: {
    usedColors(colors) {
      this.recentColors = uniq(compact(this.recentColors.concat(colors)));
    },
  },
};
</script>
