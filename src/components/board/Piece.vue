<template>
  <div class="piece" :style="{ transform: CSSTransform }">
    <div
      @click.left="select()"
      @click.right.prevent="select(true)"
      ref="stone"
      class="stone"
      :class="{
        ['p' + piece.color]: true,
        C: piece.isCapstone,
        S: piece.isStanding,
        overflow: piece.z < overflow,
        unplayed: !square,
        firstSelected,
        immovable,
        selectable,
      }"
    />
  </div>
</template>

<script>
const SELECTED_GAP = 3;

export default {
  name: "Piece",
  props: ["id"],
  computed: {
    theme() {
      return this.$store.getters["ui/theme"]();
    },
    game() {
      return this.$store.state.game;
    },
    board() {
      return this.game.board;
    },
    config() {
      return this.game.config;
    },
    stackColor() {
      if (
        this.config.openingSwap &&
        this.piece.index === 0 &&
        this.piece.type !== "cap"
      ) {
        return this.piece.color === 1 ? 2 : 1;
      }
      return this.piece.color;
    },
    pieceCounts() {
      return this.config.pieceCounts[this.stackColor];
    },
    piece() {
      return this.board.pieces[this.id];
    },
    square() {
      return this.piece.square ? this.board.squares[this.piece.square] : null;
    },
    immovable() {
      return this.square ? this.piece.isImmovable : false;
    },
    selectable() {
      return (
        !this.square &&
        !this.$store.state.ui.disableBoard &&
        (this.$store.state.game.editingTPS !== undefined ||
          this.piece.color ===
            this.game.position[
              this.piece.index || this.piece.isCapstone ? "turn" : "color"
            ])
      );
    },
    overflow() {
      return this.square
        ? Math.max(0, this.square.pieces.length - 10 - this.config.size)
        : 0;
    },
    isSelected() {
      return this.piece.isSelected;
    },
    firstSelected() {
      return (
        this.isSelected && this.piece.id === this.game.selected.pieces[0].id
      );
    },
    board3D() {
      return this.$store.state.ui.board3D;
    },
    transform() {
      return this.$store.state.ui.boardTransform;
    },
    row() {
      if (!this.square) {
        return null;
      }
      let row = this.piece[this.transform[0] % 2 ? "x" : "y"];
      if (this.transform[0] === 1 || this.transform[0] === 2) {
        row = this.config.size - row - 1;
      }
      return row;
    },
    col() {
      if (!this.square) {
        return null;
      }
      let col = this.piece[this.transform[0] % 2 ? "y" : "x"];
      let rotation = (this.transform[0] + 2 * this.transform[1]) % 4;
      if (rotation === 2 || rotation === 3) {
        col = this.config.size - col - 1;
      }
      return col;
    },
    x() {
      let x = 100;
      if (this.square) {
        x *= this.col;
      } else {
        x *= this.config.size + 0.75 * (this.stackColor === 2);
      }
      return x;
    },
    y() {
      let y = 100;
      let spacing = 7;
      if (this.square) {
        // Played piece
        y *= this.row;
        if (!this.board3D) {
          // 2D
          const pieces = this.square.pieces;
          y += spacing * (this.piece.z + this.isSelected * SELECTED_GAP);
          if (
            pieces.length > this.config.size &&
            this.piece.z >= pieces.length - this.config.size
          ) {
            y -= spacing * (pieces.length - this.config.size);
          }
          if (this.piece.isStanding && pieces.length > 1) {
            y -= spacing;
          }
          if (this.piece.isImmovable) {
            y -= spacing * this.overflow;
          }
        }
      } else {
        // Unplayed piece
        y = this.config.size - 1;
        if (this.board3D) {
          // 3D
          if (!this.piece.isCapstone) {
            y *=
              Math.floor(
                (this.pieceCounts[this.piece.type] - this.piece.index - 1) /
                  this.config.size
              ) /
              Math.floor(
                this.pieceCounts.flat /
                  (this.config.size -
                    1 *
                      !!(
                        this.pieceCounts.cap &&
                        this.pieceCounts.flat % this.config.size
                      ))
              );
          }
        } else {
          // 2D
          if (this.piece.isCapstone) {
            y *= this.pieceCounts.total - this.piece.index - 1;
          } else {
            y *=
              this.pieceCounts.total -
              this.piece.index -
              this.pieceCounts.cap -
              1;
          }
          y /= this.pieceCounts.total - 1;
          if (this.isSelected) {
            y += (spacing * SELECTED_GAP) / 100;
          }
        }
        y *= 100;
      }
      return y;
    },
    z() {
      let z;
      if (this.square) {
        z = this.piece.z + this.isSelected * SELECTED_GAP;
        if (!this.board3D) {
          // 2D
          if (this.piece.isImmovable) {
            z -= this.overflow;
          }
        }
      } else {
        // Unplayed piece
        if (this.board3D) {
          // 3D
          z =
            (this.pieceCounts[this.piece.type] - this.piece.index - 1) %
            this.config.size;
        } else {
          // 2D
          z =
            (this.pieceCounts.total - this.piece.index) /
            this.pieceCounts.total;
          if (this.piece.type !== "cap") {
            z -= this.pieceCounts.cap;
          }
          if (this.stackColor === 1) {
            z += 1;
          } else {
            z += this.config.size - 1;
          }
        }
        if (this.isSelected) {
          z += SELECTED_GAP;
        }
      }
      return z || 0.001;
    },
    CSSTransform() {
      return `translate3d(${this.x}%, -${this.y}%, ${this.z}em)`;
    },
  },
  methods: {
    select(alt = false) {
      if (this.$store.state.game.editingTPS !== undefined) {
        let type = this.piece.typeCode;
        if (alt && !this.piece.isCapstone) {
          type = "S";
        }
        this.$store.dispatch("ui/SET_UI", [
          "selectedPiece",
          { color: this.piece.color, type },
        ]);
      } else {
        this.$store.dispatch("game/SELECT_PIECE", {
          type: this.piece.type,
          alt: alt || this.isSelected,
        });
      }
    },
  },
};
</script>

