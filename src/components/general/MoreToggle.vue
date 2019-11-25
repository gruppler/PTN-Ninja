<template>
  <q-btn
    :icon="value ? 'unfold_less' : 'unfold_more'"
    :label="$t(value ? 'Show Less' : 'Show More')"
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
      hotkey: HOTKEYS.MISC["Show More"]
    };
  },
  methods: {
    toggle() {
      this.$emit("input", !this.value);
    }
  }
};
</script>

<style></style>
