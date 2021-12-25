<template>
  <tooltip v-if="enabled" v-bind="$attrs" v-on="$listeners">
    <slot />
  </tooltip>
</template>

<script>
export default {
  name: "hint",
  computed: {
    enabled() {
      return this.$store.state.ui.showHints;
    },
  },
};
</script>
