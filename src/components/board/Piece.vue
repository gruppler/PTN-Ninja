<template>
  <div
    class="piece"
    :style="{ '--x': x, '--y': y, '--z': z, zIndex: board3D ? null : zIndex }"
  >
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
        ply: isPlyPiece,
        'instant-radius': instantRadius,
      }"
    />
    <div
      v-if="isPlyPiece"
      class="stone ring"
      :class="{
        ['p' + piece.color]: true,
        C: piece.isCapstone,
        S: piece.isStanding,
      }"
    />
    <span
      v-if="stackCount && useCenterStackCounts"
      class="stack-count"
      :style="{ color: stackCountTextColor }"
    >
      {{ stackCount }}
    </span>
  </div>
</template>

<script>
import { last } from "lodash";

const SELECTED_GAP = 3;
const SPACING = 7;

export default {
  name: "Piece",
  props: ["id"],
  data() {
    return {
      instantRadius: false,
    };
  },
  computed: {
    game() {
      return this.$store.state.game || {};
    },
    board() {
      return this.game.board;
    },
    config() {
      return this.game.config || {};
    },
    stackColor() {
      if (this.config.openingSwap && this.piece.type !== "cap") {
        if (this.id === "1f1" || this.id === "2f1") {
          return this.piece.color === 1 ? 2 : 1;
        }
        if (this.config.openingDoubleBlackStack && this.id === "2f2") {
          return 1;
        }
      }
      return this.piece.color;
    },
    stackIndex() {
      if (this.config.openingDoubleBlackStack && this.piece.type !== "cap") {
        if (this.piece.color === 1 && this.stackColor === 1) {
          // Shift white's own pieces up by 1 to make room for the 2 DBS pieces
          // (index 0 became stackColor 2, so index 1 is the first here, offset to 2)
          return this.piece.index + 1;
        }
        if (this.piece.color === 2 && this.stackColor === 2) {
          // Shift black's remaining pieces up by 1 to leave a gap of 2
          // after the swap piece at position 0
          return this.piece.index + 1;
        }
      }
      return this.piece.index;
    },
    pieceCounts() {
      return this.config.pieceCounts[this.stackColor];
    },
    dbsExtra() {
      // In DBS mode, own-color pieces are shifted by +1 in stackIndex,
      // so the maximum stackIndex reaches total (instead of total - 1).
      // Adding +1 to numerator and denominator rescales positions so that
      // the bottom piece sits at the baseline without overflow.
      return this.config.openingDoubleBlackStack ? 1 : 0;
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
    // Whether this piece belongs to the current ply, when those are being
    // highlighted. Each such piece wears a ring of its own, on top of it.
    isPlyPiece() {
      if (!this.square || !this.$store.state.ui.highlightPieces) {
        return false;
      }
      const count =
        this.$store.getters["game/plyPieceCounts"][this.piece.square] || 0;
      return this.piece.z >= this.square.pieces.length - count;
    },
    ringedShape() {
      return this.isPlyPiece + ":" + this.piece.isStanding;
    },
    stackCounts() {
      return this.$store.state.ui.stackCounts;
    },
    centerStackCounts() {
      return this.$store.state.ui.centerStackCounts;
    },
    useCenterStackCounts() {
      return (
        this.centerStackCounts ||
        (this.$store.state.ui.axisLabels &&
          this.$store.state.ui.axisLabelsSmall)
      );
    },
    disableStackCounts() {
      const disabled = this.$store.getters["game/disabledOptions"];
      return disabled && disabled.includes("stackCounts");
    },
    isTopPiece() {
      return this.square && this.piece.z === this.square.pieces.length - 1;
    },
    isSquareHovered() {
      return this.square && this.game.hoveredSquare === this.piece.square;
    },
    stackCount() {
      if (!this.square || this.disableStackCounts) return "";
      if (
        !this.stackCounts &&
        !this.square.isSelected &&
        !this.isSquareHovered
      ) {
        return "";
      }
      if (!this.isTopPiece) return "";
      // During a move, show the count of pieces still in hand
      const selectedSquares = this.game.selected.squares;
      if (
        this.square.isSelected &&
        selectedSquares.length > 0 &&
        this.piece.square === last(selectedSquares).static.coord
      ) {
        const moveset = this.game.selected.moveset;
        if (selectedSquares.length === 1) {
          // On the original square, show remaining count
          const picked = moveset[0] || 0;
          const dropped = moveset.slice(1).reduce((sum, n) => sum + n, 0);
          const remaining = picked - dropped;
          return remaining > 0 ? remaining : "";
        } else {
          // On a subsequent square, show the drop count for this square
          const dropCount = moveset[selectedSquares.length - 1];
          return dropCount > 0 ? dropCount : "";
        }
      }
      const count = this.square.pieces.length;
      return count > 1 ? count : "";
    },
    stackCountTextColor() {
      const theme = this.$store.state.ui.theme || {};
      const isSpecialPiece = this.piece.isCapstone || this.piece.isStanding;
      const darknessKey = `player${this.piece.color}${
        isSpecialPiece ? "Special" : "Flat"
      }Dark`;
      return theme[darknessKey]
        ? "var(--q-color-textLight)"
        : "var(--q-color-textDark)";
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
        const spacing = -0.125;
        x = this.config.size / 2 - 1 - spacing;
        if (this.board3D) {
          // 3D
          if (!this.piece.isCapstone) {
            // Calculate the group index for this piece type
            const groupIndex = Math.floor(
              (this.pieceCounts[this.piece.type] -
                this.stackIndex -
                1 +
                this.dbsExtra) /
                (this.config.size * 2)
            );

            // Calculate the total number of groups for flat pieces
            const hasCap = this.pieceCounts.cap;
            const groupSize = this.config.size * 2;
            const totalGroups =
              Math.ceil((this.pieceCounts.flat + this.dbsExtra) / groupSize) -
              1 * !hasCap;

            // Scale x by the ratio of groupIndex to totalGroups and the scale factor
            x *= groupIndex / totalGroups;
          }
        } else {
          // 2D
          if (this.piece.isCapstone) {
            x *= this.pieceCounts.total - this.stackIndex - 1 + this.dbsExtra;
          } else {
            x *=
              this.pieceCounts.total -
              this.stackIndex -
              this.pieceCounts.cap -
              1 +
              this.dbsExtra;
          }
          x /= this.pieceCounts.total - 1 + this.dbsExtra;
        }
        if (this.stackColor === 1) {
          x = this.config.size / 2 - 1 - x - spacing;
        } else {
          x = this.config.size / 2 + x + spacing;
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
          y += this.stackOffset(this.piece);
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
              (this.pieceCounts[this.piece.type] -
                this.stackIndex -
                1 +
                this.dbsExtra) /
                this.config.size
            );

            // Calculate the total number of groups for flat pieces
            const hasCap = this.pieceCounts.cap;
            const groupSize = this.config.size;
            const totalGroups =
              Math.ceil((this.pieceCounts.flat + this.dbsExtra) / groupSize) -
              1 * !hasCap;

            // Scale y by the ratio of groupIndex to totalGroups
            y *= groupIndex / totalGroups;
          }
          y *= 100;
        } else {
          // 2D
          if (this.piece.isCapstone) {
            y *= this.pieceCounts.total - this.stackIndex - 1 + this.dbsExtra;
          } else {
            y *=
              this.pieceCounts.total -
              this.stackIndex -
              this.pieceCounts.cap -
              1 +
              this.dbsExtra;
          }
          y /= this.pieceCounts.total - 1 + this.dbsExtra;
          y *= 100;
          if (this.isSelected) {
            y -= SPACING * SELECTED_GAP;
          }
        }
      }
      return y + "%";
    },
    // Depth in fifths of an em: the 3D board translates by it, and the 2D
    // board stacks pieces in the same order by z-index
    z() {
      return this.depth / 5 + "em";
    },
    zIndex() {
      return Math.round(this.depth * 1000) + 1000;
    },
    depth() {
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
      return z || 0.0005;
    },
    unplayedZ() {
      let z;
      if (this.board3D) {
        // 3D
        if (this.isVertical) {
          // Vertical Layout
          z =
            (this.pieceCounts[this.piece.type] -
              this.stackIndex -
              1 +
              this.dbsExtra) %
            (this.config.size * 2);
        } else {
          // Horizontal Layout
          z =
            (this.pieceCounts[this.piece.type] -
              this.stackIndex -
              1 +
              this.dbsExtra) %
            this.config.size;
        }
      } else {
        // 2D
        z = (this.pieceCounts.total - this.stackIndex) / this.pieceCounts.total;
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
      return z;
    },
  },
  watch: {
    // A piece takes the ring's corners while it wears one. Those come and go
    // at once, as the ring does, rather than easing like a wall flattening,
    // so the corners skip their transition unless the piece changes shape.
    ringedShape(shape, previous) {
      const [ringed, standing] = shape.split(":");
      const [wasRinged, wasStanding] = previous.split(":");
      if (ringed !== wasRinged && standing === wasStanding) {
        this.instantRadius = true;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            this.instantRadius = false;
          })
        );
      }
    },
  },
  methods: {
    // How far up its square the 2D board draws a piece of this piece's stack,
    // as a percentage of the square
    stackOffset(piece) {
      const pieces = this.square.pieces;
      let y = SPACING * (piece.z + piece.isSelected * SELECTED_GAP);
      if (
        pieces.length > this.config.size &&
        piece.z >= pieces.length - this.config.size
      ) {
        y -= SPACING * (pieces.length - this.config.size);
      }
      if (piece.isStanding && pieces.length > 1) {
        y -= SPACING;
      }
      if (piece.isImmovable) {
        y -= SPACING * this.overflow;
      }
      return y;
    },
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
// Registered so the stone's colors still animate, now that they're drawn as
// background layers rather than background-color and border-color
@property --stone-fill {
  syntax: "<color>";
  inherits: false;
  initial-value: transparent;
}
@property --stone-stroke {
  syntax: "<color>";
  inherits: false;
  initial-value: transparent;
}

.piece {
  position: absolute;
  bottom: 0;
  left: 0;
  will-change: transform;
  // A 2D translate except on the 3D board, which needs the height. Firefox
  // splits a 3D-transformed piece where its render tiles meet and snaps each
  // part on its own, so redrawing one tile (a square's highlight fading
  // nearby) left a 1px gap through the piece until the next full redraw.
  transform: translate(var(--x), var(--y));
  .board-space.board-3D & {
    transform: translate3d(var(--x), var(--y), var(--z));
  }
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
    // The outline is the border-box background showing through a transparent
    // border, under the fill clipped to the padding box. Firefox draws real
    // border corners separately from the edges, thinner than them on some
    // screens, so the fill shows at the corners.
    border-width: var(--stroke-width);
    border-style: solid;
    border-color: transparent;
    border-radius: 10%;
    background: linear-gradient(var(--stone-fill), var(--stone-fill))
        padding-box,
      linear-gradient(var(--stone-stroke), var(--stone-stroke)) border-box;
    will-change: transform, box-shadow;
    transition-duration: $transition-duration;
    transition-timing-function: $transition-easing;
    transition-property: opacity, transform, width, height, left, border-radius,
      --stone-fill, --stone-stroke, box-shadow;
    &.instant-radius {
      transition-property: opacity, transform, width, height, left, --stone-fill,
        --stone-stroke, box-shadow;
    }

    box-shadow: 0 var(--shadow-y) var(--shadow-blur) var(--q-color-umbra);
    &.firstSelected {
      box-shadow: 0 var(--shadow-y) var(--shadow-blur) var(--q-color-umbra),
        0 var(--shadow-y-selected) var(--shadow-blur-selected)
          var(--q-color-umbra);
    }

    &.p1 {
      --stone-fill: var(--q-color-player1flat);
      --stone-stroke: var(--q-color-player1border);
    }
    &.p2 {
      --stone-fill: var(--q-color-player2flat);
      --stone-stroke: var(--q-color-player2border);
    }

    &.S {
      width: 18.75%;
      left: 15%;
      border-radius: 27%/10%;

      --offset-factor: 0.78;
      &.p1 {
        --stone-fill: var(--q-color-player1special);
        transform: rotate(-45deg);
        box-shadow: calc(var(--shadow-y) * -1 * var(--offset-factor))
          calc(var(--shadow-y) * var(--offset-factor)) var(--shadow-blur)
          var(--q-color-umbra);
        &.firstSelected {
          box-shadow: calc(var(--shadow-y) * -1 * var(--offset-factor))
              calc(var(--shadow-y) * var(--offset-factor)) var(--shadow-blur)
              var(--q-color-umbra),
            calc(var(--shadow-y-selected) * -1 * var(--offset-factor))
              calc(var(--shadow-y-selected) * var(--offset-factor))
              var(--shadow-blur-selected) var(--q-color-umbra);
        }
      }
      &.p2 {
        --stone-fill: var(--q-color-player2special);
        transform: rotate(45deg);
        box-shadow: calc(var(--shadow-y) * var(--offset-factor))
          calc(var(--shadow-y) * var(--offset-factor)) var(--shadow-blur)
          var(--q-color-umbra);
        &.firstSelected {
          box-shadow: calc(var(--shadow-y) * var(--offset-factor))
              calc(var(--shadow-y) * var(--offset-factor)) var(--shadow-blur)
              var(--q-color-umbra),
            calc(var(--shadow-y-selected) * var(--offset-factor))
              calc(var(--shadow-y-selected) * var(--offset-factor))
              var(--shadow-blur-selected) var(--q-color-umbra);
        }
      }
    }
    &.C {
      border-radius: 50%;
      &.p1 {
        --stone-fill: var(--q-color-player1special);
      }
      &.p2 {
        --stone-fill: var(--q-color-player2special);
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

    // The ring on a piece of the current ply, drawn over it in its shape at
    // its edge: as thick in every theme, but leaving a third of a standing
    // stone. Inside it the border goes on to meet the fill: what's left of
    // it, and at least a pixel of it. The fill is redrawn on top with the
    // corners an unringed piece has, so they don't sharpen as it shrinks.
    &.ply,
    &.ring {
      --ring-width: max(0.025em, 2px);
      --ring-border: max(
        min(1px, var(--stroke-width)),
        var(--stroke-width) - var(--ring-width)
      );
      // The corners are concentric, from the fill's, which an unringed piece
      // has too. The piece under the ring takes the ring's outer corners, so
      // that none of it shows past them.
      --fill-corner: max(0px, 0.05em - var(--stroke-width));
      --ring-corner: calc(
        var(--fill-corner) + var(--ring-border) + var(--ring-width)
      );
    }
    &.ply.S,
    &.ring.S {
      --ring-width: min(max(0.025em, 2px), 0.0625em);
    }
    &.ply:not(.C),
    &.ring:not(.C) {
      border-radius: var(--ring-corner);
    }
    &.ring,
    &.ring.S.p1,
    &.ring.S.p2 {
      border-width: 0;
      background: var(--q-color-primary);
      box-shadow: none;
      pointer-events: none;
      &::before,
      &::after {
        content: "";
        position: absolute;
        --stone-fill: inherit;
        --stone-stroke: inherit;
      }
      &::before {
        inset: var(--ring-width);
        background: var(--stone-stroke);
        border-radius: calc(var(--fill-corner) + var(--ring-border));
      }
      &::after {
        inset: calc(var(--ring-width) + var(--ring-border));
        background: var(--stone-fill);
        border-radius: var(--fill-corner);
      }
    }
    &.ring.C::before,
    &.ring.C::after {
      border-radius: 50%;
    }
  }

  .stack-count {
    position: absolute;
    bottom: 25%;
    left: 0;
    right: 0;
    height: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: min(0.15em, 15px);
    line-height: 1;
    pointer-events: none;
    color: var(--q-color-textDark);
  }
}
</style>
