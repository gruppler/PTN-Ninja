<template>
  <div
    class="move"
    :class="{
      'current-move': isCurrentMove,
      linebreak,
      'current-only': currentOnly !== undefined,
      standalone: standalone !== undefined
    }"
  >
    <div class="move-wrapper">
      <Linenum v-if="move.linenum" :linenum="move.linenum" :game="game" />
      <div class="plies">
        <template v-if="ply1 && (!player || player === 1)">
          <span v-if="isNop" class="ptn nop">{{ ply1.text() }}</span>
          <Ply v-else :key="ply1.id" :plyID="ply1.id" :game="game" />
        </template>
        <template v-if="ply2 && !ply2.isNop && (!player || player === 2)">
          <Ply :key="ply2.id" :plyID="ply2.id" :game="game" />
        </template>
      </div>
    </div>
    <q-separator v-if="separator" class="fullwidth-padded-md" dark />
  </div>
</template>

<script>
import Linenum from "./Linenum";
import Ply from "./Ply";

export default {
  name: "Move",
  components: { Linenum, Ply },
  props: [
    "move",
    "game",
    "currentOnly",
    "standalone",
    "noDecoration",
    "player"
  ],
  computed: {
    ply1() {
      return this.move.ply1Original || this.move.ply1;
    },
    ply2() {
      return this.move.ply2
        ? this.$store.state.showAllBranches && this.currentOnly === undefined
          ? this.move.ply2
          : this.move.ply2.getBranch(this.game.state.targetBranch)
        : null;
    },
    isNop() {
      return (
        this.move.ply1.isNop &&
        (!this.move.ply1Original ||
          (this.$store.state.showAllBranches && this.currentOnly === undefined))
      );
    },
    nextMove() {
      const moves = this.game.movesSorted;
      const index = moves.findIndex(move => move === this.move);
      return index < moves.length - 1 ? moves[index + 1] : null;
    },
    isCurrentMove() {
      return (
        this.noDecoration === undefined &&
        this.currentOnly === undefined &&
        this.game.state.move &&
        this.game.state.move.id === this.move.id
      );
    },
    linebreak() {
      return (
        this.noDecoration === undefined &&
        this.currentOnly === undefined &&
        this.$store.state.showAllBranches &&
        this.nextMove &&
        this.nextMove.branch != this.move.branch
      );
    },
    separator() {
      return (
        this.linebreak &&
        (!this.move.branch || !this.nextMove.firstPly.branches[0].branch)
      );
    }
  }
};
</script>

<style lang="stylus">
.move
  .plies
    display inline-block

  &.current-move
    background-color $highlight

  &.current-only .linenum .branch
    background-color transparent

  &.linebreak
    margin-bottom 1.5em

  .nop
    font-family 'Source Code Pro'
    padding 4px 8px
    color $gray-light
    white-space nowrap

  .q-separator
    position relative
    bottom -.75em

  &.standalone
    display inline-block
    border-radius 5px
    padding 0 .5em
    background-color rgba(#fff, .15)
    transition opacity $generic-hover-transition
    opacity 1
    &.lt-md
      opacity 0
</style>
