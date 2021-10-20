<template>
  <div
    class="board-toggles q-gutter-sm"
    :class="{ 'row reverse': isPortrait, column: !isPortrait }"
  >
    <FullscreenToggle
      v-if="$q.fullscreen.isCapable"
      @input="$q.fullscreen.toggle()"
      :value="$q.fullscreen.isActive"
      class="dimmed-btn"
      :ripple="false"
      :color="fg"
      flat
      fab
    />

    <q-btn
      @click="board3D = !board3D"
      :icon="board3D ? '2d' : '3d'"
      :title="$t((board3D ? '2' : '3') + 'D Board')"
      class="dimmed-btn"
      :ripple="false"
      :color="fg"
      flat
      fab
    />

    <template v-if="showAll">
      <q-btn
        @click="rotate180"
        @contextmenu.prevent="resetTransform"
        icon="rotate_180"
        :title="$t('Rotate 180')"
        class="dimmed-btn"
        :ripple="false"
        :color="fg"
        flat
        fab
      />
      <q-btn
        @click="rotateLeft"
        @contextmenu.prevent="resetTransform"
        icon="rotate_left"
        :title="$t('Rotate Left')"
        class="dimmed-btn"
        :ripple="false"
        :color="fg"
        flat
        fab
      />

      <q-btn
        @click="rotateRight"
        @contextmenu.prevent="resetTransform"
        icon="rotate_right"
        :title="$t('Rotate Right')"
        class="dimmed-btn"
        :ripple="false"
        :color="fg"
        flat
        fab
      />

      <q-btn
        @click="flipHorizontal"
        @contextmenu.prevent="resetTransform"
        icon="flip_horizontal"
        :title="$t('Flip Horizontally')"
        class="dimmed-btn"
        :ripple="false"
        :color="fg"
        flat
        fab
      />

      <q-btn
        @click="flipVertical"
        @contextmenu.prevent="resetTransform"
        icon="flip_vertical"
        :title="$t('Flip Vertically')"
        class="dimmed-btn"
        :ripple="false"
        :color="fg"
        flat
        fab
      />
    </template>
    <q-fab
      v-else
      @contextmenu.prevent="resetTransform"
      :direction="isPortrait ? 'down' : 'left'"
      icon="rotate_180"
      :title="$t('Rotate/Flip')"
      class="dimmed-btn"
      :ripple="false"
      :color="fg"
      flat
    >
      <q-fab-action
        @click="rotate180"
        icon="rotate_180"
        :title="$t('Rotate 180')"
        class="bg-bg"
      />

      <q-fab-action
        @click="rotateLeft"
        icon="rotate_left"
        :title="$t('Rotate Left')"
        class="bg-bg"
      />

      <q-fab-action
        @click="rotateRight"
        icon="rotate_right"
        :title="$t('Rotate Right')"
        class="bg-bg"
      />

      <q-fab-action
        @click="flipHorizontal"
        icon="flip_horizontal"
        :title="$t('Flip Horizontally')"
        class="bg-bg"
      />

      <q-fab-action
        @click="flipVertical"
        icon="flip_vertical"
        :title="$t('Flip Vertically')"
        class="bg-bg"
      />
    </q-fab>
  </div>
</template>

<script>
import FullscreenToggle from "./FullscreenToggle";

export default {
  name: "BoardToggles",
  components: { FullscreenToggle },
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
  },
};
</script>
