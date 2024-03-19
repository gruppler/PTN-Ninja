<template>
  <div
    class="board-wrapper flex flex-center"
    :class="{ 'board-3D': board3D, orthogonal }"
    :style="{ perspective }"
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
        eog: position.isGameEnd,
        flatwin: position.isGameEndFlats,
        'pieces-selected': selected.pieces.length > 0,
        'rotate-1': transform[0] === 1,
        'rotate-2': transform[0] === 2,
        'rotate-3': transform[0] === 3,
        flip: transform[1] === 1,
        scrubbing,
        rotating,
      }"
      :style="{ width, fontSize, transform: CSS3DTransform }"
      @click.right.self.prevent="resetBoardRotation"
      ref="container"
    >
      <TurnIndicator :hide-names="hideNames" />

      <div v-if="$store.state.ui.unplayedPieces" class="move-number">
        <template v-if="showMoveNumber">{{ moveNumber }}.&nbsp;</template>
        <span
          v-if="$store.state.ui.evalText && evaluationText"
          class="eval-text"
          >{{ evaluationText.slice(0, 6) }}</span
        >
      </div>

      <div class="board-row row no-wrap no-pointer-events">
        <div
          v-if="$store.state.ui.axisLabels"
          class="y-axis column reverse no-pointer-events"
        >
          <div v-for="y in yAxis" :key="y">
            {{ y }}
          </div>
        </div>

        <div
          class="board relative-position all-pointer-events"
          @touchstart.stop
          @mousedown.stop
          @pointerdown="highlightStart"
          @pointermove="highlightMove"
        >
          <div class="squares absolute-fit row reverse-wrap">
            <Square
              v-for="(square, coord) in board.squares"
              :key="coord"
              :coord="coord"
            />
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
          class="unplayed-bg all-pointer-events"
          @click.self="dropPiece"
          @click.right.prevent
          @touchstart.stop
          @mousedown.stop
        >
          <div
            v-show="$store.state.ui.showEval"
            @click.self="dropPiece"
            class="evaluation"
            :class="{ p1: evaluation > 0, p2: evaluation < 0 }"
            :style="{ height: Math.abs(evaluation || 0) + '%' }"
          />
        </div>
      </div>

      <div
        v-if="$store.state.ui.axisLabels"
        class="x-axis row items-end no-pointer-events"
        @click.right.prevent
      >
        <div v-for="x in xAxis" :key="x">{{ x }}</div>
      </div>

      <q-resize-observer @resize="resizeBoard" :debounce="20" />
    </div>
    <q-resize-observer @resize="resizeSpace" :debounce="20" />
  </div>
</template>

