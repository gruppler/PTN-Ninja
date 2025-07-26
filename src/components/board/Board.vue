<template>
  <div
    class="board-space absolute-fit"
    :class="{ 'board-3D': board3D, orthographic }"
    :style="{
      perspective,
      '--board-size': config.size,
      '--board-size-grid': config.size + 'fr',
    }"
    v-touch-pan.prevent.mouse="board3D ? rotateBoard : null"
    @click.right.self.prevent="resetBoardRotation"
    @wheel="scroll"
    ref="wrapper"
  >
    <div
      class="board-container"
      :class="{
        [style]: true,
        ['size-' + config.size]: true,
        ['turn-' + turn]: true,
        'no-animations': disableAnimations,
        'axis-labels': $store.state.ui.axisLabels,
        'show-turn-indicator': $store.state.ui.turnIndicator,
        'highlight-squares': $store.state.ui.highlightSquares,
        highlighter: highlighterEnabled,
        'show-unplayed-pieces': $store.state.ui.unplayedPieces,
        eog: position.isGameEnd && !position.isGameEndDefault,
        flatwin: position.isGameEndFlats,
        'pieces-selected': selected.pieces.length > 0,
        'rotate-1': transform[0] === 1,
        'rotate-2': transform[0] === 2,
        'rotate-3': transform[0] === 3,
        flip: transform[1] === 1,
        scrubbing,
        rotating,
        horizontal: !isVertical,
        vertical: isVertical,
      }"
      :style="{ width, fontSize, transform: CSS3DTransform }"
      @click.right.self.prevent="resetBoardRotation"
      v-shortkey="disableHotkeys ? null : hotkeys"
      @shortkey="shortkey"
      ref="container"
    >
      <TurnIndicator :hide-names="hideNames" />

      <div v-if="showMoveNumber" class="move-number-container">
        <template v-if="showMoveNumber"
          >&nbsp;&nbsp;{{ moveNumber }}.&nbsp;</template
        >
        <span
          v-if="$store.state.ui.evalText && evaluationText"
          class="eval-text"
          :class="{ absolute: showMoveNumber }"
          >{{ evaluationText.slice(0, 6) }}</span
        >
      </div>

      <div
        class="unplayed-bg all-pointer-events"
        :class="{ vertical: isVertical, horizontal: !isVertical }"
        @click.self="dropPiece"
        @click.right.prevent
        @touchstart.stop
        @mousedown.stop
      />

      <div
        class="board relative-position all-pointer-events"
        @touchstart.stop
        @mousedown.stop
        @pointerdown="highlightStart"
        @pointermove="highlightMove"
      >
        <div class="squares absolute-fit column reverse-wrap">
          <Square v-for="coord in squares" :key="coord" :coord="coord" />
        </div>
        <div class="pieces absolute-fit no-pointer-events">
          <Piece
            v-for="(piece, id) in board.pieces"
            :key="id"
            :ref="id"
            :id="id"
          />
        </div>
      </div>

      <div
        v-if="$store.state.ui.axisLabels"
        class="y-axis column reverse no-pointer-events"
      >
        <div v-for="y in yAxis" :key="y">
          {{ y }}
        </div>
      </div>

      <div
        v-if="$store.state.ui.axisLabels"
        class="x-axis row items-end no-pointer-events"
        @click.right.prevent
      >
        <div v-for="x in xAxis" :key="x">{{ x }}</div>
      </div>

      <q-resize-observer class="absolute-fit" @resize="resizeBoard" />
    </div>
    <q-resize-observer @resize="resizeSpace" />
  </div>
</template>

<script>
import Piece from "./Piece";
import Square from "./Square";
import TurnIndicator from "./TurnIndicator";
import { HOTKEYS } from "../../keymap";

import { forEach, throttle } from "lodash";

const FONT_RATIO = 1 / 30;
const MAX_ANGLE = 30;
const ROTATE_SENSITIVITY = 3;

