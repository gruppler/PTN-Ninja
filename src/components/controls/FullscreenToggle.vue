<template>
  <q-btn
    v-if="isEnabled"
    v-bind="$attrs"
    @click="toggle"
    @shortkey="toggle"
    v-shortkey="hotkey"
    :icon="isActive ? 'fullscreen_exit' : 'fullscreen'"
  >
    <hint>{{ $t("Fullscreen") }}</hint>
  </q-btn>
</template>

<script>
import { HOTKEYS } from "../../keymap";

export default {
  name: "FullscreenToggle",
  props: ["value", "target"],
  data() {
    return {
      hotkey: HOTKEYS.MISC.fullscreen,
    };
  },
  computed: {
    isEnabled() {
      return this.$q.fullscreen.isCapable && document.fullscreenEnabled;
    },
    isActive() {
      if (this.target) {
        return this.$q.fullscreen.activeEl === this.target;
      } else {
        return this.value || this.$q.fullscreen.isActive;
      }
    },
  },
  methods: {
    toggle() {
      if (this.isActive) {
        this.$q.fullscreen.exit();
      } else {
        this.$q.fullscreen.request(this.target);
      }
    },
  },
};
</script>
