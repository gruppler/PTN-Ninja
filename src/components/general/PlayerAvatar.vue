<template>
  <q-avatar
    v-if="value"
    class="player-avatar"
    v-html="icon"
    v-bind="$attrs"
    v-on="$listeners"
    square
  />
</template>

<script>
import { toSvg } from "jdenticon";

export default {
  name: "PlayerAvatar",
  props: {
    value: String,
  },
  computed: {
    icon() {
      return toSvg(this.value.trim().toLowerCase(), "100");
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
