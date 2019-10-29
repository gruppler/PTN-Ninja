<template>
  <div
    class="piece"
    :style="{
      transform: `translate3d(${x}%, -${y}%, ${z}em)`
    }"
  >
    <div
      class="stone"
      :class="{
        ['p' + color]: true,
        C: type === 'cap',
        S: piece && piece.isStanding,
        unplayed: !piece,
        firstSelected,
        immovable
      }"
    />
  </div>
</template>

<script>
const SELECTED_GAP = 3;

export default {
  name: "Piece",
  props: ["game", "color", "type", "index"],
  computed: {
    piece() {
      return this.game.state.pieces[this.color][this.type][this.index];
    },
    immovable() {
      return this.piece ? this.piece.isImmovable : false;
    },
    firstSelected() {
      return this.piece && this.piece === this.game.state.selected.pieces[0];
    },
    board3D() {
      return this.$store.state.board3D;
    },
    x() {
      let x = 100;
      if (this.piece) {
        x *= this.piece.x;
      } else {
        x *= this.game.size + 0.75 * (this.color === 2);
      }
      return x;
    },
    y() {
      let y = 100;
      let spacing = 7;
      if (this.piece) {
        y *= this.piece.y;
        if (!this.board3D) {
          y += spacing * (this.piece.z + this.piece.isSelected * SELECTED_GAP);
          if (
            this.piece.square.length > this.game.size &&
            this.piece.z >= this.piece.square.length - this.game.size
          ) {
            y -= spacing * (this.piece.square.length - this.game.size);
          }
          if (this.piece.isStanding && this.piece.square.length > 1) {
            y -= spacing;
          }
        }
      } else {
        // Unplayed piece
        y = this.game.size - 1;
        if (this.board3D) {
          if (this.type !== "cap") {
            y *=
              Math.floor(
                (this.game.pieceCounts[this.type] - this.index - 1) /
                  this.game.size
              ) /
              Math.floor(
                this.game.pieceCounts.flat /
                  (this.game.size -
                    1 *
                      !!(
                        this.game.pieceCounts.cap &&
                        this.game.pieceCounts.flat % this.game.size
                      ))
              );
          }
        } else {
          if (this.type === "cap") {
            y *= this.game.pieceCounts.total - this.index - 1;
          } else {
            y *=
              this.game.pieceCounts.total -
              this.index -
              this.game.pieceCounts.cap -
              1;
          }
          y /= this.game.pieceCounts.total - 1;
        }
        y *= 100;
      }
      return y;
    },
    z() {
      let z;
      if (this.piece) {
        z = this.piece.z + this.piece.isSelected * SELECTED_GAP;
      } else {
        // Unplayed piece
        if (this.board3D) {
          z =
            ((this.game.pieceCounts[this.type] - this.index - 1) %
              this.game.size) +
            1;
        } else {
          z = this.game.pieceCounts.total - this.index;
          if (this.type === "cap") {
            z += this.game.pieceCounts.flat;
          }
          if (this.color === 2) {
            z += this.game.pieceCounts.total;
          }
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
  transition transform $generic-hover-transition,
    opacity $generic-hover-transition

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
    will-change opacity, transform, width, height, left, border-radius, background-color, box-shadow
    transition opacity $generic-hover-transition,
      transform $generic-hover-transition,
      width $generic-hover-transition,
      height $generic-hover-transition,
      left $generic-hover-transition,
      border-radius $generic-hover-transition,
      background-color $generic-hover-transition,
      box-shadow $generic-hover-transition

    .board-container.piece-shadows &
      border-color transparent
      box-shadow $shadow-1
      &.firstSelected
        box-shadow @box-shadow, 0 2.8vmin 1.5vmin $elevation-umbra

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
          &.firstSelected
            box-shadow @box-shadow, -1.8vmin 1.8vmin 1.5vmin $elevation-umbra
      &.p2
        background-color $blue-grey-8
        transform rotate(45deg)
        .board-container.piece-shadows &
          box-shadow 1px 1px 2px rgba(#000, .3)
          &.firstSelected
            box-shadow @box-shadow, 1.8vmin 1.8vmin 1.5vmin $elevation-umbra
    &.C
      border-radius 50%
      &.p1
        background-color $blue-grey-1
      &.p2
        background-color $blue-grey-8

    .board-wrapper:not(.board-3D) &.immovable
      bottom 0
      left 51%
      width 15%
      height 8%
      border-radius 15%/30%

    .board-wrapper.board-3D &.immovable
      opacity 0.25

    .board-container:not(.unplayed-pieces) &.unplayed
      opacity 0
</style>