export default {
  name: "Board",
  components: {
    Square,
    Piece,
    TurnIndicator,
  },
  props: {
    hideNames: Boolean,
  },
  data() {
    return {
      size: null,
      space: null,
      scale: 1,
      x: 0,
      y: 0,
      deltaY: 0,
      highlighting: false,
      rotating: false,
      isSlowScrub: false,
      prevBoardRotation: null,
      boardRotation: this.$store.state.ui.boardRotation,
      zoomFitTimer: null,
      hotkeys: HOTKEYS.MOVES,
    };
  },
  computed: {
    board() {
      return this.$store.state.game.board;
    },
    squares() {
      return Object.keys(this.$store.state.game.board.squares).sort().reverse();
    },
    config() {
      return this.$store.state.game.config;
    },
    transform() {
      return this.$store.state.ui.boardTransform;
    },
    scrubbing() {
      return this.$store.state.ui.scrubbing;
    },
    scrollThreshold() {
      return this.$store.state.ui.scrollThreshold;
    },
    disableAnimations() {
      return (
        !this.$store.state.ui.animateBoard ||
        (!this.$store.state.ui.animateScrub &&
          this.scrubbing &&
          !this.isSlowScrub)
      );
    },
    disableHotkeys() {
      const $gameSelector =
        this.$parent.$parent.$parent.$parent.$refs.gameSelector;
      return (
        this.isDialogOpen ||
        this.isHighlighting ||
        this.isEditingTPS ||
        this.$store.state.ui.disableBoard ||
        ($gameSelector &&
          $gameSelector.$refs.select &&
          $gameSelector.$refs.select.menu)
      );
    },
    cols() {
      return "abcdefgh".substring(0, this.config.size).split("");
    },
    rows() {
      return "12345678".substring(0, this.config.size).split("");
    },
    yAxis() {
      let axis =
        this.transform[0] % 2 ? this.cols.concat() : this.rows.concat();
      if (this.transform[0] === 1 || this.transform[0] === 2) {
        axis.reverse();
      }
      return axis;
    },
    xAxis() {
      let axis =
        this.transform[0] % 2 ? this.rows.concat() : this.cols.concat();
      if (
        this.transform[1]
          ? this.transform[0] === 0 || this.transform[0] === 1
          : this.transform[0] === 2 || this.transform[0] === 3
      ) {
        axis.reverse();
      }
      return axis;
    },
    position() {
      return this.$store.state.game.position;
    },
    ptn() {
      return this.$store.state.game.ptn;
    },
    evaluationText() {
      let evaluation = this.position.boardPly
        ? this.$store.state.game.ptn.allPlies[this.position.boardPly.id]
            .evaluation
        : null;
      return evaluation ? evaluation.text : null;
    },
    selected() {
      return this.$store.state.game.selected;
    },
    style() {
      return this.$store.state.ui.theme.boardStyle;
    },
    moveNumber() {
      if (this.$store.state.game.editingTPS) {
        return this.$store.state.ui.firstMoveNumber;
      } else {
        return this.position.boardPly
          ? this.$store.state.game.ptn.allPlies[this.position.boardPly.id]
              .linenum.number
          : this.$store.state.game.position.move.linenum.number;
      }
    },
    showMoveNumber() {
      return this.$store.state.ui.moveNumber;
    },
    turn() {
      return this.$store.state.game.editingTPS !== undefined
        ? this.$store.state.ui.selectedPiece.color
        : this.position.turn;
    },
    boardPly() {
      return this.board.ply;
    },
    board3D() {
      return this.$store.state.ui.board3D;
    },
    orthographic() {
      return this.$store.state.ui.orthographic;
    },
    perspective() {
      const factor = 1 - this.$store.state.ui.perspective / 10;
      return this.$q.screen.height * Math.pow(3, factor) + "px";
    },
    padding() {
      if (!this.space) {
        return 0;
      }
      const min = Math.min(this.space.width, this.space.height);
      if (min <= 400) {
        return min * 0.1;
      } else {
        return min * 0.1 + (min - 400) * (this.isVertical ? 0 : 0.2);
      }
    },
    isPortrait() {
      return (
        this.size && this.space && this.space.width - this.size.width < 136
      );
    },
    isVertical() {
      return (
        this.$store.state.ui.verticalLayout &&
        (!this.$store.state.ui.verticalLayoutAuto ||
          (this.space && this.space.width < this.space.height))
      );
    },
    highlighterEnabled() {
      return this.$store.state.ui.highlighterEnabled;
    },
    ratio() {
      // Round to prevent jitter at some dimensions
      return Math.round(10 * (this.size.width / this.size.height)) / 10;
    },
    width() {
      if (this.$el && this.$el.style.width && this.isInputFocused()) {
        return this.$el.style.width;
      } else if (this.space && this.size) {
        const spaceAspect = this.space.width / this.space.height;
        const boardAspect = this.ratio;
        const widthBound = this.space.width;
        const heightBound = this.space.height * boardAspect;
        const hysteresis = 0.05; // Prevent jitter at some dimensions
        let size;
        if (spaceAspect < boardAspect - hysteresis) {
          // Clearly width-constrained
          size = widthBound;
        } else if (boardAspect < spaceAspect - hysteresis) {
          // Clearly height-constrained
          size = heightBound;
        } else {
          // In the dead zone
          size = heightBound;
        }
        return size - this.padding + "px";
      } else {
        return "80%";
      }
    },
    fontSize() {
      if (this.$el && this.$el.style.fontSize && this.isInputFocused()) {
        return this.$el.style.fontSize;
      }
      if (!this.space || !this.size) {
        return "3vmin";
      } else {
        return (
          Math.max(
            8,
            Math.min(
              22,
              this.space.width * FONT_RATIO,
              this.space.height * FONT_RATIO
            )
          ) + "px"
        );
      }
    },
    CSS3DTransform() {
      const x = this.boardRotation[0];
      const y = this.boardRotation[1];
      const magnitude = Math.sqrt(x * x + y * y);
      const scale = this.scale;
      const translate = `${this.x}px, ${this.y}px`;

      const rotateZ = -x * y * MAX_ANGLE * 1.5 + "deg";

      const rotate3d = [y, x, 0, magnitude * MAX_ANGLE + "deg"].join(",");

      return this.board3D
        ? `translate(${translate}) scale(${scale}) rotateZ(${rotateZ}) rotate3d(${rotate3d})`
        : "";
    },
    isDialogOpen() {
      return !["local", "game"].includes(this.$route.name);
    },
    isHighlighting() {
      return this.$store.state.ui.highlighterEnabled;
    },
    isEditingTPS() {
      return this.$store.state.game.editingTPS !== undefined;
    },
  },
  methods: {
    shortkey({ srcKey }) {
      if (srcKey === "cancelMove") {
        this.$store.dispatch("game/CANCEL_MOVE");
      } else {
        let square = this.$store.state.game.hoveredSquare;
        const count = srcKey.slice(10).toLowerCase();
        if (square !== null) {
          this.$store.dispatch("game/SELECT_DROP_PIECES", { square, count });
        }
      }
    },
    highlightStart(event) {
      if (!event || !event.target || !event.target.dataset.coord) {
        return;
      }
      if (event.target.hasPointerCapture(event.pointerId)) {
        event.target.releasePointerCapture(event.pointerId);
      }
      if (event.pointerType === "touch") {
        const coord = event.target.dataset.coord;
        const color =
          this.$store.state.ui.highlighterColor ||
          this.$store.state.ui.theme.colors.primary;
        const squares = { ...this.$store.state.ui.highlighterSquares };
        this.highlighting =
          !(coord in squares) || squares[coord] !== color ? 1 : 2;
      } else {
        this.highlighting = event.which;
      }
      window.addEventListener("pointerup", this.highlightEnd);
      this.highlightMove(event);
    },
    highlightMove(event) {
      if (
        !event ||
        !event.target ||
        !event.target.dataset.coord ||
        !this.highlighting
      ) {
        return;
      }
      const coord = event.target.dataset.coord;
      const color =
        this.$store.state.ui.highlighterColor ||
        this.$store.state.ui.theme.colors.primary;
      const squares = { ...this.$store.state.ui.highlighterSquares };
      if (
        this.highlighting === 1 &&
        (!(coord in squares) || squares[coord] !== color)
      ) {
        squares[coord] = color;
        this.$store.dispatch("ui/SET_UI", ["highlighterSquares", squares]);
      } else if (this.highlighting > 1 && coord in squares) {
        delete squares[coord];
        this.$store.dispatch("ui/SET_UI", ["highlighterSquares", squares]);
      }
    },
    highlightEnd(event) {
      this.highlighting = false;
      window.removeEventListener("pointerup", this.highlightEnd);
    },
    dropPiece() {
      if (this.selected.pieces.length === 1) {
        this.$store.dispatch("game/SELECT_PIECE", {
          type: this.selected.pieces[0].type,
        });
      }
    },
    isInputFocused() {
      const active = document.activeElement;
      return active && /TEXT|INPUT/.test(active.tagName);
    },
    resizeBoard(size) {
      this.size = size;
      this.$store.commit("ui/SET_UI", ["boardSize", size]);
      if (this.$store.state.ui.isVertical !== this.isVertical) {
        this.$store.commit("ui/SET_UI", ["isVertical", this.isVertical]);
      }
    },
    resizeSpace(size) {
      this.space = size;
      this.$store.commit("ui/SET_UI", ["boardSpace", size]);
    },
    resetBoardRotation() {
      if (this.board3D) {
        this.boardRotation = this.$store.state.ui.defaults.boardRotation;
        this.$store.dispatch("ui/SET_UI", [
          "boardRotation",
          this.boardRotation,
        ]);
        this.zoomFitAfterTransition();
      }
    },
    rotateBoard(event) {
      if (!this.board3D) {
        return;
      }

      if (event.isFirst) {
        this.rotating = true;
        this.prevBoardRotation = { ...this.boardRotation };
      }
      if (event.isFinal) {
        this.rotating = false;
      }

      let x =
        this.prevBoardRotation[0] +
        (ROTATE_SENSITIVITY * event.offset.x) / this.size.width;
      if (x > 1) {
        x = 1 + (x - 1) / 3;
      } else if (x < -1) {
        x = -1 + (x + 1) / 3;
      }

      let y =
        this.prevBoardRotation[1] -
        (ROTATE_SENSITIVITY * event.offset.y) / this.size.width;
      if (y > 1) {
        y = 1 + (y - 1) / 3;
      } else if (y < 0) {
        y /= 3;
      }

      if (event.delta.x < 2 && Math.abs(x) < 0.05) {
        x = 0;
      }

      this.boardRotation = [x, y];
      if (event.isFinal) {
        this.$nextTick(() => {
          this.boardRotation = [
            Math.max(-1, Math.min(1, x)),
            Math.max(0, Math.min(1, y)),
          ];
          this.$store.dispatch("ui/SET_UI", [
            "boardRotation",
            this.boardRotation,
          ]);
          this.zoomFitAfterTransition();
        });
      }
    },
    scroll(event) {
      if (this.$store.state.ui.embed) {
        return;
      }

      if (this.$store.state.ui.scrollScrubbing) {
        // Get threshold from screen resolution if not specified
        const scrollThreshold =
          this.scrollThreshold || window.devicePixelRatio * 100;

        // Start scrubbing
        if (!this.$store.state.ui.scrubbing) {
          this.$store.commit("ui/SET_SCRUBBING", "start");
        }

        // Scroll by half-ply and re-enable animations
        this.isSlowScrub = event.shiftKey;

        // Handle smooth scrolling
        this.deltaY += event.deltaY;
        if (Math.abs(this.deltaY) >= scrollThreshold) {
          const action = this.deltaY < 0 ? "game/PREV" : "game/NEXT";
          let times = Math.floor(Math.abs(this.deltaY) / scrollThreshold);
          this.deltaY = (this.deltaY + event.deltaY) % scrollThreshold;
          if (times) {
            this.$store.dispatch(action, { half: this.isSlowScrub, times });
          }
        }

        clearTimeout(this.scrollTimer);
        this.scrollTimer = setTimeout(() => {
          // End scrubbing
          this.$store.commit("ui/SET_SCRUBBING", "end");
          this.isSlowScrub = false;
          this.deltaY = 0;
        }, 300);
      }
    },
    getBounds(nodes) {
      if (nodes.length === 1) {
        return nodes[0].getBoundingClientRect();
      } else {
        let bbAll = {
          top: Infinity,
          bottom: -Infinity,
          left: Infinity,
          right: -Infinity,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
        };
        nodes.forEach((node) => {
          const bb = node.getBoundingClientRect();
          bbAll.top = Math.min(bbAll.top, bb.top);
          bbAll.bottom = Math.max(bbAll.bottom, bb.bottom);
          bbAll.left = Math.min(bbAll.left, bb.left);
          bbAll.right = Math.max(bbAll.right, bb.right);
        });
        bbAll.width = bbAll.right - bbAll.left;
        bbAll.height = bbAll.bottom - bbAll.top;
        bbAll.x = bbAll.left;
        bbAll.y = bbAll.top;
        return bbAll;
      }
    },
    zoomFit() {
      let nodes = [this.$refs.container];
      if (this.$store.state.ui.unplayedPieces) {
        forEach(this.board.pieces, (piece, id) => {
          if (!piece.square) {
            nodes.push(this.$refs[id][0].$refs.stone);
          }
        });
      }
      forEach(this.board.squares, (square) => {
        if (square.piece) {
          nodes.push(this.$refs[square.piece][0].$refs.stone);
        }
      });
      const boardBB = this.getBounds(nodes);
      const spaceBB = this.$refs.wrapper.getBoundingClientRect();

      const halfPad = this.padding / 2;
      spaceBB.width -= this.padding;
      spaceBB.height -= this.padding;
      spaceBB.x += halfPad;
      spaceBB.y += halfPad;

      let scale;
      if (boardBB.width / spaceBB.width > boardBB.height / spaceBB.height) {
        // Horizontally bound
        scale = spaceBB.width / boardBB.width;
      } else {
        // Vertically bound
        scale = spaceBB.height / boardBB.height;
      }
      this.x =
        (this.x + spaceBB.x - boardBB.x) * scale +
        ((spaceBB.width - boardBB.width) / 2) * scale;
      this.y =
        (this.y + spaceBB.y - boardBB.y) * scale +
        ((spaceBB.height - boardBB.height) / 2) * scale;
      scale *= this.scale;
      this.scale = scale;
    },
    zoomFitNextTick() {
      if (this.board3D) {
        this.$nextTick(this.zoomFit);
      }
    },
    zoomFitAfterDelay() {
      if (this.board3D) {
        if (this.zoomFitTimer) {
          clearTimeout(this.zoomFitTimer);
        }
        this.zoomFitTimer = setTimeout(() => {
          this.zoomFitNextTick();
          this.zoomFitTimer = null;
        }, 300);
      }
    },
    zoomFitAfterTransition() {
      if (this.board3D) {
        if (this.$store.state.ui.animateBoard) {
          if (this.zoomFitTimer) {
            clearTimeout(this.zoomFitTimer);
          }
          this.zoomFitTimer = setTimeout(() => {
            if (this.$refs.container) {
              this.$refs.container.ontransitionend = () => {
                this.zoomFitNextTick();
                this.$refs.container.ontransitionend = null;
              };
            }
            this.zoomFitTimer = null;
          }, 300);
        } else {
          this.zoomFitNextTick();
        }
      }
    },
  },
  created() {
    this.zoomFit = throttle(this.zoomFit, 10);
  },
  watch: {
    isPortrait(isPortrait) {
      if (isPortrait !== this.$store.state.ui.isPortrait) {
        this.$store.commit("ui/SET_UI", ["isPortrait", isPortrait]);
      }
    },
    isVertical(isVertical) {
      if (isVertical !== this.$store.state.ui.isVertical) {
        this.$store.commit("ui/SET_UI", ["isVertical", isVertical]);
      }
    },
    boardPly: "zoomFitAfterTransition",
    size: "zoomFitAfterDelay",
    boardRotation: "zoomFitNextTick",
    transform: "zoomFitAfterDelay",
    board3D: "zoomFitAfterTransition",
    orthographic: "zoomFitNextTick",
  },
};
</script>

