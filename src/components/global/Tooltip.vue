<template>
  <q-tooltip
    ref="tooltip"
    :delay="0"
    self="bottom middle"
    anchor="top middle"
    transition-show="none"
    transition-hide="none"
    :content-class="{ 'tooltip non-selectable': true, 'q-pa-sm': square }"
    :offset="offset"
    v-bind="$attrs"
    v-on="$listeners"
  >
    <slot />
  </q-tooltip>
</template>

<script>
export default {
  name: "tooltip",
  props: {
    square: Boolean,
  },
  computed: {
    offset() {
      return this.$q.platform.has.touch ? [0, 20] : [0, 5];
    },
  },
};
</script>

<style lang="scss">
.tooltip {
  font-size: 0.8rem;
  background-color: rgba(#000, 0.8);
  color: #fff;
  overflow: visible;
  white-space: nowrap;
}
</style>
