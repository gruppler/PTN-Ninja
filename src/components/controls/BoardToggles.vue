<template>
  <div
    class="board-toggles q-gutter-sm"
    :class="{ 'row reverse': isPortrait, column: !isPortrait }"
    v-shortkey="hotkeys"
    @shortkey="shortkey"
  >
    <FullscreenToggle
      :target="fullscreenTarget"
      class="dimmed-btn"
      :ripple="false"
      :color="fg"
      flat
      fab
    />

    <q-btn
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

    <template v-if="showAll">
      <q-btn
        @click="rotate180"
        @contextmenu.prevent="resetTransform"
        icon="rotate_180"
        class="dimmed-btn"
        :ripple="false"
        :color="fg"
        flat
        fab
      >
        <hint>{{ $t("Rotate 180") }}</hint>
      </q-btn>
      <q-btn
        @click="rotateLeft"
        @contextmenu.prevent="resetTransform"
        icon="rotate_left"
        class="dimmed-btn"
        :ripple="false"
        :color="fg"
        flat
        fab
      >
        <hint>{{ $t("Rotate Left") }}</hint>
      </q-btn>

      <q-btn
        @click="rotateRight"
        @contextmenu.prevent="resetTransform"
        icon="rotate_right"
        class="dimmed-btn"
        :ripple="false"
        :color="fg"
        flat
        fab
      >
        <hint>{{ $t("Rotate Right") }}</hint>
      </q-btn>

      <q-btn
        @click="flipHorizontal"
        @contextmenu.prevent="resetTransform"
        icon="flip_horizontal"
        class="dimmed-btn"
        :ripple="false"
        :color="fg"
        flat
        fab
      >
        <hint>{{ $t("Flip Horizontally") }}</hint>
      </q-btn>

      <q-btn
        @click="flipVertical"
        @contextmenu.prevent="resetTransform"
        icon="flip_vertical"
        class="dimmed-btn"
        :ripple="false"
        :color="fg"
        flat
        fab
      >
        <hint>{{ $t("Flip Vertically") }}</hint>
      </q-btn>
    </template>
    <q-fab
      v-else
      @contextmenu.prevent="resetTransform"
      :direction="isPortrait ? 'down' : 'left'"
      icon="rotate_180"
      class="dimmed-btn"
      :ripple="false"
      :color="fg"
      flat
    >
      <q-fab-action @click="rotate180" icon="rotate_180" class="bg-bg">
        <hint>{{ $t("Rotate 180") }}</hint>
      </q-fab-action>

      <q-fab-action @click="rotateLeft" icon="rotate_left" class="bg-bg">
        <hint>{{ $t("Rotate Left") }}</hint>
      </q-fab-action>

      <q-fab-action @click="rotateRight" icon="rotate_right" class="bg-bg">
        <hint>{{ $t("Rotate Right") }}</hint>
      </q-fab-action>

      <q-fab-action
        @click="flipHorizontal"
        icon="flip_horizontal"
        class="bg-bg"
      >
        <hint>{{ $t("Flip Horizontally") }}</hint>
      </q-fab-action>

      <q-fab-action @click="flipVertical" icon="flip_vertical" class="bg-bg">
        <hint>{{ $t("Flip Vertically") }}</hint>
      </q-fab-action>
    </q-fab>
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
    showAll() {
      return this.isPortrait
        ? this.$store.state.ui.boardSpace.width >= 453
        : this.$store.state.ui.boardSpace.height >= 522;
    },
  },
  methods: {
    resetTransform() {
      this.$store.dispatch("ui/RESET_TRANSFORM");
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
