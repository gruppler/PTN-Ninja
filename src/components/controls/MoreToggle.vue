<template>
  <q-btn
    :icon="value ? 'less' : 'more'"
    :label="$t(value ? 'Less' : 'More')"
    @click="toggle"
    v-shortkey="hotkey"
    @shortkey="toggle"
    flat
  />
</template>

<script>
import { HOTKEYS } from "../../keymap";

export default {
  name: "MoreToggle",
  props: ["value"],
  data() {
    return {
      hotkey: HOTKEYS.MISC.more,
    };
  },
  methods: {
    toggle() {
      this.$emit("input", !this.value);
    },
  },
};
</script>
