<template>
  <q-dialog :value="value" @input="$emit('input', $event)">
    <qriously
      v-if="text"
      class="qr-canvas"
      :value="text"
      :size="450"
      foreground="#eceff1"
      background="#263238"
      :backgroundAlpha="1"
      v-close-popup
    />
  </q-dialog>
</template>

<script>
export default {
  name: "QRCode",
  props: ["value", "text"]
};
</script>

<style lang="stylus">
.qr-canvas canvas
  display block
  max-width 100%
</style>