<style lang="scss">
$axis-size: 1.5em;
$radius: 0.35em;

.board-space {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  &:not(.board-3D),
  &.orthographic {
    perspective: none !important;
  }
  &.board-3D {
    perspective-origin: center;
    .board-container {
      transform-style: preserve-3d;
    }
    .board,
    .board-row,
    .squares {
      transform-style: preserve-3d;
    }
  }
}

.board-container {
  position: relative;
  z-index: 0;
  transition: transform $generic-hover-transition;
  text-align: center;

  display: grid;
  gap: 0;
  grid-template-columns: auto var(--board-size-grid) auto;
  grid-template-rows: auto auto var(--board-size-grid) auto auto;
  &.show-unplayed-pieces.horizontal {
    grid-template-columns: auto var(--board-size-grid) 1.75fr;
  }
  &.show-unplayed-pieces.vertical {
    grid-template-rows: auto auto var(--board-size-grid) 1fr auto;
  }

  &.rotating {
    transition: none !important;
  }
  &.scrubbing {
    &,
    .turn-indicator .player1,
    .turn-indicator .player2,
    .turn-indicator .komi {
      transition: none !important;
    }
  }
  &.no-animations {
    &,
    .piece,
    .stone,
    .road > div,
    .turn-indicator .player1,
    .turn-indicator .player2,
    .turn-indicator .komi {
      transition: none !important;
    }
  }

  &.rotate-1 .squares {
    transform: rotateZ(90deg);
  }
  &.rotate-2 .squares {
    transform: rotateZ(180deg);
  }
  &.rotate-3 .squares {
    transform: rotateZ(270deg);
  }
  &.flip .squares {
    transform: scaleX(-1);
  }
  &.flip.rotate-1 .squares {
    transform: scaleX(-1) rotateZ(90deg);
  }
  &.flip.rotate-2 .squares {
    transform: scaleX(-1) rotateZ(180deg);
  }
  &.flip.rotate-3 .squares {
    transform: scaleX(-1) rotateZ(270deg);
  }
}

