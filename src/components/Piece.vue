<template>
  <div
    class="piece"
    :style="{
      transform: `translate3d(${x}%, -${y}%, ${z}px)`
    }"
  >
    <div
      class="stone"
      :class="{
        ['p' + color]: true,
        [type]: true,
        S: state && state.isStanding,
        unplayed: !state,
        immovable
      }"
    />
  </div>
</template>

<script>
export default {
  name: "Piece",
  props: ["game", "color", "type", "index"],
  computed: {
    state() {
      return this.game.state.pieces[this.color][this.type][this.index];
    },
    immovable() {
      return this.state
        ? this.state.square.length - this.state.z > this.game.size
        : false;
    },
    x() {
      let x = 100;
      if (this.state) {
        x *= this.state.x;
      } else {
        x *= this.game.size + 0.75 * (this.color === 2);
      }
      return x;
    },
    y() {
      let y = 100;
      let spacing = this.game.size * 1.25;
      if (this.state) {
        y *= this.state.y;
        y += spacing * this.state.z;
        if (!this.$store.state.board3D) {
          if (
            this.state.square.length > this.game.size &&
            this.state.z >= this.state.square.length - this.game.size
          ) {
            y -= spacing * (this.state.square.length - this.game.size);
          }
          if (this.state.isStanding && this.state.square.length > 1) {
            y -= spacing;
          }
        }
      } else {
        y *= this.game.size - 1;
        if (this.type === "F") {
          y *=
            this.game.pieceCounts.total -
            this.index -
            this.game.pieceCounts.C -
            1;
        } else {
          y *= this.game.pieceCounts.total - this.index - 1;
        }
        y /= this.game.pieceCounts.total - 1;
      }
      return y;
    },
    z() {
      let z;
      if (this.state) {
        z = this.state.z;
      } else {
        z = this.game.pieceCounts.total - this.index;
        if (this.type === "C") {
          z += this.game.pieceCounts.F;
        }
        if (this.color === 2) {
          z += this.game.pieceCounts.total;
        }
      }
      return z;
    }
  }
};
</script>

<style lang="stylus">
.piece
  position absolute
  bottom 0
  left 0
  will-change transform, opacity
  transition all $generic-hover-transition

  .stone
    position absolute
    bottom 0
    left 0
    width 50%
    height 50%
    margin 25%
    box-sizing border-box
    border 1px solid rgba(#000, .8)
    border-radius 10%
    will-change transform, width, height, left, border-radius
    transition all $generic-hover-transition

    .board-container.piece-shadows &
      border-color transparent
      box-shadow $shadow-1

    &.p1
      background-color $blue-grey-2
      border-color $blue-grey-7
    &.p2
      background-color $blue-grey-7
      border-color $blue-grey-10

    &.S
      width 18.75%
      left 15%
      border-radius 27%/10%

      &.p1
        background-color $blue-grey-1
        transform rotate(-45deg)
        .board-container.piece-shadows &
          box-shadow -1px 1px 2px rgba(#000, .3)
      &.p2
        background-color $blue-grey-8
        transform rotate(45deg)
        .board-container.piece-shadows &
          box-shadow 1px 1px 2px rgba(#000, .3)
    &.C
      border-radius 50%
      &.p1
        background-color $blue-grey-1
      &.p2
        background-color $blue-grey-8

    .board-container:not(.board-3d) &.immovable
      bottom 0
      left 51%
      width 15%
      height 8%
      border-radius 15%/30%

    .board-container.board-3d &.immovable
      opacity 0.25

    .board-container:not(.unplayed-pieces) &.unplayed
      opacity 0
</style>
