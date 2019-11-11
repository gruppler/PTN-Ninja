<template>
  <div
    class="board-wrapper flex flex-center"
    :class="{ 'board-3D': $store.state.board3D }"
    v-touch-pan.prevent.mouse="rotateBoard"
    @click.right.self.prevent="resetBoardRotation"
    ref="wrapper"
  >
    <div
      class="board-container q-pa-md"
      :class="{
        ['size-' + game.size]: true,
        ['turn-' + turn]: true,
        'no-animations': !$store.state.animateBoard,
        'axis-labels': $store.state.axisLabels,
        'flat-counts': $store.state.flatCounts,
        'highlight-squares': $store.state.highlightSquares,
        'piece-shadows': $store.state.pieceShadows,
        'unplayed-pieces': $store.state.unplayedPieces
      }"
      :style="{ maxWidth, fontSize, transform }"
      :key="game.name + '|' + game.tag('tps')"
      ref="container"
    >
      <div class="flat-counter row no-wrap">
        <div
          class="player1 relative-position"
          :style="{ width: flatWidths[0] }"
        >
          <div class="row absolute-fit no-wrap q-px-sm">
            <div class="name ellipsis col-shrink">
              {{ player1 }}
            </div>
            <div class="flats ellipsis q-pl-sm">{{ flats[0] }}</div>
          </div>
          <div class="turn-indicator"></div>
        </div>
        <div
          class="player2 relative-position"
          :style="{ width: flatWidths[1] }"
        >
          <div class="row absolute-fit no-wrap q-px-sm">
            <div class="flats ellipsis q-pr-sm">{{ flats[1] }}</div>
            <div class="name ellipsis col-shrink">
              {{ player2 }}
            </div>
          </div>
          <div class="turn-indicator"></div>
        </div>
      </div>

      <div class="board-row row no-wrap">
        <div class="y-axis column">
          <div v-for="i in (1, game.size)" :key="i">
            {{ game.size - i + 1 }}
          </div>
        </div>

        <div class="board relative-position">
          <div class="squares absolute-fit row">
            <Square
              v-for="square in squares"
              :key="square.coord"
              :x="square.x"
              :y="square.y"
              :game="game"
            />
          </div>
          <div class="pieces absolute-fit no-pointer-events">
            <Piece
              v-for="piece in game.state.pieces.all.byID"
              :key="piece.id"
              :id="piece.id"
              :game="game"
            />
          </div>
        </div>

        <div class="unplayed-bg"></div>
      </div>

      <div class="x-axis row items-end">
        <div v-for="i in (1, game.size)" :key="i">{{ "abcdefgh"[i - 1] }}</div>
      </div>

      <q-resize-observer @resize="resizeBoard" debounce="10" />
    </div>
    <q-resize-observer @resize="resizeSpace" debounce="10" />
  </div>
</template>

<script>
import Piece from "./Piece";
import Square from "./Square";

const MAX_ANGLE = 30;
const ROTATE_SENSITIVITY = 3;

export default {
  name: "Board",
  components: {
    Square,
    Piece
  },
  props: ["game"],
  data() {
    return {
      size: null,
      space: null,
      prevBoardRotation: null,
      boardRotation: this.$store.state.boardRotation
    };
  },
  computed: {
    turn() {
      return this.$store.state.isEditingTPS
        ? this.$store.state.selectedPiece.color
        : this.game.state.turn;
    },
    player1() {
      return this.game.tag("player1");
    },
    player2() {
      return this.game.tag("player2");
    },
    flats() {
      return this.game.state.flats;
    },
    flatWidths() {
      let total = (this.flats[0] + this.flats[1]) / 100;
      return [
        total
          ? Math.max(15, Math.min(85, (this.flats[0] / total).toPrecision(4))) +
            "%"
          : "",
        total
          ? Math.max(15, Math.min(85, (this.flats[1] / total).toPrecision(4))) +
            "%"
          : ""
      ];
    },
    isPortrait() {
      return this.size && this.space && this.size.width === this.space.width;
    },
    maxWidth() {
      if (this.isInputFocused()) {
        return this.$el.style.maxWidth;
      }
      if (!this.space || !this.size) {
        return "50%";
      } else {
        return (
          Math.max(
            Math.round(
              (this.size.width * this.space.height) / this.size.height
            ),
            200
          ) + "px"
        );
      }
    },
    fontSize() {
      if (this.isInputFocused()) {
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
              Math.round(this.space.width * 0.033),
              Math.round(this.space.height * 0.033)
            )
          ) + "px"
        );
      }
    },
    transform() {
      const translateX =
        (this.boardRotation[0] * (1 - this.boardRotation[1]) * MAX_ANGLE) / 20;
      const translateY =
        (this.boardRotation[1] *
          (0.25 + 0.25 * Math.abs(this.boardRotation[0])) *
          MAX_ANGLE) /
        -6;
      const translateZ =
        (this.boardRotation[2] *
          (0.5 + 0.5 * this.boardRotation[1]) *
          -MAX_ANGLE) /
        1.5;

      const translate3d = [
        translateX + "em",
        translateY + "em",
        translateZ + "em"
      ].join(",");

      const rotateZ =
        -this.boardRotation[0] * this.boardRotation[1] * MAX_ANGLE * 1.5 +
        "deg";

      const rotate3d = [
        this.boardRotation[1],
        this.boardRotation[0],
        0,
        this.boardRotation[2] * MAX_ANGLE + "deg"
      ].join(",");

      return this.$store.state.board3D
        ? `translate3d(${translate3d}) rotateZ(${rotateZ}) rotate3d(${rotate3d})`
        : "";
    },
    squares() {
      let squares = [];
      for (let y = this.game.size - 1; y >= 0; y--) {
        for (let x = 0; x < this.game.size; x++) {
          squares.push(this.game.state.squares[y][x]);
        }
      }
      return squares;
    }
  },
  methods: {
    isInputFocused() {
      const active = document.activeElement;
      return active && /TEXT|INPUT/.test(active.tagName);
    },
    resizeBoard(size) {
      this.size = size;
    },
    resizeSpace(size) {
      this.space = size;
      if (this.isInputFocused()) {
        document.activeElement.scrollIntoView();
      }
    },
    resetBoardRotation() {
      if (this.$store.state.board3D) {
        this.boardRotation = this.$store.state.defaults.boardRotation;
        this.$store.dispatch("SET_UI", ["boardRotation", this.boardRotation]);
      }
    },
    rotateBoard(event) {
      if (
        !this.$store.state.board3D &&
        event.evt.target === this.$refs.wrapper
      ) {
        return;
      }

      if (event.isFirst) {
        this.prevBoardRotation = { ...this.boardRotation };
      }

      let x = Math.max(
        -1,
        Math.min(
          1,
          this.prevBoardRotation[0] +
            (ROTATE_SENSITIVITY * event.offset.x) / this.size.width
        )
      );

      let y = Math.max(
        0,
        Math.min(
          1,
          this.prevBoardRotation[1] -
            (ROTATE_SENSITIVITY * event.offset.y) / this.size.width
        )
      );

      if (event.delta.x < 2 && Math.abs(x) < 0.05) {
        x = 0;
      }

      let magnitude = Math.sqrt(x * x + y * y);

      this.boardRotation = [x, y, magnitude];
      if (event.isFinal) {
        this.$store.dispatch("SET_UI", ["boardRotation", this.boardRotation]);
      }
    }
  },
  watch: {
    isPortrait(isPortrait) {
      if (isPortrait !== this.$store.state.isPortrait) {
        this.$store.commit("SET_UI", ["isPortrait", isPortrait]);
      }
    }
  }
};
</script>