.move-number-container {
  position: relative;
  height: 2.25em;
  grid-column-start: 3;
  grid-row-start: 2;
  .board-container.vertical &,
  .board-container:not(.show-unplayed-pieces) & {
    grid-column-start: 2;
    grid-row-start: 1;
  }

  .move-number {
    position: absolute;
    top: 0;
    right: 0;
    height: 1.75em;
    line-height: 1.75;
  }

  .eval-text {
    font-weight: bold;
    color: $primary;
    color: var(--q-color-primary);
  }
}

.turn-indicator {
  grid-column-start: 2;
  grid-row-start: 2;
}

.x-axis,
.y-axis,
.move-number {
  color: $textDark;
  color: var(--q-color-textDark);
  text-shadow: 0 0.05em 0.1em $textLight;
  text-shadow: 0 0.05em 0.1em var(--q-color-textLight);
  justify-content: space-around;
  line-height: 1em;
  body.secondaryDark & {
    color: $textLight;
    color: var(--q-color-textLight);
    text-shadow: 0 0.05em 0.1em $textDark;
    text-shadow: 0 0.05em 0.1em var(--q-color-textDark);
  }
}
.x-axis {
  z-index: 1;
  grid-column-start: 2;
  grid-row-start: 5;
  align-items: flex-end;
  height: $axis-size;
  .board-container:not(.axis-labels) & {
    height: 0;
    opacity: 0;
  }
}

.y-axis {
  grid-column-start: 1;
  grid-row-start: 3;
  align-items: flex-start;
  width: $axis-size;
}

.board {
  grid-column-start: 2;
  grid-row-start: 3;
  grid-row-start: 3;
  background: $board1;
  background: var(--q-color-board1);
  z-index: 1;
  width: 100%;
  aspect-ratio: 1;

  .square,
  .piece {
    aspect-ratio: 1;
    width: calc(100% / var(--board-size));
  }
  .pieces {
    transform-style: preserve-3d;
    z-index: 1;
  }
}

.unplayed-bg,
.move-number {
  will-change: width;
  pointer-events: all;
  .board-container:not(.show-unplayed-pieces) & {
    width: 0 !important;
    height: 0 !important;
  }
}

.unplayed-bg {
  background-color: $board3;
  background-color: var(--q-color-board3);
  overflow: hidden;
  position: relative;

  &.horizontal {
    grid-column-start: 3;
    grid-row-start: 3;
    border-radius: 0 $radius $radius 0;
  }

  &.vertical {
    grid-column-start: 2;
    grid-row-start: 4;
    border-radius: 0 0 $radius $radius;
  }
}
</style>
