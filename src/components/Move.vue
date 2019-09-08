<template>
  <div
    class="ptn move"
    :class="{
      'current-move': isCurrentMove,
      linebreak,
      'current-only': currentOnly !== undefined
    }"
  >
    <div class="move-wrapper">
      <Linenum v-if="move.linenum" :linenum="move.linenum" :game="game" />
      <Ply
        v-if="move.ply1"
        :ply="
          $store.state.showAllBranches && currentOnly === undefined
            ? move.ply1
            : move.ply1Original || move.ply1
        "
        :game="game"
      />
      <Ply
        v-if="move.ply2"
        :ply="
          $store.state.showAllBranches && currentOnly === undefined
            ? move.ply2
            : move.ply2.getBranch(game.state.targetBranch)
        "
        :game="game"
      />
    </div>
  </div>
</template>

<script>
import Linenum from "./Linenum";
import Ply from "./Ply";

export default {
  name: "Move",
  components: { Linenum, Ply },
  props: ["move", "game", "currentOnly"],
  computed: {
    nextMove() {
      return this.move.id < this.game.moves.length - 1
        ? this.game.moves[this.move.id + 1]
        : null;
    },
    isCurrentMove() {
      return this.game.state.move.id === this.move.id;
    },
    linebreak() {
      return (
        this.$store.state.showAllBranches &&
        this.nextMove &&
        this.nextMove.linenum.branch != this.move.linenum.branch
      );
    }
  }
};
</script>

<style lang="stylus">
.move
  line-height 2em

  &.current-move
    background-color $highlight

  .move-wrapper
    padding-left 1em
    text-indent -1em

  &.current-only .linenum .branch
    background-color transparent

  &.linebreak
    margin-bottom 1.5em
</style>
