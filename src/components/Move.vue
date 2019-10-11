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
      <span class="text-no-wrap">
        <template v-if="move.ply1">
          <span
            v-if="
              move.ply1.isNop &&
                (!move.ply1Original ||
                  ($store.state.showAllBranches && currentOnly === undefined))
            "
            class="nop"
          >
            {{ move.ply1.text() }}
          </span>
          <Ply
            v-else
            :plyID="(move.ply1Original || move.ply1).id"
            :game="game"
          />
        </template>
        <template v-if="move.ply2">
          <span v-if="move.ply2.isNop" class="nop">
            {{ move.ply2.text() }}
          </span>
          <Ply
            v-else
            :plyID="move.ply2.getBranch(game.state.targetBranch).id"
            :game="game"
          />
        </template>
      </span>
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
      const moves = this.game.movesSorted;
      const index = moves.findIndex(move => move === this.move);
      return index < moves.length - 1 ? moves[index + 1] : null;
    },
    isCurrentMove() {
      return this.game.state.move && this.game.state.move.id === this.move.id;
    },
    linebreak() {
      return (
        this.$store.state.showAllBranches &&
        this.nextMove &&
        this.nextMove.branch != this.move.branch
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
