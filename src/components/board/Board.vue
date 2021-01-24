<template>
  <div
    class="board-wrapper flex flex-center"
    :class="{ 'board-3D': board3D }"
    v-touch-pan.prevent.mouse="board3D ? rotateBoard : null"
    @click.right.self.prevent="resetBoardRotation"
    ref="wrapper"
  >
    <div
      class="board-container q-pa-md"
      :class="{
        [style]: true,
        ['size-' + game.size]: true,
        ['turn-' + turn]: true,
        'no-animations': !$store.state.ui.animateBoard,
        'axis-labels': $store.state.ui.axisLabels,
        'show-turn-indicator': $store.state.ui.turnIndicator,
        'highlight-squares': $store.state.ui.highlightSquares,
        'piece-shadows': $store.state.ui.pieceShadows,
        'show-unplayed-pieces': $store.state.ui.unplayedPieces,
        'is-game-end': game.state.isGameEnd,
      }"
      :style="{ maxWidth, fontSize, transform }"
      ref="container"
    >
      <div
        v-if="$store.state.ui.turnIndicator"
        class="player-names row no-wrap"
        @click.right.prevent
      >
        <div
          class="player1 relative-position"
          :style="{ width: $store.state.ui.flatCounts ? flatWidths[0] : '50%' }"
        >
          <div class="content absolute-fit">
            <div class="name absolute-left q-px-sm">
              {{ player1 }}
            </div>
            <div class="flats absolute-right q-px-sm">
              {{ $store.state.ui.flatCounts ? flats[0] : "" }}
            </div>
          </div>
          <div class="turn-indicator"></div>
        </div>
        <div
          class="player2 relative-position"
          :style="{ width: $store.state.ui.flatCounts ? flatWidths[1] : '50%' }"
        >
          <div class="content absolute-fit row no-wrap">
            <div class="flats q-px-sm">
              {{
                $store.state.ui.flatCounts
                  ? flats[1].toString().replace(".5", " ½")
                  : ""
              }}
            </div>
            <div class="name q-mx-sm relative-position">
              {{ player2 }}
            </div>
          </div>
          <div class="turn-indicator" />
        </div>
      </div>

      <div class="board-row row no-wrap">
        <div v-if="$store.state.ui.axisLabels" class="y-axis column">
          <div v-for="i in (1, game.size)" :key="i">
            {{ game.size - i + 1 }}
          </div>
        </div>

        <div class="board relative-position">
          <div class="squares absolute-fit row">
            <Square
              v-for="square in squares"
              :key="square.static.coord"
              :x="square.static.x"
              :y="square.static.y"
            />
          </div>
          <div class="pieces absolute-fit no-pointer-events">
            <Piece
              v-for="piece in game.state.pieces.all.byID"
              :key="piece.id"
              :ref="piece.id"
              :id="piece.id"
            />
          </div>
        </div>

        <div
          class="unplayed-bg"
          @click.self="dropPiece"
          @click.right.prevent
        ></div>
      </div>

      <div
        v-if="$store.state.ui.axisLabels"
        class="x-axis row items-end"
        @click.right.prevent
      >
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

import { throttle } from "lodash";

const FONT_RATIO = 1 / 30;
const MAX_ANGLE = 30;
const ROTATE_SENSITIVITY = 3;

