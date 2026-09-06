<template>
  <div
    v-if="layers.length"
    class="annotation-overlay-wrap"
    :class="{ 'annotation-overlay-wrap-3d': board3D }"
  >
    <svg
      v-for="layer in layers"
      :key="layer.key"
      class="annotation-overlay no-pointer-events"
      :viewBox="`0 0 ${boardSize} ${boardSize}`"
      :style="layer.style"
    >
      <g :opacity="layer.opacity">
        <line
          :x1="layer.bx1"
          :y1="layer.by1"
          :x2="layer.x2"
          :y2="layer.y2"
          :stroke="layer.borderColor"
          :stroke-width="layer.borderStrokeWidth"
          stroke-linecap="butt"
        />
        <polygon
          :points="layer.headPoints"
          :fill="layer.color"
          :stroke="layer.borderColor"
          :stroke-width="layer.headBorderWidth"
          stroke-linejoin="round"
        />
        <line
          :x1="layer.x1"
          :y1="layer.y1"
          :x2="layer.x2"
          :y2="layer.y2"
          :stroke="layer.color"
          :stroke-width="layer.strokeWidth"
          stroke-linecap="butt"
        />
      </g>
    </svg>
  </div>
</template>

<script>
import { transformCoord } from "../../utils/boardTransform";
import {
  annotationBorderColor,
  arrowKey,
  squaresOnSegment,
} from "../../utils/annotations";

// Matches the proportions used by the analysis move visualizations so drawn
// arrows are visually indistinguishable from suggestion arrows.
const START_SHORTEN = 0.3;
const END_SHORTEN = 0.15;
const HEAD_LEN = 0.2;
// Apex angle at the arrowhead's point. Wider than the analysis overlay's
// ~53 degrees so hand-drawn arrows stay legible against a busy board.
const HEAD_ANGLE = 75;
const HEAD_HALF = HEAD_LEN * Math.tan(((HEAD_ANGLE / 2) * Math.PI) / 180);
const SHAFT_START_INSET = 0.05;
// Shaft thickness, widened to stay in proportion with the arrowhead
const STROKE_WIDTH = 0.104;
const STACK_SPACING = 0.07;
const DEFAULT_ARROW_OPACITY = 75;

