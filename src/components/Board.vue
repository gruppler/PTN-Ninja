<template>
  <div
    class="board-container q-pa-md"
    :class="{
      ['size-' + game.size]: true,
      ['turn-' + game.state.player]: true,
      'axis-labels': $store.state.axisLabels,
      'flat-counts': $store.state.flatCounts,
      'unplayed-pieces': $store.state.unplayedPieces,
      'piece-shadows': $store.state.pieceShadows,
      'board-3D': $store.state.board3D,
      'show-showControls': $store.state.showControls
    }"
    :style="{ maxWidth, fontSize }"
  >
    <div class="flat-counter row">
      <div class="player1 relative-position" :style="{ width: flatWidths[0] }">
        <div class="row absolute-fit no-wrap q-px-sm">
          <div class="name ellipsis col-shrink">
            {{ game.tags.player1.value }}
          </div>
          <div class="flats q-pl-sm">{{ flats[0] }}</div>
        </div>
        <div class="turn-indicator"></div>
      </div>
      <div class="player2 relative-position" :style="{ width: flatWidths[1] }">
        <div class="row absolute-fit no-wrap q-px-sm">
          <div class="flats q-pr-sm">{{ flats[1] }}</div>
          <div class="name ellipsis col-shrink">
            {{ game.tags.player2.value }}
          </div>
        </div>
        <div class="turn-indicator"></div>
      </div>
    </div>

    <div class="row no-wrap">
      <div class="y-axis column">
        <div v-for="i in (1, game.size)" :key="i">{{ game.size - i + 1 }}</div>
      </div>

      <div class="board relative-position">
        <div class="squares absolute-fit row">
          <template v-for="y in (1, game.size)">
            <Square
              v-for="x in (1, game.size)"
              :key="x - 1 + ',' + (game.size - y)"
              :x="x - 1"
              :y="game.size - y"
            />
          </template>
        </div>
        <div class="pieces absolute-fit">
          <template v-for="color in [1, 2]">
            <Piece
              v-for="i in game.pieceCounts.F"
              :key="`${color}-F${i}`"
              :game="game"
              :color="color"
              :index="i - 1"
              type="F"
            />
            <Piece
              v-for="i in game.pieceCounts.C"
              :key="`${color}-C${i}`"
              :game="game"
              :color="color"
              :index="i - 1"
              type="C"
            />
          </template>
        </div>
      </div>

      <div class="unplayed-bg"></div>
    </div>

    <div class="x-axis row items-end">
      <div v-for="i in (1, game.size)" :key="i">{{ "abcdefgh"[i - 1] }}</div>
    </div>

    <q-resize-observer @resize="resize" debounce="0" />
  </div>
</template>

<script>
import Piece from "./Board/Piece.vue";
import Square from "./Board/Square";

export default {
  name: "Board",
  components: {
    Square,
    Piece
  },
  props: ["game", "space"],
  data() {
    return {
      size: null
    };
  },
  computed: {
    flats() {
      let flats = [0, 0];
      let piece;
      this.game.state.squares.forEach(row =>
        row.forEach(square => {
          if (square.length) {
            piece = square[square.length - 1];
            flats[piece.color - 1] += !piece.isSelected && !piece.isCapstone;
          }
        })
      );
      return flats;
    },
    flatWidths() {
      let total = (this.flats[0] + this.flats[1]) / 100;
      return [
        total ? this.flats[0] / total + "%" : "",
        total ? this.flats[1] / total + "%" : ""
      ];
    },
    maxWidth() {
      if (!this.space || !this.size) {
        return "100%";
      } else {
        return (
          Math.round((this.size.width * this.space.height) / this.size.height) +
          "px"
        );
      }
    },
    fontSize() {
      if (!this.space || !this.size) {
        return "3vmin";
      } else {
        return (
          Math.max(10, Math.min(20, Math.round(this.size.height * 0.04))) + "px"
        );
      }
    }
  },
  methods: {
    resize(size) {
      this.size = size;
    }
  }
};
</script>

<style lang="stylus">
$turn-indicator-height = 0.5em
$axis-size = 1.5em
$radius = 5px

.board-container
  width 100%
  will-change width, font-size

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
  height 2em
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

.turn-indicator
  width 0
  height $turn-indicator-height
  position absolute
  bottom - $turn-indicator-height
  background $accent
  will-change width
  transition width $generic-hover-transition
  .board-container.turn-1 .player1 &,
  .board-container.turn-2 .player2 &
    width 100%
  .player1 &
    right 0

.x-axis, .y-axis
  color $blue-grey-2
  justify-content space-around
  line-height 1em
.x-axis
  height $axis-size
  overflow hidden
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
