<template>
  <div
    class="square"
    :class="{
      dark: x % 2 === y % 2,
      light: x % 2 !== y % 2,
      ['p' + color]: !!color,
      'no-roads': !$store.state.showRoads,
      road: !!road,
      selected,
      valid,
      n,
      e,
      s,
      w,
      rn,
      re,
      rs,
      rw
    }"
  >
    <div class="hl selected" />
    <div class="road" v-if="$store.state.showRoads">
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
  props: ["game", "x", "y"],
  computed: {
    square() {
      return this.game.state.squares[this.y][this.x];
    },
    piece() {
      return last(this.square);
    },
    color() {
      return this.piece ? this.piece.color : "";
    },
    selected() {
      return (
        this.game.state.ply &&
        this.game.state.ply.squares.includes(this.square.coord)
      );
    },
    valid() {
      return !this.piece || this.color === this.game.state.player;
    },
    roads() {
      return this.color &&
        this.game.state.plyIsDone &&
        this.game.state.ply.result
        ? this.game.state.ply.result.roads
        : null;
    },
    road() {
      if (this.roads) {
        let roads = this.roads[this.color].filter(road =>
          road.squares.includes(this.square.coord)
        );
        if (roads.length > 1) {
          return {
            squares: this.roads.squares[this.color],
            edges: this.roads.edges[this.color]
          };
        } else {
          return roads[0] || null;
        }
      } else {
        return null;
      }
    },
    n() {
      if (this.color && !this.piece.isStanding) {
        if (this.square.edges.N) {
          return true;
        } else {
          const neighbor = last(this.square.neighbors.N);
          return (
            neighbor && !neighbor.isStanding && neighbor.color === this.color
          );
        }
      }
      return false;
    },
    s() {
      if (this.color && !this.piece.isStanding) {
        if (this.square.edges.S) {
          return true;
        } else {
          const neighbor = last(this.square.neighbors.S);
          return (
            neighbor && !neighbor.isStanding && neighbor.color === this.color
          );
        }
      }
      return false;
    },
    e() {
      if (this.color && !this.piece.isStanding) {
        if (this.square.edges.E) {
          return true;
        } else {
          const neighbor = last(this.square.neighbors.E);
          return (
            neighbor && !neighbor.isStanding && neighbor.color === this.color
          );
        }
      }
      return false;
    },
    w() {
      if (this.color && !this.piece.isStanding) {
        if (this.square.edges.W) {
          return true;
        } else {
          const neighbor = last(this.square.neighbors.W);
          return (
            neighbor && !neighbor.isStanding && neighbor.color === this.color
          );
        }
      }
      return false;
    },
    rn() {
      return (
        this.road &&
        ((this.road.edges.NS && this.square.edges.N) ||
          (this.square.neighbors.N &&
            this.road.squares.includes(this.square.neighbors.N.coord)))
      );
    },
    rs() {
      return (
        this.road &&
        ((this.road.edges.NS && this.square.edges.S) ||
          (this.square.neighbors.S &&
            this.road.squares.includes(this.square.neighbors.S.coord)))
      );
    },
    re() {
      return (
        this.road &&
        ((this.road.edges.EW && this.square.edges.E) ||
          (this.square.neighbors.E &&
            this.road.squares.includes(this.square.neighbors.E.coord)))
      );
    },
    rw() {
      return (
        this.road &&
        ((this.road.edges.EW && this.square.edges.W) ||
          (this.square.neighbors.W &&
            this.road.squares.includes(this.square.neighbors.W.coord)))
      );
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
  &.no-roads.road .hl.hover
    opacity .25

  .road
    position absolute
    top 0
    bottom 0
    left 0
    right 0
    pointer-events none
    > div
      opacity 0
      position absolute
      will-change opacity, top, bottom, left, right
      transition opacity $time linear,
        background-color $time linear,
        top $time $easing,
        bottom $time $easing,
        left $time $easing,
        right $time $easing
      &.n, &.s
        left 35%
        right 35%
      &.e, &.w
        top 35%
        bottom 35%
      &.n
        top 35%
        bottom 70%
      &.s
        top 70%
        bottom 35%
      &.e
        left 70%
        right 35%
      &.w
        left 35%
        right 70%
  &.n .road .n
    top 0
  &.s .road .s
    bottom 0
  &.e .road .e
    right 0
  &.w .road .w
    left 0
  &.n .road .n,
  &.e .road .e,
  &.s .road .s,
  &.w .road .w
    opacity .2
    transition opacity $time linear,
      background-color $time linear,
      top $half-time $easing $half-time,
      bottom $half-time $easing $half-time,
      left $half-time $easing $half-time,
      right $half-time $easing $half-time
  &.rn .road .n,
  &.re .road .e,
  &.rs .road .s,
  &.rw .road .w
    opacity 0.8
  &.p1 .road > div
    background-color $blue-grey-2
  &.p2 .road > div
    background-color $blue-grey-8
</style>