export default {
  name: "AnnotationOverlay",
  props: {
    // The arrow currently being dragged out, if any
    preview: {
      type: Object,
      default: null,
    },
  },
  computed: {
    board3D() {
      return this.$store.state.ui.board3D;
    },
    // Drawn arrows are translucent so they never fully hide the board
    // underneath. The one being dragged looks no different from a finished one.
    arrowOpacity() {
      const value = this.$store.state.ui.arrowOpacity;
      return (value == null ? DEFAULT_ARROW_OPACITY : value) / 100;
    },
    boardSize() {
      return this.$store.state.game.config.size;
    },
    boardSquares() {
      return this.$store.state.game.board.squares;
    },
    boardPieces() {
      return this.$store.state.game.board.pieces;
    },
    transform() {
      return this.$store.state.ui.boardTransform;
    },
    pieceBorderWidth() {
      const theme = this.$store.state.ui.theme;
      const v = theme && theme.vars && theme.vars["piece-border-width"];
      return (v != null ? Number(v) : 1) * 0.013 * 0.5;
    },
    arrows() {
      const game = this.$store.state.game;
      return game.highlighterArrows.concat(game.tempHighlighterArrows);
    },
    layers() {
      const layers = [];
      this.arrows.forEach((arrow) => {
        const el = this.createArrow(arrow, arrowKey(arrow.from, arrow.to));
        if (el) {
          layers.push(el);
        }
      });
      if (this.preview && this.preview.from !== this.preview.to) {
        const el = this.createArrow(this.preview, "preview");
        if (el) {
          layers.push(el);
        }
      }
      return layers;
    },
  },
  methods: {
    coordToSvg(coord) {
      const s = this.boardSize;
      const { x, y } = transformCoord(coord, s, this.transform);
      return { x: x + 0.5, y: s - 0.5 - y };
    },

    // How far the top of a square's stack rises visually, so an arrow ending
    // on a tall stack isn't swallowed by the pieces drawn on top of it.
    stackOffset(coord) {
      const sq = this.boardSquares[coord];
      if (!sq || !sq.pieces || !sq.pieces.length) {
        return 0;
      }
      const stackHeight = sq.pieces.length;
      const topRef = sq.piece || sq.pieces[stackHeight - 1];
      const topPiece =
        typeof topRef === "string" ? this.boardPieces[topRef] : topRef;
      const topIsWall =
        !!topPiece &&
        (topPiece.isStanding ||
          topPiece.typeCode === "S" ||
          topPiece.type === "wall");
      const effectiveTop = Math.min(stackHeight - 1, this.boardSize - 1);
      let offset = STACK_SPACING * effectiveTop;
      if (topIsWall && stackHeight > 1) {
        offset -= STACK_SPACING;
      }
      return Math.max(0, offset);
    },

    createArrow(arrow, key) {
      if (!arrow || !arrow.from || !arrow.to || arrow.from === arrow.to) {
        return null;
      }
      const from = this.coordToSvg(arrow.from);
      const to = this.coordToSvg(arrow.to);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (!len) {
        return null;
      }
      const ndx = dx / len;
      const ndy = dy / len;
      const px = -ndy;
      const py = ndx;

      const color = arrow.color || this.$store.state.ui.theme.colors.primary;
      const borderWidth = this.pieceBorderWidth;

      // The 2D board draws taller stacks higher up the square, so nudge
      // whichever endpoint sits lower on screen out from under the pieces.
      const isVerticalOnScreen = Math.abs(dy) > Math.abs(dx);
      let bottomOffset = 0;
      if (isVerticalOnScreen && !this.board3D) {
        const bottomCoord = from.y > to.y ? arrow.from : arrow.to;
        bottomOffset = this.stackOffset(bottomCoord);
      }

      let startShorten = START_SHORTEN;
      let endShorten = END_SHORTEN;
      if (bottomOffset > 0) {
        if (from.y > to.y) {
          startShorten += bottomOffset;
        } else {
          endShorten += bottomOffset;
        }
      }

      const tipX = to.x - ndx * endShorten;
      const tipY = to.y - ndy * endShorten;
      const baseX = tipX - ndx * HEAD_LEN;
      const baseY = tipY - ndy * HEAD_LEN;
      // Clamp so a short arrow over a tall stack can't invert its shaft
      const baseDist = len - endShorten - HEAD_LEN;
      const shaftStart = Math.max(
        0,
        Math.min(startShorten + SHAFT_START_INSET, baseDist)
      );
      const x1 = from.x + ndx * shaftStart;
      const y1 = from.y + ndy * shaftStart;
      // Pull the outline back by its own width so the flat tail stays outlined
      const bx1 = x1 - ndx * borderWidth;
      const by1 = y1 - ndy * borderWidth;
      // The arrowhead is a filled polygon stroked on every edge, base
      // included. Run the shaft slightly into it so that base stroke doesn't
      // read as a seam splitting the arrow in two — the barbs' undersides
      // stay outlined, since they sit outside the shaft's width. Opacity is
      // applied to the whole group, so the overlap doesn't darken.
      const headOverlap = borderWidth * 2;
      const x2 = baseX + ndx * headOverlap;
      const y2 = baseY + ndy * headOverlap;

      const lx = baseX + px * HEAD_HALF;
      const ly = baseY + py * HEAD_HALF;
      const rx = baseX - px * HEAD_HALF;
      const ry = baseY - py * HEAD_HALF;

      let style = {};
      if (this.board3D) {
        let maxHeight = 0;
        squaresOnSegment(arrow.from, arrow.to, this.boardSize).forEach(
          (coord) => {
            const sq = this.boardSquares[coord];
            if (sq && sq.pieces) {
              maxHeight = Math.max(maxHeight, sq.pieces.length);
            }
          }
        );
        if (maxHeight > 0) {
          const z = (maxHeight - 1) / 5 + 0.15;
          style = { transform: `translateZ(calc(var(--square-size) * ${z}))` };
        }
      }

      return {
        key,
        x1,
        y1,
        bx1,
        by1,
        x2,
        y2,
        headPoints: `${tipX},${tipY} ${lx},${ly} ${rx},${ry}`,
        color,
        borderColor: annotationBorderColor(color),
        strokeWidth: STROKE_WIDTH,
        borderStrokeWidth: STROKE_WIDTH + borderWidth * 2,
        headBorderWidth: borderWidth,
        opacity: this.arrowOpacity,
        style,
      };
    },
  },
};
</script>

<style lang="scss">
.annotation-overlay-wrap {
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
}
.annotation-overlay-wrap-3d {
  transform-style: preserve-3d;
}
.annotation-overlay {
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
