<template>
  <div class="piece" :style="{ '--x': x, '--y': y, '--z': z }">
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
const SPACING = 7;

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
    isVertical() {
      return this.$store.state.ui.isVertical;
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
      let x;
      if (this.square) {
        // Played piece
        x = 100 * this.col;
      } else {
        // Unplayed piece
        return this.unplayedX;
      }
      return x + "%";
    },
    unplayedX() {
      let x;
      if (this.isVertical) {
        // Vertical Layout
        const buffer = 0.25;
        x = this.config.size / 2 - 0.5 - buffer;
        if (this.board3D) {
          // 3D
          if (!this.piece.isCapstone) {
            // TODO: Fix spacing

            // Calculate the group index for this piece type
            const groupIndex = Math.floor(
              (this.pieceCounts[this.piece.type] - this.piece.index - 1) /
                (this.config.size * 2)
            );

            // Calculate the group size (subtract 1 if there's a capstone and uneven flats)
            const groupSize = this.config.size;

            const hasCap =
              this.pieceCounts.cap && this.pieceCounts.flat % this.config.size;

            // Calculate the total number of groups for flat pieces
            const totalGroups =
              Math.floor(this.pieceCounts.flat / groupSize) - 1 - 1 * !hasCap;

            // Calculate the scaling factor for x position
            const scale = 1;

            // Scale x by the ratio of groupIndex to totalGroups and the scale factor
            x *= (groupIndex * scale) / totalGroups;
          }
        } else {
          // 2D
          if (this.piece.isCapstone) {
            x *= this.pieceCounts.total - this.piece.index - 1;
          } else {
            x *=
              this.pieceCounts.total -
              this.piece.index -
              this.pieceCounts.cap -
              1;
          }
          x /= this.pieceCounts.total - 1;
        }
        if (this.stackColor === 1) {
          x = this.config.size / 2 - x - 0.75 - buffer / 4;
        } else {
          x = this.config.size / 2 + x - 0.25 + buffer / 4;
        }
        x *= 100;
      } else {
        // Horizontal Layout
        x = 100 * this.config.size + 75 * (this.stackColor === 2);
      }
      return x + "%";
    },
    y() {
      let y;
      if (this.square) {
        // Played piece
        y = 100 * this.row;
        if (!this.board3D) {
          // 2D
          const pieces = this.square.pieces;
          y += SPACING * (this.piece.z + this.isSelected * SELECTED_GAP);
          if (
            pieces.length > this.config.size &&
            this.piece.z >= pieces.length - this.config.size
          ) {
            y -= SPACING * (pieces.length - this.config.size);
          }
          if (this.piece.isStanding && pieces.length > 1) {
            y -= SPACING;
          }
          if (this.piece.isImmovable) {
            y -= SPACING * this.overflow;
          }
        }
      } else {
        // Unplayed piece
        return this.unplayedY;
      }
      return -y + "%";
    },
    unplayedY() {
      let y;
      if (this.isVertical) {
        // Vertical Layout
        y = 100;
        if (!this.board3D && this.isSelected) {
          y -= SPACING * SELECTED_GAP;
        }
      } else {
        // Horizontal Layout
        y = 1 - this.config.size;
        if (this.board3D) {
          // 3D
          if (!this.piece.isCapstone) {
            // Calculate the group index for this piece type
            const groupIndex = Math.floor(
              (this.pieceCounts[this.piece.type] - this.piece.index - 1) /
                this.config.size
            );

            // Calculate the total number of groups for flat pieces
            const hasCap =
              this.pieceCounts.cap && this.pieceCounts.flat % this.config.size;
            const groupSize = this.config.size - (hasCap ? 1 : 0);
            const totalGroups = Math.floor(this.pieceCounts.flat / groupSize);

            // Scale y by the ratio of groupIndex to totalGroups
            y *= groupIndex / totalGroups;
          }
          y *= 100;
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
          y *= 100;
          if (this.isSelected) {
            y -= SPACING * SELECTED_GAP;
          }
        }
      }
      return y + "%";
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
        return this.unplayedZ;
      }
      return (z / 5 || 0.0001) + "em";
    },
    unplayedZ() {
      let z;
      if (this.board3D) {
        // 3D
        if (this.isVertical) {
          // Vertical Layout
          z =
            (this.pieceCounts[this.piece.type] - this.piece.index - 1) %
            (this.config.size * 2);
        } else {
          // Horizontal Layout
          z =
            (this.pieceCounts[this.piece.type] - this.piece.index - 1) %
            this.config.size;
        }
      } else {
        // 2D
        z =
          (this.pieceCounts.total - this.piece.index) / this.pieceCounts.total;
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
      return z / 5 + "em";
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
  will-change: transform;
  transform: translate3d(var(--x), var(--y), var(--z));
  transition-duration: $transition-duration;
  transition-timing-function: $transition-easing;
  transition-property: transform, opacity;

  .stone {
    --stroke-width: calc(var(--piece-border-width) * 0.013em);
    --shadow-y: calc(var(--stroke-width) / 2 + 0.02em);
    --shadow-blur: calc(var(--stroke-width) + 0.03em);
    --shadow-y-selected: 0.2em;
    --shadow-blur-selected: 0.1em;
    position: absolute;
    bottom: 0;
    left: 0;
    width: 50%;
    height: 50%;
    margin: 25%;
    box-sizing: border-box;
    border-width: var(--stroke-width);
    border-style: solid;
    border-radius: 10%;
    will-change: transform, box-shadow;
    transition-duration: $transition-duration;
    transition-timing-function: $transition-easing;
    transition-property: opacity, transform, width, height, left, border-radius,
      background-color, box-shadow;

    box-shadow: 0 var(--shadow-y) var(--shadow-blur) var(--q-color-umbra);
    &.firstSelected {
      box-shadow: 0 var(--shadow-y) var(--shadow-blur) var(--q-color-umbra),
        0 var(--shadow-y-selected) var(--shadow-blur-selected)
          var(--q-color-umbra);
    }

    &.p1 {
      background-color: var(--q-color-player1flat);
      border-color: var(--q-color-player1border);
    }
    &.p2 {
      background-color: var(--q-color-player2flat);
      border-color: var(--q-color-player2border);
    }

    &.S {
      width: 18.75%;
      left: 15%;
      border-radius: 27%/10%;

      &.p1 {
        background-color: var(--q-color-player1special);
        transform: rotate(-45deg);
        box-shadow: calc(var(--shadow-y) * -1) calc(var(--shadow-y))
          var(--shadow-blur) var(--q-color-umbra);
        &.firstSelected {
          box-shadow: calc(var(--shadow-y) * -1) calc(var(--shadow-y))
              var(--shadow-blur) var(--q-color-umbra),
            calc(var(--shadow-y-selected) * -1) calc(var(--shadow-y-selected))
              var(--shadow-blur-selected) var(--q-color-umbra);
        }
      }
      &.p2 {
        background-color: var(--q-color-player2special);
        transform: rotate(45deg);
        box-shadow: calc(var(--shadow-y) / 2) calc(var(--shadow-y) / 2)
          var(--shadow-blur) var(--q-color-umbra);
        &.firstSelected {
          box-shadow: calc(var(--shadow-y) / 2) calc(var(--shadow-y) / 2)
              var(--shadow-blur) var(--q-color-umbra),
            calc(var(--shadow-y-selected)) calc(var(--shadow-y-selected))
              var(--shadow-blur-selected) var(--q-color-umbra);
        }
      }
    }
    &.C {
      border-radius: 50%;
      &.p1 {
        background-color: var(--q-color-player1special);
      }
      &.p2 {
        background-color: var(--q-color-player2special);
      }
    }

    .board-space:not(.board-3D) &.immovable {
      bottom: 0;
      left: 50%;
      width: 15%;
      height: 8%;
      border-radius: 15%/30%;
    }

    .board-space.board-3D &.immovable {
      opacity: 0.35;
    }

    &.selectable {
      pointer-events: all;
      cursor: pointer;
    }

    &.unplayed {
      .board-container:not(.show-unplayed-pieces) & {
        pointer-events: none;
        opacity: 0;
      }
    }

    &.overflow {
      opacity: 0;
    }
  }
}
</style>
