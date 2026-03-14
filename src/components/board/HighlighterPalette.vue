<template>
  <div
    class="highlighter-palette"
    :class="{ vertical: isVertical, horizontal: !isVertical }"
    v-shortkey="isDialogOpen ? null : hotkeys"
    @shortkey="hotkey($event.srcKey)"
  >
    <div
      class="palette-colors"
      :class="{ row: !isVertical, column: isVertical }"
    >
      <q-btn
        v-for="(color, i) in palette"
        :key="i"
        :style="{ background: color }"
        :class="{ selected: i === selectedIndex }"
        :size="btnSize"
        round
        @click="selectColor(i)"
      >
        <hint>{{ $t(colorNames["color" + (i + 1)]) }}</hint>
      </q-btn>
    </div>
    <div
      class="palette-actions"
      :class="{ row: !isVertical, column: isVertical }"
    >
      <ColorPicker
        :value="selectedColor"
        @input="updateColor"
        :palette="pickerPalette"
        icon="edit"
        :size="btnSize"
        flat
        round
      >
        <hint>{{ $t("Edit") }}</hint>
      </ColorPicker>
      <q-btn
        @click="resetPalette"
        icon="undo"
        :disable="!isCustomized"
        :size="btnSize"
        flat
        round
      >
        <hint>{{ $t("Reset") }}</hint>
      </q-btn>
      <q-btn
        @click="saveToNotes"
        icon="save"
        :disable="isEmpty"
        :size="btnSize"
        flat
        round
      >
        <hint>{{ $t("Save to Notes") }}</hint>
      </q-btn>
      <q-btn
        @click="clear"
        :icon="isEmpty ? 'close' : 'clear'"
        :size="btnSize"
        flat
        round
      >
        <hint>{{ $t(isEmpty ? "Close" : "Clear") }}</hint>
      </q-btn>
    </div>
  </div>
</template>

<script>
import ColorPicker from "../controls/ColorPicker";
import { colors } from "quasar";
import { HOTKEYS, HOTKEY_NAMES } from "../../keymap";
import { isEmpty, omit } from "lodash";

export default {
  name: "HighlighterPalette",
  components: { ColorPicker },
  data() {
    return {
      hotkeys: { ...omit(HOTKEYS.HIGHLIGHTER, "toggle"), ...HOTKEYS.CONTROLS },
      colorNames: HOTKEY_NAMES.HIGHLIGHTER,
      selectedIndex: 0,
    };
  },
  computed: {
    isVertical() {
      return this.$store.state.ui.isVertical;
    },
    btnSize() {
      return "sm";
    },
    selectedColor: {
      get() {
        return (
          this.$store.state.ui.highlighterColor ||
          this.$store.state.ui.theme.colors.primary
        );
      },
      set(color) {
        this.$store.dispatch("ui/SET_UI", ["highlighterColor", color || ""]);
      },
    },
    defaultPalette() {
      const themeColors = this.$store.state.ui.theme.colors;
      return [
        themeColors.primary,
        themeColors.player1,
        themeColors.player2,
        colors.getBrand("positive"),
        colors.getBrand("negative"),
        themeColors.primary,
      ];
    },
    storedPalette() {
      return this.$store.state.ui.highlighterPalette || [];
    },
    palette() {
      return this.defaultPalette.map((def, i) => this.storedPalette[i] || def);
    },
    isCustomized() {
      return this.storedPalette.some((c) => c);
    },
    pickerPalette() {
      return this.defaultPalette;
    },
    isEmpty() {
      return isEmpty(this.$store.state.game.highlighterSquares);
    },
    isDialogOpen() {
      return !["local", "game"].includes(this.$route.name);
    },
  },
  methods: {
    selectColor(index) {
      this.selectedIndex = index;
      this.selectedColor = this.palette[index];
    },
    updateColor(color) {
      this.selectedColor = color;
      const stored = [...this.storedPalette];
      while (stored.length < 6) stored.push("");
      if (color === this.defaultPalette[this.selectedIndex]) {
        stored[this.selectedIndex] = "";
      } else {
        stored[this.selectedIndex] = color;
      }
      this.$store.dispatch("ui/SET_UI", ["highlighterPalette", stored]);
    },
    resetPalette() {
      this.$store.dispatch("ui/SET_UI", [
        "highlighterPalette",
        ["", "", "", "", "", ""],
      ]);
      this.selectedColor = this.defaultPalette[this.selectedIndex];
    },
    clear() {
      if (this.isEmpty) {
        this.$store.dispatch("game/SET_HIGHLIGHTER_ENABLED", false);
      } else {
        this.$store.dispatch("game/SET_HIGHLIGHTER_SQUARES", {});
      }
    },
    saveToNotes() {
      this.$store.dispatch("game/SAVE_HIGHLIGHTS_TO_NOTES");
    },
    hotkey(key) {
      if (key.startsWith("color")) {
        const index = key.slice(5) - 1;
        if (index < this.palette.length) {
          this.selectColor(index);
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
    this.selectedColor = this.palette[this.selectedIndex];
  },
};
</script>

<style lang="scss">
.highlighter-palette {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px;
  position: absolute;
  z-index: 2;

  &.horizontal {
    flex-direction: column;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;

    .palette-colors {
      gap: 4px;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
    }
    .palette-actions {
      gap: 2px;
      justify-content: center;
      align-items: center;
    }
  }

  &.vertical {
    flex-direction: row;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;

    .palette-colors {
      gap: 4px;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
    }
    .palette-actions {
      gap: 2px;
      justify-content: center;
      align-items: center;
    }
  }

  .palette-colors .q-btn {
    transition: box-shadow 0.2s;
    &.selected {
      box-shadow: 0 0 0 3px white, 0 0 0 5px rgba(0, 0, 0, 0.5);
    }
  }
}
</style>
