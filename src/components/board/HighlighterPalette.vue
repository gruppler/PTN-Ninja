<template>
  <div
    class="highlighter-palette"
    :class="{ vertical: isVertical, horizontal: !isVertical }"
    v-shortkey="isDialogOpen ? null : hotkeys"
    @shortkey="hotkey($event.srcKey)"
  >
    <div class="palette-colors">
      <q-btn
        v-for="(color, i) in palette"
        :key="i"
        :style="{ background: color }"
        :class="{ selected: i === selectedIndex }"
        round
        unelevated
        @click="selectColor(i)"
      >
        <hint>{{ $t(colorNames["color" + (i + 1)]) }}</hint>
      </q-btn>
    </div>
    <q-btn-group flat class="palette-actions">
      <ColorPicker
        :value="selectedColor"
        @input="updateColor"
        :palette="pickerPalette"
        icon="edit"
        flat
      >
        <hint>{{ $t("Edit") }}</hint>
      </ColorPicker>
      <q-btn @click="resetPalette" icon="undo" :disable="!isCustomized" flat>
        <hint>{{ $t("Reset") }}</hint>
      </q-btn>
      <q-btn @click="saveToNotes" icon="save" :disable="isEmpty" flat>
        <hint>{{ $t("Save to Notes") }}</hint>
      </q-btn>
      <q-btn @click.stop icon="delete" :disable="!hasAnyPositions" flat>
        <q-menu auto-close>
          <q-list>
            <q-item clickable :disable="isEmpty" @click="deletePosition">
              <q-item-section avatar>
                <q-icon name="delete" />
              </q-item-section>
              <q-item-section>{{
                $t("Delete Position Highlights")
              }}</q-item-section>
            </q-item>
            <q-item clickable @click="deleteAll">
              <q-item-section avatar>
                <q-icon name="delete_all" />
              </q-item-section>
              <q-item-section>{{ $t("Delete All Highlights") }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
        <hint>{{ $t("Delete") }}</hint>
      </q-btn>
      <q-btn @click="clear" :icon="isEmpty ? 'close' : 'clear'" flat>
        <hint>{{ $t(isEmpty ? "Close" : "Clear") }}</hint>
      </q-btn>
    </q-btn-group>
  </div>
</template>

<script>
import ColorPicker from "../controls/ColorPicker";
import { colors } from "quasar";
import { HOTKEYS, HOTKEY_NAMES } from "../../keymap";
import { isEmpty } from "lodash";

export default {
  name: "HighlighterPalette",
  components: { ColorPicker },
  data() {
    return {
      hotkeys: { ...HOTKEYS.HIGHLIGHTER, ...HOTKEYS.CONTROLS },
      colorNames: HOTKEY_NAMES.HIGHLIGHTER,
      selectedIndex: 0,
    };
  },
  computed: {
    isVertical() {
      return this.$store.state.ui.isVertical;
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
    hasAnyPositions() {
      return (
        Object.keys(this.$store.state.game.highlighterPositions).length > 0
      );
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
    deletePosition() {
      this.$store.dispatch("game/CLEAR_HIGHLIGHTER_POSITION");
    },
    deleteAll() {
      this.$store.dispatch("game/CLEAR_ALL_HIGHLIGHTER_POSITIONS");
    },
    hotkey(key) {
      if (key.startsWith("color")) {
        const index = key.slice(5) - 1;
        if (index < this.palette.length) {
          this.selectColor(index);
        }
      } else {
        switch (key) {
          case "toggle":
            this.$store.dispatch("game/SET_HIGHLIGHTER_ENABLED", false);
            break;
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
  // Size color buttons relative to the square size
  --color-btn-size: calc(var(--square-size) * 0.45);
  --action-icon-size: calc(var(--square-size) * 0.25);

  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 2;

  .palette-colors {
    display: flex;
    align-items: center;
    justify-content: space-evenly;
    flex: 1;
    min-width: 0;
    min-height: 0;

    .q-btn {
      width: var(--color-btn-size);
      height: var(--color-btn-size);
      min-width: 0;
      min-height: 0;
      transition: box-shadow 0.2s;
      &.selected {
        box-shadow: 0 0 0 3px white, 0 0 0 5px rgba(0, 0, 0, 0.5);
      }
      .q-icon {
        font-size: var(--action-icon-size);
      }
    }
  }

  .palette-actions {
    flex-shrink: 0;
    .q-btn {
      min-width: 0;
      min-height: 0;
      padding: calc(var(--action-icon-size) * 0.4);
      .q-icon {
        font-size: var(--action-icon-size);
      }
    }
  }

  // Horizontal: unplayed area is a column to the right of the board
  &.horizontal {
    flex-direction: row;

    .palette-colors {
      flex-direction: column;
    }

    .palette-actions {
      flex-direction: column;
    }
  }

  // Vertical: unplayed area is a row below the board
  &.vertical {
    flex-direction: column;

    .palette-colors {
      flex-direction: row;
    }

    .palette-actions {
      flex-direction: row;
    }
  }
}
</style>
