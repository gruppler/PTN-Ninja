<template>
  <q-btn
    v-bind="$attrs"
    @click="toggle"
    @shortkey="toggle"
    v-shortkey="hotkey"
    :icon="value ? 'fullscreen_exit' : 'fullscreen'"
  >
    <hint>{{ $t("Fullscreen") }}</hint>
  </q-btn>
</template>

<script>
import { HOTKEYS } from "../../keymap";

export default {
  name: "FullscreenToggle",
  props: ["value"],
  data() {
    return {
      hotkey: HOTKEYS.MISC.fullscreen,
    };
  },
  methods: {
    toggle() {
      this.$emit("input", !this.value);
    },
  },
};
</script>
