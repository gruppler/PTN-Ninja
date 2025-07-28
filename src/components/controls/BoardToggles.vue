<template>
  <q-page-sticky :position="position" :offset="offset">
    <div
      class="board-toggles q-gutter-sm q-pl-sm"
      :class="{ row: isPortrait, column: !isPortrait }"
    >
      <FullscreenToggle
        @contextmenu.prevent
        :target="fullscreenTarget"
        class="dimmed-btn"
        v-ripple="false"
        :color="fg"
        :size="size"
        flat
        round
      />

      <q-btn
        v-if="!isEmbedded || $store.state.ui.showBoardPrefsBtn"
        @contextmenu.prevent
        icon="settings"
        class="dimmed-btn"
        v-ripple="false"
        :color="fg"
        :size="size"
        flat
        round
      >
        <hint>{{ $t("Board Preferences") }}</hint>

        <q-menu transition-show="none" transition-hide="none" square>
          <q-list>
            <ThemeSelector v-model="themeID" edit-button filled square>
              <template v-slot:prepend>
                <q-icon name="color" />
              </template>
            </ThemeSelector>

            <q-item
              v-if="!isEmbedded || !isDisabled('board3D')"
              tag="label"
              :disable="isDisabled('board3D')"
              v-ripple="!isDisabled('board3D')"
            >
              <q-item-section>
                <q-item-label>{{ $t("3D Board") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="board3D" :disable="isDisabled('board3D')" />
              </q-item-section>
              <hint v-if="hotkeys.UI.board3D">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.board3D }}
              </hint>
            </q-item>

            <smooth-reflow>
              <q-item
                v-if="board3D && (!isEmbedded || !isDisabled('orthographic'))"
                tag="label"
                :disable="isDisabled('orthographic')"
                v-ripple="!isDisabled('orthographic')"
              >
                <q-item-section>
                  <q-item-label>{{ $t("Orthographic") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    v-model="orthographic"
                    :disable="isDisabled('orthographic')"
                  />
                </q-item-section>
                <hint v-if="hotkeys.UI.orthographic">
                  {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.orthographic }}
                </hint>
              </q-item>

              <q-item
                v-if="
                  board3D &&
                  !orthographic &&
                  (!isEmbedded || !isDisabled('perspective'))
                "
                :disable="isDisabled('perspective')"
                v-ripple="!isDisabled('perspective')"
              >
                <q-item-section>
                  {{ $t("Perspective") }}
                  <q-slider
                    v-model="perspective"
                    :min="1"
                    :max="10"
                    :label-value="perspective"
                    snap
                    label
                  />
                </q-item-section>
              </q-item>
            </smooth-reflow>

            <q-item
              v-if="!isEmbedded || !isDisabled('axisLabels')"
              tag="label"
              :disable="isDisabled('axisLabels')"
              v-ripple="!isDisabled('axisLabels')"
            >
              <q-item-section>
                <q-item-label>{{ $t("Axis Labels") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="axisLabels"
                  :disable="isDisabled('axisLabels')"
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.axisLabels">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.axisLabels }}
              </hint>
            </q-item>

            <q-item
              v-if="!isEmbedded || !isDisabled('axisLabelsSmall')"
              tag="label"
              :disable="!axisLabels || isDisabled('axisLabelsSmall')"
              v-ripple="axisLabels && !isDisabled('axisLabelsSmall')"
            >
              <q-item-section>
                <q-item-label>{{ $t("Axis Labels Small") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="axisLabelsSmall"
                  :disable="!axisLabels || isDisabled('axisLabelsSmall')"
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.axisLabelsSmall">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.axisLabelsSmall }}
              </hint>
            </q-item>

            <q-item
              v-if="!isEmbedded || !isDisabled('showRoads')"
              tag="label"
              :disable="isDisabled('showRoads')"
              v-ripple="!isDisabled('showRoads')"
            >
              <q-item-section>
                <q-item-label>{{ $t("Road Connections") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="showRoads"
                  :disable="isDisabled('showRoads')"
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.showRoads">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.showRoads }}
              </hint>
            </q-item>

            <q-item
              v-if="!isEmbedded || !isDisabled('turnIndicator')"
              tag="label"
              :disable="isDisabled('turnIndicator')"
              v-ripple="!isDisabled('turnIndicator')"
            >
              <q-item-section>
                <q-item-label>{{ $t("Turn Indicator") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="turnIndicator"
                  :disable="isDisabled('turnIndicator')"
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.turnIndicator">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.turnIndicator }}
              </hint>
            </q-item>

            <q-item
              v-if="!isEmbedded || !isDisabled('flatCounts')"
              tag="label"
              :disable="!turnIndicator || isDisabled('flatCounts')"
              v-ripple="Boolean(turnIndicator) && !isDisabled('flatCounts')"
            >
              <q-item-section>
                <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="flatCounts"
                  :disable="!turnIndicator || isDisabled('flatCounts')"
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.flatCounts">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.flatCounts }}
              </hint>
            </q-item>

            <q-item
              v-if="!isEmbedded || !isDisabled('stackCounts')"
              tag="label"
              :disable="isDisabled('stackCounts')"
              v-ripple="!isDisabled('stackCounts')"
            >
              <q-item-section>
                <q-item-label>{{ $t("Stack Counts") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="stackCounts"
                  :disable="isDisabled('stackCounts')"
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.stackCounts">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.stackCounts }}
              </hint>
            </q-item>

            <q-item
              v-if="!isEmbedded || !isDisabled('showEval')"
              tag="label"
              :disable="isDisabled('showEval')"
              v-ripple="!isDisabled('showEval')"
            >
              <q-item-section>
                <q-item-label>{{ $t("Evaluation Bars") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="showEval"
                  :disable="isDisabled('showEval')"
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.showEval">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.showEval }}
              </hint>
            </q-item>

            <q-item
              v-if="!isEmbedded || !isDisabled('moveNumber')"
              tag="label"
              :disable="isDisabled('moveNumber')"
              v-ripple="!isDisabled('moveNumber')"
            >
              <q-item-section>
                <q-item-label>{{ $t("Move Number") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="moveNumber"
                  :disable="isDisabled('moveNumber')"
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.moveNumber">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.moveNumber }}
              </hint>
            </q-item>

            <q-item
              v-if="!isEmbedded || !isDisabled('evalText')"
              tag="label"
              :disable="!moveNumber || isDisabled('evalText')"
              v-ripple="moveNumber && !isDisabled('evalText')"
            >
              <q-item-section>
                <q-item-label>{{ $t("Evaluation Text") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="evalText"
                  :disable="!moveNumber || isDisabled('evalText')"
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.evalText">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.evalText }}
              </hint>
            </q-item>

            <q-item
              v-if="!isEmbedded || !isDisabled('highlightSquares')"
              tag="label"
              :disable="isDisabled('highlightSquares')"
              v-ripple="!isDisabled('highlightSquares')"
            >
              <q-item-section>
                <q-item-label>{{ $t("Highlight Squares") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="highlightSquares"
                  :disable="isDisabled('highlightSquares')"
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.highlightSquares">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.highlightSquares }}
              </hint>
            </q-item>

            <q-item
              v-if="!isEmbedded || !isDisabled('unplayedPieces')"
              tag="label"
              :disable="isDisabled('unplayedPieces')"
              v-ripple="!isDisabled('unplayedPieces')"
            >
              <q-item-section>
                <q-item-label>{{ $t("Unplayed Pieces") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="unplayedPieces"
                  :disable="isDisabled('unplayedPieces')"
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.unplayedPieces">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.unplayedPieces }}
              </hint>
            </q-item>

            <q-item
              v-if="!isEmbedded || !isDisabled('verticalLayout')"
              tag="label"
              :disable="!unplayedPieces || isDisabled('verticalLayout')"
              v-ripple="unplayedPieces && !isDisabled('verticalLayout')"
            >
              <q-item-section>
                <q-item-label>{{ $t("Vertical Layout") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="verticalLayout"
                  :disable="!unplayedPieces || isDisabled('verticalLayout')"
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.verticalLayout">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.UI.verticalLayout }}
              </hint>
            </q-item>

            <q-item
              v-if="!isEmbedded || !isDisabled('verticalLayoutAuto')"
              tag="label"
              :disable="
                !unplayedPieces ||
                !verticalLayout ||
                isDisabled('verticalLayoutAuto')
              "
              v-ripple="
                unplayedPieces &&
                verticalLayout &&
                !isDisabled('verticalLayoutAuto')
              "
            >
              <q-item-section>
                <q-item-label>{{ $t("Vertical Layout Auto") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="verticalLayoutAuto"
                  :disable="
                    !unplayedPieces ||
                    !verticalLayout ||
                    isDisabled('verticalLayoutAuto')
                  "
                />
              </q-item-section>
              <hint v-if="hotkeys.UI.verticalLayoutAuto">
                {{ $t("Hotkey") }}:
                {{ hotkeysFormatted.UI.verticalLayoutAuto }}
              </hint>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <q-btn
        v-if="!isEmbedded || $store.state.ui.showBoardTransformBtn"
        @contextmenu.prevent="resetTransform"
        :direction="isPortrait ? 'down' : 'left'"
        icon="rotate_180"
        class="dimmed-btn"
        v-ripple="false"
        :color="fg"
        :size="size"
        flat
        round
        v-shortkey="hotkeys.TRANSFORMS"
        @shortkey="shortkey"
      >
        <hint>{{ $t("Transform Board") }}</hint>

        <q-menu transition-show="none" transition-hide="none" auto-close square>
          <q-list>
            <q-item @click="rotate180" clickable v-ripple>
              <q-item-section side>
                <q-icon name="rotate_180" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Rotate 180") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.rotate180">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.TRANSFORMS.rotate180 }}
              </hint>
            </q-item>
            <q-item @click="rotateLeft" clickable v-ripple>
              <q-item-section side>
                <q-icon name="rotate_left" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Rotate Left") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.rotateLeft">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.TRANSFORMS.rotateLeft }}
              </hint>
            </q-item>
            <q-item @click="rotateRight" clickable v-ripple>
              <q-item-section side>
                <q-icon name="rotate_right" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Rotate Right") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.rotateRight">
                {{ $t("Hotkey") }}:
                {{ hotkeysFormatted.TRANSFORMS.rotateRight }}
              </hint>
            </q-item>
            <q-item @click="flipHorizontal" clickable v-ripple>
              <q-item-section side>
                <q-icon name="flip_horizontal" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Flip Horizontally") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.flipHorizontal">
                {{ $t("Hotkey") }}:
                {{ hotkeysFormatted.TRANSFORMS.flipHorizontal }}
              </hint>
            </q-item>
            <q-item @click="flipVertical" clickable v-ripple>
              <q-item-section side>
                <q-icon name="flip_vertical" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Flip Vertically") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.flipVertical">
                {{ $t("Hotkey") }}:
                {{ hotkeysFormatted.TRANSFORMS.flipVertical }}
              </hint>
            </q-item>
            <q-separator />
            <q-item
              @click="resetTransform"
              :disable="!isTransformed"
              clickable
              v-ripple
            >
              <q-item-section side>
                <q-icon name="close" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Reset") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.resetTransform">
                {{ $t("Hotkey") }}:
                {{ hotkeysFormatted.TRANSFORMS.resetTransform }}
              </hint>
            </q-item>
            <q-item
              @click="applyTransform"
              :disable="!isTransformed"
              clickable
              v-ripple
            >
              <q-item-section side>
                <q-icon name="apply" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Apply") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.applyTransform">
                {{ $t("Hotkey") }}:
                {{ hotkeysFormatted.TRANSFORMS.applyTransform }}
              </hint>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <q-btn
        v-if="!isEmbedded"
        @contextmenu.prevent
        @click="highlighterEnabled = !highlighterEnabled"
        icon="highlighter"
        :class="{ 'dimmed-btn': !highlighterEnabled }"
        v-ripple="false"
        :color="highlighterEnabled ? '' : fg"
        :style="{ color: highlighterEnabled ? highlighterColor : '' }"
        :size="size"
        flat
        round
      >
        <hint>{{ $t("Highlighter") }}</hint>
      </q-btn>
    </div>
  </q-page-sticky>
</template>

<script>
import FullscreenToggle from "./FullscreenToggle";
import ThemeSelector from "./ThemeSelector";

import { zipObject } from "lodash";
import { HOTKEYS, HOTKEYS_FORMATTED } from "../../keymap";

const props = [
  "axisLabels",
  "axisLabelsSmall",
  "board3D",
  "flatCounts",
  "highlightSquares",
  "evalText",
  "moveNumber",
  "orthographic",
  "perspective",
  "showEval",
  "showRoads",
  "stackCounts",
  "themeID",
  "turnIndicator",
  "unplayedPieces",
  "verticalLayout",
  "verticalLayoutAuto",
];

export default {
  name: "BoardToggles",
  components: { FullscreenToggle, ThemeSelector },
  props: ["fullscreenTarget"],
  data() {
    return {
      hotkeys: HOTKEYS,
      hotkeysFormatted: HOTKEYS_FORMATTED,
    };
  },
  computed: {
    isEmbedded() {
      return this.$store.state.ui.embed;
    },
    highlighterEnabled: {
      get() {
        return this.$store.state.ui.highlighterEnabled;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", [
          "highlighterEnabled",
          value || false,
        ]);
      },
    },
    highlighterColor() {
      return (
        this.$store.state.ui.highlighterColor ||
        this.$store.state.ui.theme.colors.primary
      );
    },
    disabled() {
      return this.$store.getters["game/disabledOptions"];
    },
    fg() {
      return this.$store.state.ui.theme.secondaryDark
        ? "textLight"
        : "textDark";
    },
    ...zipObject(
      props,
      props.map((key) => ({
        get() {
          return this.isDisabled(key) ? false : this.$store.state.ui[key];
        },
        set(value) {
          this.$store.dispatch("ui/SET_UI", [key, value]);
        },
      }))
    ),
    size() {
      if (
        (this.isPortrait &&
          (this.$store.state.ui.isVertical
            ? !this.$store.state.ui.moveNumber
            : !this.$store.state.ui.moveNumber ||
              this.$store.state.ui.turnIndicator) &&
          this.boardSpace.height - this.boardSize.height < 80) ||
        this.boardSpace.height < 260
      ) {
        return "sm";
      }
      return "md";
    },
    position() {
      if (this.isPortrait) {
        return "top-left";
      } else if (this.boardSpace.height > 350) {
        return "right";
      } else {
        return "top-right";
      }
    },
    offset() {
      return this.isPortrait
        ? [0, 6 * (this.boardSpace.height - this.boardSize.height > 100)]
        : [6, 6 * (this.boardSpace.height <= 350)];
    },
    isPortrait() {
      return this.$store.state.ui.isPortrait;
    },
    boardSize() {
      return this.$store.state.ui.boardSize;
    },
    boardSpace() {
      return this.$store.state.ui.boardSpace;
    },
    boardTransform() {
      return this.$store.state.ui.boardTransform;
    },
    isTransformed() {
      return Boolean(this.boardTransform[0] || this.boardTransform[1]);
    },
  },
  methods: {
    isDisabled(key) {
      return this.disabled && this.disabled.includes(key);
    },
    resetTransform() {
      this.$store.dispatch("ui/RESET_TRANSFORM");
    },
    applyTransform() {
      this.$store.dispatch("game/APPLY_TRANSFORM", this.boardTransform);
    },
    rotate180() {
      this.$store.dispatch("ui/ROTATE_180");
    },
    rotateLeft() {
      this.$store.dispatch("ui/ROTATE_LEFT");
    },
    rotateRight() {
      this.$store.dispatch("ui/ROTATE_RIGHT");
    },
    flipHorizontal() {
      this.$store.dispatch("ui/FLIP_HORIZONTAL");
    },
    flipVertical() {
      this.$store.dispatch("ui/FLIP_VERTICAL");
    },
    shortkey({ srcKey }) {
      this[srcKey]();
    },
  },
};
</script>
