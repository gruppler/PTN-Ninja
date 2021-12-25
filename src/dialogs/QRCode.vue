<template>
  <q-dialog
    :value="true"
    v-show="text"
    @show="show"
    @hide="hide"
    content-class="flex-center"
    v-bind="$attrs"
    :maximized="maximized"
    no-route-dismiss
  >
    <canvas ref="qrcode" class="qr-canvas flex flex-center" v-close-popup />
  </q-dialog>
</template>

<script>
import Qrious from "qrious";

const SIZE = 450;
const PADDING = 24;
const SCREEN = SIZE + PADDING * 2;

export default {
  name: "QRCode",
  props: {
    goBack: Boolean,
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
    show() {
      new Qrious({
        element: this.$refs.qrcode,
        background: this.bg,
        foreground: this.fg,
        value: this.text,
        backgroundAlpha: 1,
        size: SIZE,
      });
    },
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
