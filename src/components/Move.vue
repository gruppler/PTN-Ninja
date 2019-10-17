<template>
  <div
    class="move"
    :class="{
      'current-move': isCurrentMove,
      linebreak,
      'current-only': currentOnly !== undefined
    }"
  >
    <div class="move-wrapper">
      <Linenum v-if="move.linenum" :linenum="move.linenum" :game="game" />
      <div class="plies">
        <template v-if="move.ply1 && (!player || player === 1)">
          <span
            v-if="
              move.ply1.isNop &&
                (!move.ply1Original ||
                  ($store.state.showAllBranches && currentOnly === undefined))
            "
            class="ptn nop"
          >
            {{ move.ply1.text() }}
          </span>
          <Ply
            v-else
            :plyID="(move.ply1Original || move.ply1).id"
            :game="game"
          />
        </template>
        <template v-if="move.ply2 && (!player || player === 2)">
          <span v-if="move.ply2.isNop" class="ptn nop">
            {{ move.ply2.text() }}
          </span>
          <Ply
            v-else
            :plyID="
              $store.state.showAllBranches && currentOnly === undefined
                ? move.ply2.id
                : move.ply2.getBranch(game.state.targetBranch).id
            "
            :game="game"
          />
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
  props: ["move", "game", "currentOnly", "player"],
  computed: {
    nextMove() {
      const moves = this.game.movesSorted;
      const index = moves.findIndex(move => move === this.move);
      return index < moves.length - 1 ? moves[index + 1] : null;
    },
    isCurrentMove() {
      return (
        this.currentOnly === undefined &&
        this.game.state.move &&
        this.game.state.move.id === this.move.id
      );
    },
    linebreak() {
      return (
        this.currentOnly === undefined &&
        this.$store.state.showAllBranches &&
        this.nextMove &&
        this.nextMove.branch != this.move.branch
      );
    },
    separator() {
      return (
        this.linebreak &&
        (!this.move.branch ||
          this.nextMove.branch.split(".")[0] !== this.move.branch.split(".")[0])
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
</style>
