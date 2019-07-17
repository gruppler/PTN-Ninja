<template>
  <div
    class="square"
    :class="{
      dark: x % 2 === y % 2,
      light: x % 2 !== y % 2,
      ['p' + color]: !!color,
      selected,
      valid,
      n,
      e,
      s,
      w
    }"
  >
    <div class="hl selected" />
    <div class="road">
      <div class="n" />
      <div class="e" />
      <div class="s" />
      <div class="w" />
    </div>
    <div class="hl hover" />
  </div>
</template>

<script>
import { last } from "lodash";

export default {
  name: "Square",
  props: ["game", "id"],
  computed: {
    x() {
      return "abcdefgh".indexOf(this.id[0]);
    },
    y() {
      return parseInt(this.id[1], 10) - 1;
    },
    state() {
      return this.game.state.squares[this.y][this.x];
    },
    piece() {
      return this.state.length ? last(this.state) : null;
    },
    color() {
      return this.piece ? this.piece.color : "";
    },
    selected() {
      return (
        this.game.state.ply && this.game.state.ply.squares.includes(this.id)
      );
    },
    valid() {
      return !this.piece || this.color === this.game.state.player;
    },
    n() {
      if (this.color && !this.piece.isStanding) {
        if (this.y === this.game.size - 1) {
          return true;
        } else {
          const neighbor = last(this.game.state.squares[this.y + 1][this.x]);
          return (
            neighbor && !neighbor.isStanding && neighbor.color === this.color
          );
        }
      }
      return false;
    },
    e() {
      if (this.color && !this.piece.isStanding) {
        if (this.x === this.game.size - 1) {
          return true;
        } else {
          const neighbor = last(this.game.state.squares[this.y][this.x + 1]);
          return (
            neighbor && !neighbor.isStanding && neighbor.color === this.color
          );
        }
      }
      return false;
    },
    s() {
      if (this.color && !this.piece.isStanding) {
        if (this.y === 0) {
          return true;
        } else {
          const neighbor = last(this.game.state.squares[this.y - 1][this.x]);
          return (
            neighbor && !neighbor.isStanding && neighbor.color === this.color
          );
        }
      }
      return false;
    },
    w() {
      if (this.color && !this.piece.isStanding) {
        if (this.x === 0) {
          return true;
        } else {
          const neighbor = last(this.game.state.squares[this.y][this.x - 1]);
          return (
            neighbor && !neighbor.isStanding && neighbor.color === this.color
          );
        }
      }
      return false;
    }
  }
};
</script>

<style lang="stylus">
.square
  position relative
  &.light
    background $blue-grey-4

  .hl
    position absolute
    top 0
    bottom 0
    left 0
    right 0
    opacity 0

  .hl.selected
    background $accent
  .board-container.highlight-squares &.selected .hl.selected
    opacity .75;

  .board-container.turn-1 &.valid .hl.hover
    background-color $blue-grey-2
  .board-container.turn-2 &.valid .hl.hover
    background-color $blue-grey-8
  &.valid:hover .hl.hover
    opacity .35
    cursor pointer

  .road
    position absolute
    top 0
    bottom 0
    left 0
    right 0
    opacity .25
    pointer-events none
    > div
      opacity 0
      position absolute
      top 50%
      bottom 50%
      left 50%
      right 50%
      will-change opacity, top, bottom, left, right
      transition background-color $time linear,
        opacity $half-time linear,
        top $half-time $easing,
        bottom $half-time $easing,
        left $half-time $easing,
        right $half-time $easing
      &.n
        top 0
      &.e
        right 0
      &.s
        bottom 0
      &.w
        left 0
  &.n .road .n,
  &.s .road .s
    opacity 1
    left 35%
    right 35%
  &.e .road .e,
  &.w .road .w
    opacity 1
    top 35%
    bottom 35%
  &.n .road .n,
  &.e .road .e,
  &.s .road .s,
  &.w .road .w
    transition background-color $time linear,
      opacity $half-time linear $half-time,
      top $half-time $easing $half-time,
      bottom $half-time $easing $half-time,
      left $half-time $easing $half-time,
      right $half-time $easing $half-time
  &.p1 .road > div
    background-color $blue-grey-2
  &.p2 .road > div
    background-color $blue-grey-8
</style>