<style lang="stylus">
$turn-indicator-height = 0.5em
$axis-size = 1.5em
$radius = 5px

.board-wrapper
  &.board-3D
    perspective 150vmin
    perspective-origin center
    .board-container
      transform-style preserve-3d
    .board, .board-row, .squares, .squares > div
      transform-style preserve-3d

.board-container
  width 100%
  will-change width, font-size
  text-align center
  z-index 0

  &.no-animations
    .piece, .stone, .road > div, .flat-counter > div, .turn-indicator
      transition none !important

.flat-counter, .x-axis
  width 100%
  will-change width, height, margin-left, transform, opacity
  .board-container.axis-labels &
    margin-left $axis-size
    width "calc(100% - %s)" % $axis-size
  for i in (1..8)
    $size = 100 * i / (i + 1.75)%
    .board-container.unplayed-pieces.size-{i} &
      width $size
    .board-container.axis-labels.unplayed-pieces.size-{i} &
      width "calc(%s - %s)" % ($size $axis-size * i / (i + 1.75))

.flat-counter
  text-align left
  height 2.25em
  padding-bottom $turn-indicator-height
  line-height @height - @padding-bottom
  .board-container:not(.flat-counts) &
    transform translateY(100%)
    height 0
    opacity 0
  .player1, .player2
    width 50%
    will-change width
    transition width $generic-hover-transition
  .player1 .row
    color $gray-dark
    border-top-left-radius $radius
    overflow hidden
    background $gray-light
  .player2 .row
    color $gray-light
    border-top-right-radius $radius
    background $gray-dark
  .player1 .name, .player2 .flats
    flex-grow 1
  .flats
    flex-shrink 0

.turn-indicator
  opacity 0
  width 100%
  height $turn-indicator-height
  position absolute
  bottom - $turn-indicator-height
  background $accent
  will-change opacity
  transition opacity $generic-hover-transition
  .board-container.turn-1 .player1 &,
  .board-container.turn-2 .player2 &
    opacity 1

.x-axis, .y-axis
  color $blue-grey-2
  justify-content space-around
  line-height 1em
.x-axis
  height $axis-size
  .board-container:not(.axis-labels) &
    height 0
    opacity 0
    transform translateY(-100%)

.y-axis
  width $axis-size
  will-change width, opacity, transform
  .board-container:not(.axis-labels) &
    width 0
    opacity 0
    transform translateX(100%)

.board
  background darken($blue-grey-4, 2%)
  z-index 1
  width 100%
  padding-bottom 100%
  will-change width, padding-bottom
  .board-container.axis-labels &
    width "calc(100% - %s)" % $axis-size
    padding-bottom "calc(100% - %s)" % $axis-size
  for i in (1..8)
    $size = 100 * i / (i + 1.75)%
    .board-container.unplayed-pieces.size-{i} &
      width $size
      padding-bottom $size
    .board-container.axis-labels.unplayed-pieces.size-{i} &
      width "calc(%s - %s)" % ($size $axis-size * i / (i + 1.75))
      padding-bottom "calc(%s - %s)" % ($size $axis-size * i / (i + 1.75))

    .board-container.size-{i} &
      .square, .piece
        $size = 100% / i
        width $size
        height $size
  .pieces
    transform-style preserve-3d

.unplayed-bg
  border-radius 0 $radius $radius 0
  background-color $blue-grey-5
  will-change width
  .board-container:not(.unplayed-pieces) &
    width 0 !important
  for i in (1..8)
    $size = 175% / (i + 1.75)
    .board-container.size-{i} &
      width $size
    .board-container.axis-labels.size-{i} &
      width 'calc(%s - %s)' % ($size $axis-size * 1.75 / (i + 1.75))
</style>
