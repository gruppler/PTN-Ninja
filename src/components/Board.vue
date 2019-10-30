<template>
  <div
    class="board-wrapper flex flex-center"
    :class="{ 'board-3D': $store.state.board3D }"
  >
    <div
      class="board-container q-pa-md"
      :class="{
        ['size-' + game.size]: true,
        ['turn-' + game.state.turn]: true,
        'no-animations': !$store.state.animateBoard,
        'axis-labels': $store.state.axisLabels,
        'flat-counts': $store.state.flatCounts,
        'highlight-squares': $store.state.highlightSquares,
        'piece-shadows': $store.state.pieceShadows,
        'unplayed-pieces': $store.state.unplayedPieces
      }"
      :style="{ maxWidth, fontSize }"
      :key="game.name + '|' + game.tag('tps')"
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
            <template v-for="color in [1, 2]">
              <template v-for="type in ['flat', 'cap']">
                <Piece
                  v-for="i in game.pieceCounts[type]"
                  :key="`${color}-${type}-${i}`"
                  :game="game"
                  :color="color"
                  :type="type"
                  :index="i - 1"
                />
              </template>
            </template>
          </div>
        </div>

        <div class="unplayed-bg"></div>
      </div>

      <div class="x-axis row items-end">
        <div v-for="i in (1, game.size)" :key="i">{{ "abcdefgh"[i - 1] }}</div>
      </div>

      <Move
        v-if="game.state.move"
        v-show="game.state.ply && $store.state.showMove"
        class="q-mt-md"
        :class="{ 'lt-md': $store.state.showPTN }"
        :key="game.state.move.id"
        :move="game.state.move"
        :game="game"
        currentOnly
      />

      <q-resize-observer @resize="resizeBoard" debounce="10" />
    </div>
    <q-resize-observer @resize="resizeSpace" debounce="10" />
  </div>
</template>

<script>
import Piece from "./Piece";
import Square from "./Square";
import Move from "./Move";

export default {
  name: "Board",
  components: {
    Square,
    Piece,
    Move
  },
  props: ["game"],
  data() {
    return {
      size: null,
      space: null
    };
  },
  computed: {
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
    maxWidth() {
      if (this.isInputFocused()) {
        return this.$el.style.maxWidth;
      }
      if (!this.space || !this.size) {
        return "100%";
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
      transform translate3d(0em, -2.83333em, -7.28571em) rotate3d(0.85, 0, 0, 25.5deg)
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

  .move
    display inline-block
    border-radius $radius
    padding 0 .5em
    background-color rgba(#fff, .15)
    transition opacity $generic-hover-transition
    opacity 1
    &.lt-md
      opacity 0

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
