<template>
  <span class="ptn linenum">
    <span
      class="branch q-pa-xs q-mr-xs"
      :class="{ selected: isSelected }"
      v-if="showBranch"
      >{{ this.linenum.branch }}</span
    >
    <span class="number q-py-xs">{{ this.linenum.number }}.&nbsp;</span>
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
          this.game.state.plyIDs.includes(ply1.id)) ||
          (ply2 &&
            ply2.branches &&
            ply2.branches.length &&
            ply2.branches[0] !== ply2 &&
            this.game.state.plyIDs.includes(ply2.id)))
      );
    }
  }
};
</script>

<style lang="stylus">
.linenum
  display flex
  flex-direction row
  align-items flex-start
  .branch
    font-size 0.8em
    white-space nowrap
    &.selected
      background-color rgba($accent, 0.75)
      border-radius $generic-border-radius
  .number
    font-size 0.9em
    font-weight bold
</style>
