<template>
  <span class="ptn linenum">
    <span class="branch" v-if="showBranch">{{ this.linenum.branch }}</span>
    <span class="number">{{ this.linenum.number }}. </span>
  </span>
</template>

<script>
export default {
  name: "Linenum",
  props: ["linenum", "game"],
  computed: {
    showBranch() {
      return this.linenum.branch && this.$store.state.showAllBranches;
    }
  }
};
</script>

<style lang="stylus">
.linenum
  .branch
    white-space nowrap
  .number
    font-weight bold
</style>
