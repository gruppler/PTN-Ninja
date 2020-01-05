<template>
  <q-dialog
    v-show="text"
    :value="value"
    @input="$emit('input', $event)"
    content-class="flex-center"
    v-bind="$attrs"
    :maximized="maximized"
  >
    <qriously
      v-if="text"
      class="qr-canvas flex flex-center"
      :value="text"
      :size="size"
      foreground="#eceff1"
      background="#263238"
      :backgroundAlpha="1"
      v-close-popup
    />
  </q-dialog>
</template>

<script>
const SIZE = 450;
const PADDING = 24;
const SCREEN = SIZE * PADDING * 2;

export default {
  name: "QRCode",
  data() {
    return { size: SIZE };
  },
  props: ["value", "text"],
  computed: {
    maximized() {
      return this.$q.screen.width <= SCREEN || this.$q.screen.height <= SCREEN;
    }
  }
};
</script>

<style lang="stylus">
.qr-canvas
  canvas
    display block
    max-width 100vmin
</style>
