<template>
  <q-icon
    v-bind="$attrs"
    @click="toggle"
    @shortkey="toggle"
    v-shortkey="hotkey"
    :name="value ? 'fullscreen_exit' : 'fullscreen'"
    :title="$t('Fullscreen')"
    class="q-field__focusable-action"
  />
</template>

<script>
import { HOTKEYS } from "../../keymap";

export default {
  name: "FullscreenToggle",
  props: ["value"],
  data() {
    return {
      hotkey: HOTKEYS.MISC.fullscreen
    };
  },
  methods: {
    toggle() {
      this.$emit("input", !this.value);
    }
  }
};
</script>
