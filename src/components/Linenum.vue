<template>
  <span class="ptn linenum">
    <span class="branch" :class="{ selected: isSelected }" v-if="showBranch">{{
      this.linenum.branch
    }}</span>
    <span class="number">{{ this.linenum.number }}. </span>
  </span>
</template>

<script>
export default {
  name: "Linenum",
  props: ["linenum", "game", "noBranch"],
  computed: {
    showBranch() {
      return (
        this.noBranch === undefined &&
        this.linenum.branch &&
        this.$store.state.showAllBranches
      );
    },
    isSelected() {
      const ply1 = this.linenum.move.ply1;
      const ply2 = this.linenum.move.ply2;
      return (
        this.showBranch &&
        this.game.state.targetBranch &&
        ((ply1 &&
          ply1.branches &&
          ply1.branches.length &&
          ply1.branches[0] !== ply1 &&
          this.game.state.plies.includes(ply1)) ||
          (ply2 &&
            ply2.branches &&
            ply2.branches.length &&
            ply2.branches[0] !== ply2 &&
            this.game.state.plies.includes(ply2)))
      );
    }
  }
};
</script>

<style lang="stylus">
.linenum
  .branch
    white-space nowrap
    &.selected
      background-color rgba($accent, 0.75)
      border-radius $generic-border-radius
  .number
    font-weight bold
</style>
