<template>
  <div
    class="board-wrapper flex flex-center"
    :class="{ 'board-3D': board3D, orthogonal }"
    :style="{ perspective }"
    v-touch-pan.prevent.mouse="board3D ? rotateBoard : null"
    @click.right.self.prevent="resetBoardRotation"
    ref="wrapper"
  >
    <div
      class="board-container"
      :class="{
        [style]: true,
        ['size-' + game.size]: true,
        ['turn-' + turn]: true,
        'no-animations': !$store.state.animateBoard,
        'axis-labels': $store.state.axisLabels,
        'show-turn-indicator': $store.state.turnIndicator,
        'highlight-squares': $store.state.highlightSquares,
        'piece-shadows': $store.state.pieceShadows,
        'show-unplayed-pieces': $store.state.unplayedPieces,
        'is-game-end': game.state.isGameEnd,
      }"
      :style="{ width, fontSize, transform: CSS3DTransform }"
      @click.right.self.prevent="resetBoardRotation"
      ref="container"
    >
      <TurnIndicator :game="game" />

      <div class="board-row row no-wrap no-pointer-events">
        <div
          v-if="$store.state.axisLabels"
          class="y-axis column reverse no-pointer-events"
        >
          <div v-for="y in yAxis" :key="y">
            {{ y }}
          </div>
        </div>

        <div class="board relative-position all-pointer-events">
          <div
            class="squares absolute-fit row reverse-wrap"
            :style="{ transform: CSS2DTransform }"
          >
            <Square
              v-for="square in squares"
              :key="square.static.coord"
              :x="square.static.x"
              :y="square.static.y"
              :game="game"
            />
          </div>
          <div class="pieces absolute-fit no-pointer-events">
            <Piece
              v-for="piece in game.state.pieces.all.byID"
              :key="piece.id"
              :ref="piece.id"
              :id="piece.id"
              :game="game"
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
        v-if="$store.state.axisLabels"
        class="x-axis row items-end no-pointer-events"
        @click.right.prevent
      >
        <div v-for="x in xAxis" :key="x">{{ x }}</div>
      </div>

      <q-resize-observer @resize="resizeBoard" :debounce="10" />
    </div>
    <q-resize-observer @resize="resizeSpace" :debounce="10" />
  </div>
</template>

<script>
import Piece from "./Piece";
import Square from "./Square";
import TurnIndicator from "./TurnIndicator";

import { throttle } from "lodash";

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
  props: ["game"],
  data() {
    return {
      size: null,
      space: null,
      scale: 1,
      x: 0,
      y: 0,
      prevBoardRotation: null,
      boardRotation: this.$store.state.boardRotation,
      zoomFitTimer: null,
    };
  },
  computed: {
    transform() {
      return this.$store.state.boardTransform;
    },
    cols() {
      return "abcdefgh".substr(0, this.game.size).split("");
    },
    rows() {
      return "12345678".substr(0, this.game.size).split("");
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
    style() {
      return this.$store.state.theme.boardStyle;
    },
    turn() {
      return this.$store.state.isEditingTPS
        ? this.$store.state.selectedPiece.color
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
    komi() {
      return this.game.tags.komi ? this.game.tags.komi.value : 0;
    },
    flatCounts() {
      if (this.$store.state.flatCounts) {
        return [
          this.komi < 0
            ? this.flats[0] + this.komi + " " + this.formatKomi(-this.komi)
            : this.flats[0],
          this.komi > 0
            ? this.flats[1] - this.komi + " " + this.formatKomi(this.komi)
            : this.flats[1],
        ];
      } else {
        return [
          this.komi < 0 ? this.formatKomi(-this.komi) : "",
          this.komi > 0 ? this.formatKomi(this.komi) : "",
        ];
      }
    },
    flatWidths() {
      const total = (this.flats[0] + this.flats[1]) / 100;
      const player1width = total
        ? Math.max(
            this.minNameWidth,
            Math.min(
              100 - this.minNameWidth,
              (this.flats[0] / total).toPrecision(4)
            )
          )
        : 50;
      return [player1width + "%", 100 - player1width + "%"];
    },
    board3D() {
      return this.$store.state.board3D;
    },
    orthogonal() {
      return this.$store.state.orthogonal;
    },
    perspective() {
      const factor = 1 - this.$store.state.perspective / 10;
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
    CSS2DTransform() {
      return `scaleX(${-1 * this.transform[1] || 1}) rotateZ(${
        90 * this.transform[0]
      }deg)`;
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
    squares() {
      let squares = [];
      this.game.state.squares.forEach((row) => {
        row.forEach((square) => squares.push(square));
      });
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
        this.boardRotation = this.$store.state.defaults.boardRotation;
        this.$store.dispatch("SET_UI", ["boardRotation", this.boardRotation]);
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
        this.$store.dispatch("SET_UI", ["boardRotation", this.boardRotation]);
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
      if (this.$store.state.unplayedPieces) {
        Object.values(this.game.state.pieces.all.byID).forEach((piece) => {
          if (!piece.square) {
            nodes.push(this.$refs[piece.id][0].$refs.stone);
          }
        });
      }
      this.squares.forEach((square) => {
        if (square.piece) {
          nodes.push(this.$refs[square.piece.id][0].$refs.stone);
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
      if (isPortrait !== this.$store.state.isPortrait) {
        this.$store.commit("SET_UI", ["isPortrait", isPortrait]);
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
    .turn-indicator .player1,
    .turn-indicator .player2,
    .turn-indicator .komi {
      transition: none !important;
    }
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
</style>
