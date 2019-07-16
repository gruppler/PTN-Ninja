<template>
  <span class="ptn linenum">
    <span class="branch" v-if="this.linenum.branch">{{
      this.linenum.branch
    }}</span>
    <span class="number">{{ this.linenum.number }}. </span>
  </span>
</template>

<script>
export default {
  name: "Linenum",
  props: ["linenum", "game"]
};
</script>

<style lang="stylus">
.linenum
  .branch
    white-space nowrap
  .number
    font-weight bold
</style>
