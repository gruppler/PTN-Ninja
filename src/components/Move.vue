<template>
  <div
    class="ptn move q-px-md"
    :class="{
      'current-branch': isCurrentBranch,
      'current-move': isCurrentMove,
      linebreak
    }"
  >
    <div class="move-wrapper">
      <Linenum v-if="move.linenum" :linenum="move.linenum" :game="game" />
      <Ply v-if="move.ply1" :ply="move.ply1" :game="game" />
      <Ply v-if="move.ply2" :ply="move.ply2" :game="game" />
    </div>
  </div>
</template>

<script>
import Linenum from "./Linenum";
import Ply from "./Ply";

export default {
  name: "Move",
  components: { Linenum, Ply },
  props: ["move", "game"],
  computed: {
    nextMove() {
      return this.move.index < this.game.moves.length - 1
        ? this.game.moves[this.move.index + 1]
        : null;
    },
    isCurrentMove() {
      return this.game.state.move.id === this.move.id;
    },
    isCurrentBranch() {
      return this.game.state.branch.startsWith(this.move.linenum.branch);
    },
    linebreak() {
      return (
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

  &.linebreak
    margin-bottom 1.5em
</style>
