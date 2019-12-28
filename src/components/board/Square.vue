<template>
  <div
    class="square"
    :class="{
      dark: x % 2 === y % 2,
      light: x % 2 !== y % 2,
      ['p' + color]: !!color,
      'no-roads': !showRoads,
      eog,
      current,
      selected,
      placed,
      valid,
      connected: n || e || s || w,
      n,
      e,
      s,
      w,
      road: !!road,
      rn,
      re,
      rs,
      rw
    }"
    @click.left="select()"
    @click.right.prevent="select(true)"
  >
    <div class="hl current" />
    <div class="road" v-if="showRoads">
      <div class="n" />
      <div class="e" />
      <div class="s" />
      <div class="w" />
      <div class="center" />
    </div>
    <div class="hl player" />
  </div>
</template>

<script>
import { last } from "lodash";

export default {
  name: "Square",
  props: ["game", "x", "y"],
  computed: {
    eog() {
      return this.game.state.isGameEnd;
    },
    isEditingTPS() {
      return this.$store.state.isEditingTPS;
    },
    selectedPiece() {
      return this.$store.state.selectedPiece;
    },
    editingTPS: {
      get() {
        return this.$store.state.editingTPS;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["editingTPS", value]);
      }
    },
    firstMoveNumber() {
      return this.$store.state.firstMoveNumber;
    },
    square() {
      return this.game.state.squares[this.y][this.x];
    },
    piece() {
      return last(this.square);
    },
    color() {
      return this.piece ? this.piece.color : "";
    },
    current() {
      return (
        this.game.state.ply &&
        this.game.state.ply.squares.includes(this.square.coord)
      );
    },
    selected() {
      return this.game.state.selected.squares.includes(this.square);
    },
    placed() {
      return (
        this.piece &&
        this.piece.ply &&
        this.piece.ply === this.game.state.ply &&
        !this.game.state.isFirstMove
      );
    },
    valid() {
      return this.isEditingTPS || this.game.isValidSquare(this.square);
    },
    showRoads() {
      return !this.game.config.disableRoads && this.$store.state.showRoads;
    },
    roads() {
      return this.color &&
        this.game.state.ply &&
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
  },
  methods: {
    select(alt = false) {
      if (this.valid) {
        if (alt && this.isEditingTPS && this.piece) {
          this.$store.dispatch("SET_UI", [
            "selectedPiece",
            { color: this.piece.color, type: this.piece.typeCode }
          ]);
        }
        this.game.selectSquare(
          this.square,
          alt,
          this.isEditingTPS,
          this.selectedPiece
        );
        if (this.isEditingTPS) {
          this.editingTPS = this.game.state.getTPS(
            this.selectedPiece.color,
            this.firstMoveNumber
          );
        }
      }
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

  .hl.current
    background $accent
  .board-container.highlight-squares &.current .hl.current
    opacity .75;

  .board-container.turn-1 &
    .hl.player
      background-color $blue-grey-2
    &.placed:not(.eog) .hl.player
      background-color $blue-grey-8
  .board-container.turn-2 &
    .hl.player
      background-color $blue-grey-8
    &.placed:not(.eog) .hl.player
      background-color $blue-grey-2
  &.selected .hl.player
    opacity .5
  &.no-roads.road .hl.player
    opacity .25
  @media (pointer: fine)
    &.valid:hover .hl.player
      opacity .35
      cursor pointer

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
      transition opacity $two-thirds-time $easing-reverse,
        background-color $two-thirds-time $easing-reverse,
        top $half-time $easing-reverse,
        bottom $half-time $easing-reverse,
        left $half-time $easing-reverse,
        right $half-time $easing-reverse
      &.center
        top 35%
        bottom 35%
        left 35%
        right 35%
      &.n, &.s
        left 35%
        right 35%
      &.e, &.w
        top 35%
        bottom 35%
      &.n
        top 35%
        bottom 65%
      &.s
        top 65%
        bottom 35%
      &.e
        left 65%
        right 35%
      &.w
        left 35%
        right 65%
  &.n .road .n
    top 0
  &.s .road .s
    bottom 0
  &.e .road .e
    right 0
  &.w .road .w
    left 0
  &.connected .road .center,
  &.n .road .n,
  &.e .road .e,
  &.s .road .s,
  &.w .road .w
    opacity .2
    transition opacity $two-thirds-time $easing $one-third-time,
      background-color $two-thirds-time $easing $one-third-time,
      top $half-time $easing $half-time,
      bottom $half-time $easing $half-time,
      left $half-time $easing $half-time,
      right $half-time $easing $half-time
  &.road .road .center,
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
