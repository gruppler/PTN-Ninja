<template>
  <q-avatar
    v-if="value"
    class="player-avatar rounded-borders"
    v-html="icon"
    v-bind="$attrs"
    v-on="$listeners"
    square
  />
</template>

<script>
import Identicon from "identicon.js";
import sha1 from "sha1";
import { isNumber } from "lodash";

const SIZES = {
  xs: 18,
  sm: 24,
  md: 32,
  lg: 38,
  xl: 46,
};

export default {
  name: "PlayerAvatar",
  props: {
    value: String,
    size: {
      type: [Number, String],
      default: 48,
    },
  },
  computed: {
    icon() {
      const size = isNumber(this.size)
        ? this.size
        : SIZES[this.size] || SIZES.md;
      const data = new Identicon(sha1(this.value.trim().toLowerCase()), {
        background: [0, 0, 0, 192],
        size,
      }).toString();
      return `<img width=${size} height=${size} src="data:image/png;base64,${data}" />`;
    },
  },
};
</script>

<style lang="scss">
.player-avatar svg {
  width: 100%;
  height: 100%;
}
</style>