export default {
  name: "Board",
  components: {
    Square,
    Piece,
  },
  data() {
    return {
      size: null,
      space: null,
      scale: 1,
      x: 0,
      y: 0,
      prevBoardRotation: null,
      boardRotation: this.$store.state.ui.boardRotation,
      zoomFitTimer: null,
    };
  },
  computed: {
    game() {
      return this.$store.state.game.current;
    },
    style() {
      return this.$store.state.ui.theme.boardStyle;
    },
    turn() {
      return this.$store.state.ui.isEditingTPS
        ? this.$store.state.ui.selectedPiece.color
        : this.game.state.turn;
    },
    boardPly() {
      return this.game.state.boardPly;
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
    minNameWidth() {
      return 100 / this.game.size;
    },
    flatWidths() {
      let total = (this.flats[0] + this.flats[1]) / 100;
      return [
        total
          ? Math.max(
              this.minNameWidth,
              Math.min(
                100 - this.minNameWidth,
                (this.flats[0] / total).toPrecision(4)
              )
            ) + "%"
          : "",
        total
          ? Math.max(
              this.minNameWidth,
              Math.min(
                100 - this.minNameWidth,
                (this.flats[1] / total).toPrecision(4)
              )
            ) + "%"
          : "",
      ];
    },
    board3D() {
      return this.$store.state.ui.board3D;
    },
    isPortrait() {
      return this.size && this.space && this.size.width === this.space.width;
    },
    maxWidth() {
      if (this.$el && this.$el.style.maxWidth && this.isInputFocused()) {
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
              Math.round(this.space.width * FONT_RATIO),
              Math.round(this.space.height * FONT_RATIO)
            )
          ) + "px"
        );
      }
    },
    transform() {
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
    squares() {
      let squares = [];
      for (let y = this.game.size - 1; y >= 0; y--) {
        for (let x = 0; x < this.game.size; x++) {
          squares.push(this.game.state.squares[y][x]);
        }
      }
      return squares;
    },
  },
  methods: {
    dropPiece() {
      if (
        this.game.state.selected.pieces.length === 1 &&
        !this.game.state.selected.moveset.length
      ) {
        this.game.selectUnplayedPiece(this.game.state.selected.pieces[0].type);
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

      this.boardRotation = [x, y];
      if (event.isFinal) {
        this.$store.dispatch("ui/SET_UI", [
          "boardRotation",
          this.boardRotation,
        ]);
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
        Object.values(this.game.state.pieces.all.byID).forEach((piece) => {
          if (!piece.square) {
            nodes.push(this.$refs[piece.id][0].$el);
          }
        });
      }
      this.squares.forEach((square) => {
        if (square.piece) {
          nodes.push(this.$refs[square.piece.id][0].$el);
        }
      });
      const boardBB = this.getBounds(nodes);
      const spaceBB = this.$refs.wrapper.getBoundingClientRect();

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
        if (this.$store.state.animateBoard) {
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
    board3D: "zoomFitAfterTransition",
  },
};
</script>

<style lang="scss">
$turn-indicator-height: 0.5em;
$axis-size: 1.5em;
$radius: 0.35em;

.board-wrapper {
  &.board-3D {
    perspective: 150vmin;
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
  width: 100%;
  will-change: width, font-size;
  text-align: center;
  z-index: 0;
  transition: transform $generic-hover-transition;

  body.non-selectable & {
    transition: none !important;
  }
  &.no-animations {
    &,
    .piece,
    .stone,
    .road > div,
    .player-names > div,
    .turn-indicator {
      transition: none !important;
    }
  }
}

.player-names,
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

.player-names {
  $fadeWidth: 10px;
  text-align: left;
  height: 2.25em;
  padding-bottom: $turn-indicator-height;
  line-height: 2.25em - $turn-indicator-height;
  .player1,
  .player2 {
    width: 50%;
    will-change: width;
    transition: width $generic-hover-transition;
    .content {
      overflow: hidden;
    }
  }
  .player1 .content {
    color: $textDark;
    color: var(--q-color-textDark);
    border-top-left-radius: $radius;
    background: $player1;
    background: var(--q-color-player1);
    .flats {
      text-align: right;
      background: $player1;
      background: var(--q-color-player1);
      background: linear-gradient(
        to left,
        $player1 calc(100% - #{$fadeWidth}),
        $player1clear
      );
      background: linear-gradient(
        to left,
        var(--q-color-player1) calc(100% - #{$fadeWidth}),
        var(--q-color-player1clear)
      );
    }
    body.player1Dark & {
      color: $textLight;
      color: var(--q-color-textLight);
    }
  }
  .player2 .content {
    color: $textDark;
    color: var(--q-color-textDark);
    border-top-right-radius: $radius;
    background: $player2;
    background: var(--q-color-player2);
    &::after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      right: 0;
      width: $fadeWidth;
      text-align: left;
      background: linear-gradient(to left, $player2 0, $player2clear);
      background: linear-gradient(
        to left,
        var(--q-color-player2) 0,
        var(--q-color-player2clear)
      );
    }
    body.player2Dark & {
      color: $textLight;
      color: var(--q-color-textLight);
    }
  }
  .flats {
    white-space: nowrap;
    width: 2em;
    flex-grow: 1;
    flex-shrink: 0;
    z-index: 1;
  }
  .name {
    flex-shrink: 1;
    transform: translateZ(0);
  }
}

.turn-indicator {
  opacity: 0;
  width: 100%;
  height: $turn-indicator-height;
  position: absolute;
  bottom: -$turn-indicator-height;
  background: $primary;
  background: var(--q-color-primary);
  will-change: opacity;
  transition: opacity $generic-hover-transition;
  .board-container.turn-1 .player1 &,
  .board-container.turn-2 .player2 & {
    opacity: 1;
  }
  .board-container.is-game-end & {
    opacity: 0 !important;
  }
}

.x-axis,
.y-axis {
  color: $textDark;
  color: var(--q-color-textDark);
  text-shadow: 0 1px 2px $textLight;
  text-shadow: 0 1px 2px var(--q-color-textLight);
  justify-content: space-around;
  line-height: 1em;
  body.secondaryDark & {
    color: $textLight;
    color: var(--q-color-textLight);
    text-shadow: 0 1px 2px $textDark;
    text-shadow: 0 1px 2px var(--q-color-textDark);
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

.unplayed-bg {
  border-radius: 0 $radius $radius 0;
  background-color: $board3;
  background-color: var(--q-color-board3);
  will-change: width;
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
</style>
