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
          :x1="layer.x1"
          :y1="layer.y1"
          :x2="layer.x2"
          :y2="layer.y2"
          :stroke="layer.borderColor"
          :stroke-width="layer.borderStrokeWidth"
          stroke-linecap="round"
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
          stroke-linecap="round"
        />
      </g>
    </svg>
  </div>
</template>

<script>
import { transformCoord } from "../../utils/boardTransform";
import {
  ARROW_STROKE_WIDTH,
  arrow3DStyle,
  arrowGeometry,
  groupOverlappingArrows,
  stackTopOffset,
} from "../../utils/arrowGeometry";
import {
  annotationBorderColor,
  arrowKey,
  isHorizontalArrow,
  squaresOnSegment,
} from "../../utils/annotations";

const DEFAULT_ARROW_OPACITY = 75;

// Drawn arrows share their geometry with the analysis move visualizations
// (see utils/arrowGeometry), minus the pickup and drop-count markers.
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
      const arrows = this.$store.getters["game/visibleHighlighterArrows"]
        .filter((arrow) => arrow && arrow.from && arrow.to)
        .filter((arrow) => arrow.from !== arrow.to)
        .map((arrow) => ({ ...arrow, key: arrowKey(arrow.from, arrow.to) }));
      const preview = this.preview;
      if (
        preview &&
        preview.from &&
        preview.to &&
        preview.from !== preview.to
      ) {
        const key = arrowKey(preview.from, preview.to);
        // The preview replaces an identical arrow rather than sitting beside it
        return arrows
          .filter((arrow) => arrow.key !== key)
          .concat({ ...preview, key: "preview" });
      }
      return arrows;
    },
    layers() {
      const size = this.boardSize;
      const squaresOf = (arrow) => squaresOnSegment(arrow.from, arrow.to, size);
      const groups = groupOverlappingArrows(this.arrows, squaresOf, (arrow) =>
        isHorizontalArrow(arrow.from, arrow.to)
      );
      const layers = [];
      this.arrows.forEach((arrow) => {
        const group = groups.get(arrow) || { index: 0, groupSize: 1 };
        const layer = this.createArrow(arrow, group, squaresOf(arrow));
        if (layer) {
          layers.push(layer);
        }
      });
      return layers;
    },
  },
  methods: {
    coordToSvg(coord) {
      const s = this.boardSize;
      const { x, y } = transformCoord(coord, s, this.transform);
      return { x: x + 0.5, y: s - 0.5 - y };
    },

    stackOffset(coord) {
      return this.board3D
        ? 0
        : stackTopOffset(
            this.boardSquares[coord],
            this.boardPieces,
            this.boardSize
          );
    },

    createArrow(arrow, group, squares) {
      const geometry = arrowGeometry({
        from: this.coordToSvg(arrow.from),
        to: this.coordToSvg(arrow.to),
        fromStack: this.stackOffset(arrow.from),
        toStack: this.stackOffset(arrow.to),
        indexInGroup: group.index,
        groupSize: group.groupSize,
      });
      if (!geometry) {
        return null;
      }

      const color = arrow.color || this.$store.state.ui.theme.colors.primary;
      const borderWidth = this.pieceBorderWidth;

      return {
        key: arrow.key,
        x1: geometry.x1,
        y1: geometry.y1,
        x2: geometry.x2,
        y2: geometry.y2,
        headPoints: geometry.headPoints,
        color,
        borderColor: annotationBorderColor(color),
        strokeWidth: ARROW_STROKE_WIDTH,
        borderStrokeWidth: ARROW_STROKE_WIDTH + borderWidth * 2,
        headBorderWidth: borderWidth,
        opacity: this.arrowOpacity,
        style: this.board3D ? arrow3DStyle(squares, this.boardSquares) : {},
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