<script>
import Piece from "./Piece";
import Square from "./Square";
import TurnIndicator from "./TurnIndicator";

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
    };
  },
  computed: {
    board() {
      return this.$store.state.game.board;
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
    evaluation() {
      return this.position.boardPly
        ? this.$store.state.game.comments.evaluations[this.position.boardPly.id]
        : null;
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
      return (
        this.$store.state.ui.moveNumber &&
        this.$store.state.ui.turnIndicator &&
        this.$store.state.ui.unplayedPieces
      );
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
    orthogonal() {
      return this.$store.state.ui.orthogonal;
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
        return min * 0.1 + (min - 400) * 0.2;
      }
    },
    isPortrait() {
      return (
        this.size &&
        this.space &&
        Math.abs(this.size.width - this.space.width) <
          Math.abs(this.size.height - this.space.height)
      );
    },
    highlighterEnabled() {
      return this.$store.state.ui.highlighterEnabled;
    },
    ratio() {
      return Math.round(10 * (this.size.width / this.size.height)) / 10;
    },
    width() {
      if (this.$el && this.$el.style.width && this.isInputFocused()) {
        return this.$el.style.width;
      }
      if (!this.space || !this.size) {
        return "80%";
      } else {
        return (
          Math.max(
            100,
            Math.min(this.space.width, this.space.height * this.ratio)
          ) -
          this.padding +
          "px"
        );
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

      const rotateZ = -x * y * MAX_ANGLE * 0.75 + "deg";

      const rotate3d = [y, x, 0, magnitude * MAX_ANGLE + "deg"].join(",");

      return this.board3D
        ? `translate(${translate}) scale(${scale}) rotateZ(${rotateZ}) rotate3d(${rotate3d})`
        : "";
    },
  },
  methods: {
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
    boardPly: "zoomFitAfterTransition",
    size: "zoomFitAfterDelay",
    boardRotation: "zoomFitNextTick",
    transform: "zoomFitAfterDelay",
    board3D: "zoomFitAfterTransition",
    orthogonal: "zoomFitNextTick",
  },
};
</script>

<style lang="scss">
$axis-size: 1.5em;
$radius: 0.35em;

.board-wrapper {
  &:not(.board-3D),
  &.orthogonal {
    perspective: none !important;
  }
  &.board-3D {
    perspective-origin: center;
    .board-container {
      transform-style: preserve-3d;
    }
    .board,
    .board-row,
    .squares,
    .squares > div {
      transform-style: preserve-3d;
    }
  }
}

.board-container {
  position: relative;
  width: 100%;
  will-change: width, font-size;
  text-align: center;
  z-index: 0;
  transition: transform $generic-hover-transition;

  &.rotating {
    transition: none !important;
  }
  &.scrubbing {
    &,
    .turn-indicator .player1,
    .turn-indicator .player2,
    .turn-indicator .komi,
    .evaluation {
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
    .turn-indicator .komi,
    .evaluation {
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

  .move-number {
    position: absolute;
    top: 0;
    right: 0;
    height: 1.75em;
    line-height: 1.75;
    background: transparent;
  }
}

.turn-indicator,
.x-axis {
  width: 100%;
  will-change: width;
  .board-container.axis-labels & {
    margin-left: $axis-size;
    width: calc(100% - #{$axis-size});
  }
  @for $i from 1 through 8 {
    $size: 100% * $i / ($i + 1.75);
    .board-container.show-unplayed-pieces.size-#{$i} & {
      width: $size;
    }
    .board-container.axis-labels.show-unplayed-pieces.size-#{$i} & {
      width: calc(#{$size} - #{$axis-size * $i / ($i + 1.75)});
    }
  }
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

  .eval-text {
    position: absolute;
    font-weight: bold;
    color: $primary;
    color: var(--q-color-primary);
  }
}
.x-axis {
  align-items: flex-end;
  height: $axis-size;
  .board-container:not(.axis-labels) & {
    height: 0;
    opacity: 0;
    transform: translateY(-100%);
  }
}

.y-axis {
  align-items: flex-start;
  width: $axis-size;
}

.board {
  background: $board1;
  background: var(--q-color-board1);
  z-index: 1;
  width: 100%;
  padding-bottom: 100%;
  will-change: width, padding-bottom;
  .board-container.axis-labels & {
    width: calc(100% - #{$axis-size});
    padding-bottom: calc(100% - #{$axis-size});
  }
  @for $i from 1 through 8 {
    $size: 100% * $i / ($i + 1.75);
    .board-container.show-unplayed-pieces.size-#{$i} & {
      width: $size;
      padding-bottom: $size;
    }
    .board-container.axis-labels.show-unplayed-pieces.size-#{$i} & {
      width: calc(#{$size} - #{$axis-size * $i / ($i + 1.75)});
      padding-bottom: calc(#{$size} - #{$axis-size * $i / ($i + 1.75)});
    }

    .board-container.size-#{$i} & {
      .square,
      .piece {
        $size: 100% / $i;
        width: $size;
        height: $size;
      }
    }
  }
  .pieces {
    transform-style: preserve-3d;
  }
}

.unplayed-bg,
.move-number {
  border-radius: 0 $radius $radius 0;
  background-color: $board3;
  background-color: var(--q-color-board3);
  will-change: width;
  pointer-events: all;
  .board-container:not(.show-unplayed-pieces) & {
    width: 0 !important;
  }
  @for $i from 1 through 8 {
    $size: 175% / ($i + 1.75);
    .board-container.size-#{$i} & {
      width: $size;
    }
    .board-container.axis-labels.size-#{$i} & {
      width: calc(#{$size} - #{$axis-size * 1.75 / ($i + 1.75)});
    }
  }
}

.unplayed-bg {
  overflow: hidden;
  position: relative;

  .evaluation {
    position: absolute;
    opacity: 0.5 !important;
    left: 0;
    right: 0;
    bottom: 0;
    will-change: height, background-color;
    transition: height $generic-hover-transition,
      background-color $generic-hover-transition;
  }
}
</style>
