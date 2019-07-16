<template>
  <div
    class="square"
    :class="{
      dark: x % 2 === y % 2,
      light: x % 2 !== y % 2
    }"
  ></div>
</template>

<script>
export default {
  name: "Square",
  props: ["x", "y"],
  data() {
    return {};
  },
  computed: {
    edge() {
      return "";
    }
  }
};
</script>

<style lang="stylus">
.square
  &.light
    background $blue-grey-4
</style>