<style lang="scss">
.piece {
  position: absolute;
  bottom: 0;
  left: 0;
  will-change: transform, opacity;
  transition: transform $generic-hover-transition,
    opacity $generic-hover-transition;

  .stone {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 50%;
    height: 50%;
    margin: 25%;
    box-sizing: border-box;
    border-width: ($piece-border-width * 0.15vmin);
    border-width: calc(var(--piece-border-width) * 0.15vmin);
    border-style: solid;
    border-radius: 10%;
    will-change: opacity, transform, width, height, left, border-radius,
      background-color, box-shadow;
    transition: opacity $generic-hover-transition,
      transform $generic-hover-transition, width $generic-hover-transition,
      height $generic-hover-transition, left $generic-hover-transition,
      border-radius $generic-hover-transition,
      background-color $generic-hover-transition,
      box-shadow $generic-hover-transition;

    box-shadow: 0 0.2vmin 0.4vmin $umbra;
    box-shadow: 0 0.2vmin 0.4vmin var(--q-color-umbra);
    &.firstSelected {
      box-shadow: 0 0.2vmin 0.4vmin $umbra, 0 2.8vmin 1.5vmin $umbra;
      box-shadow: 0 0.2vmin 0.4vmin var(--q-color-umbra),
        0 2.8vmin 1.5vmin var(--q-color-umbra);
    }

    &.p1 {
      background-color: $player1flat;
      background-color: var(--q-color-player1flat);
      border-color: $player1border;
      border-color: var(--q-color-player1border);
    }
    &.p2 {
      background-color: $player2flat;
      background-color: var(--q-color-player2flat);
      border-color: $player2border;
      border-color: var(--q-color-player2border);
    }

    &.S {
      width: 18.75%;
      left: 15%;
      border-radius: 27%/10%;

      &.p1 {
        background-color: $player1special;
        background-color: var(--q-color-player1special);
        transform: rotate(-45deg);
        box-shadow: -1px 1px 2px $umbra;
        box-shadow: -1px 1px 2px var(--q-color-umbra);
        &.firstSelected {
          box-shadow: -1px 1px 2px $umbra, -1.8vmin 1.8vmin 1.5vmin $umbra;
          box-shadow: -1px 1px 2px var(--q-color-umbra),
            -1.8vmin 1.8vmin 1.5vmin var(--q-color-umbra);
        }
      }
      &.p2 {
        background-color: $player2special;
        background-color: var(--q-color-player2special);
        transform: rotate(45deg);
        box-shadow: 1px 1px 2px $umbra;
        box-shadow: 1px 1px 2px var(--q-color-umbra);
        &.firstSelected {
          box-shadow: 1px 1px 2px $umbra, 1.8vmin 1.8vmin 1.5vmin $umbra;
          box-shadow: 1px 1px 2px var(--q-color-umbra),
            1.8vmin 1.8vmin 1.5vmin var(--q-color-umbra);
        }
      }
    }
    &.C {
      border-radius: 50%;
      &.p1 {
        background-color: $player1special;
        background-color: var(--q-color-player1special);
      }
      &.p2 {
        background-color: $player2special;
        background-color: var(--q-color-player2special);
      }
    }

    .board-wrapper:not(.board-3D) &.immovable {
      bottom: 0;
      left: 50%;
      width: 15%;
      height: 8%;
      border-radius: 15%/30%;
    }

    .board-wrapper.board-3D &.immovable {
      opacity: 0.35;
    }

    &.selectable {
      pointer-events: all;
      cursor: pointer;
    }

    &.unplayed {
      .board-container:not(.show-unplayed-pieces) & {
        opacity: 0;
      }
    }

    &.overflow {
      opacity: 0;
    }
  }
}
</style>
