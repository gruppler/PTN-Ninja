<template>
  <q-dialog
    :value="true"
    v-show="text"
    @hide="hide"
    content-class="flex-center"
    v-bind="$attrs"
    :maximized="maximized"
    no-route-dismiss
  >
    <qriously
      v-if="text"
      class="qr-canvas flex flex-center"
      :value="text"
      :size="size"
      :foreground="fg"
      :background="bg"
      :backgroundAlpha="1"
      v-close-popup
    />
  </q-dialog>
</template>

<script>
const SIZE = 450;
const PADDING = 24;
const SCREEN = SIZE + PADDING * 2;

export default {
  name: "QRCode",
  props: {
    goBack: Boolean,
  },
  data() {
    return { size: SIZE };
  },
  computed: {
    text() {
      return this.$store.getters["ui/url"](this.$game, {
        origin: true,
        state: true,
      });
    },
    maximized() {
      return this.$q.screen.width <= SCREEN || this.$q.screen.height <= SCREEN;
    },
    fg() {
      return this.$store.state.ui.theme.isDark ? "white" : "black";
    },
    bg() {
      return this.$store.state.ui.theme.isDark ? "black" : "white";
    },
  },
  methods: {
    hide() {
      if (this.goBack) {
        this.$router.back();
      }
    },
  },
};
</script>

<style lang="scss">
.qr-canvas {
  canvas {
    display: block;
    max-width: 100vmin;
  }
}
</style>
