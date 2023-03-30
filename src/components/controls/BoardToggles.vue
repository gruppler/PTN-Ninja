<template>
  <div
    class="board-toggles q-gutter-sm"
    :class="{ 'row reverse': isPortrait, column: !isPortrait }"
    v-shortkey="hotkeys"
    @shortkey="shortkey"
  >
    <FullscreenToggle
      @contextmenu.prevent
      :target="fullscreenTarget"
      class="dimmed-btn"
      :ripple="false"
      :color="fg"
      flat
      fab
    />

    <q-btn
      @contextmenu.prevent
      @click="board3D = !board3D"
      :icon="board3D ? '2d' : '3d'"
      class="dimmed-btn"
      :ripple="false"
      :color="fg"
      flat
      fab
    >
      <hint>{{ $t((board3D ? "2" : "3") + "D Board") }}</hint>
    </q-btn>

    <q-btn
      @contextmenu.prevent="resetTransform"
      :direction="isPortrait ? 'down' : 'left'"
      icon="rotate_180"
      class="dimmed-btn"
      :ripple="false"
      :color="fg"
      flat
      fab
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
          </q-item>
          <q-item @click="rotateLeft" clickable v-ripple>
            <q-item-section side>
              <q-icon name="rotate_left" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $t("Rotate Left") }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item @click="rotateRight" clickable v-ripple>
            <q-item-section side>
              <q-icon name="rotate_right" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $t("Rotate Right") }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item @click="flipHorizontal" clickable v-ripple>
            <q-item-section side>
              <q-icon name="flip_horizontal" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $t("Flip Horizontally") }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item @click="flipVertical" clickable v-ripple>
            <q-item-section side>
              <q-icon name="flip_vertical" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $t("Flip Vertically") }}</q-item-label>
            </q-item-section>
          </q-item>
          <template v-if="isTransformed">
            <q-separator />
            <q-item @click="resetTransform" clickable v-ripple>
              <q-item-section side>
                <q-icon name="close" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Reset") }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item @click="applyTransform" clickable v-ripple>
              <q-item-section side>
                <q-icon name="apply" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Apply") }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-list>
      </q-menu>
    </q-btn>
  </div>
</template>

<script>
import FullscreenToggle from "./FullscreenToggle";
import { HOTKEYS } from "../../keymap";

export default {
  name: "BoardToggles",
  components: { FullscreenToggle },
  props: ["fullscreenTarget"],
  data() {
    return {
      hotkeys: HOTKEYS.TRANSFORMS,
    };
  },
  computed: {
    fg() {
      return this.$store.state.ui.theme.secondaryDark
        ? "textLight"
        : "textDark";
    },
    board3D: {
      get() {
        return this.$store.state.ui.board3D;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["board3D", value]);
      },
    },
    isPortrait() {
      return this.$store.state.ui.isPortrait;
    },
    boardTransform() {
      return this.$store.state.ui.boardTransform;
    },
    isTransformed() {
      return this.boardTransform[0] || this.boardTransform[1];
    },
  },
  methods: {
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
