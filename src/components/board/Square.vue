<template>
  <div
    class="square"
    @mouseover="checkValid"
    :class="{
      light: square.static.isLight,
      dark: !square.static.isLight,
      ['p' + color]: !!color,
      'no-roads': !showRoads,
      'no-stack-counts': !stackCounts,
      eog,
      flatwin,
      current,
      primary,
      selected,
      placed,
      valid,
      connected,
      n,
      e,
      s,
      w,
      road,
      rn,
      re,
      rs,
      rw,
    }"
    @click.left="select()"
    @click.right.prevent="select(true)"
  >
    <div class="hl current" />
    <div class="road" v-if="showRoads">
      <div v-if="en" class="n" />
      <div v-if="ee" class="e" />
      <div class="s" :class="{ es }" />
      <div class="w" :class="{ ew }" />
      <div class="center" />
    </div>
    <div class="hl player" />
    <div class="stack-count" v-show="stackCount">
      <span>{{ stackCount }}</span>
    </div>
  </div>
</template>

<script>
import { last } from "lodash";

export default {
  name: "Square",
  props: ["coord"],
  data() {
    return {
      valid: false,
    };
  },
  computed: {
    game() {
      return this.$store.state.game;
    },
    board() {
      return this.game.board;
    },
    eog() {
      return this.game.position.isGameEnd;
    },
    flatwin() {
      return (
        this.piece && !this.piece.typeCode && this.game.position.isGameEndFlats
      );
    },
    isEditingTPS() {
      return this.$store.state.game.editingTPS !== undefined;
    },
    selectedPiece() {
      return this.$store.state.ui.selectedPiece;
    },
    editingTPS: {
      get() {
        return this.$store.state.game.editingTPS;
      },
      set(tps) {
        this.$store.dispatch("game/EDIT_TPS", tps);
      },
    },
    firstMoveNumber() {
      return this.$store.state.ui.firstMoveNumber;
    },
    square() {
      return this.board.squares[this.coord];
    },
    piece() {
      return this.square.piece ? this.board.pieces[this.square.piece] : null;
    },
    color() {
      return this.piece ? this.piece.color : "";
    },
    current() {
      return this.game.hlSquares.length
        ? this.game.hlSquares.includes(this.square.static.coord)
        : this.game.position.ply &&
            this.game.position.ply.squares.includes(this.square.static.coord);
    },
    primary() {
      if (this.selected) {
        return (
          this.game.selected.squares.length > 1 &&
          this.game.selected.squares[0].static.coord === this.coord
        );
      } else if (this.current) {
        if (this.game.hlSquares.length) {
          return this.game.hlSquares[0] === this.square.static.coord;
        } else {
          let squares = this.game.position.ply.squares;
          const isDestination =
            squares.length === 1 || squares[0] !== this.square.static.coord;
          return this.game.position.plyIsDone ? isDestination : !isDestination;
        }
      }
      return false;
    },
    selected() {
      return this.square.isSelected;
    },
    placed() {
      return (
        this.piece &&
        this.piece.ply &&
        this.piece.ply === this.game.position.ply.id &&
        !(this.game.config.openingSwap && this.game.position.isFirstMove)
      );
    },
    showRoads() {
      return !this.game.config.disableRoads && this.$store.state.ui.showRoads;
    },
    stackCounts() {
      return !this.game.config.disableRoads && this.$store.state.ui.stackCounts;
    },
    stackCount() {
      if (
        this.selected &&
        this.coord ===
          last(this.$store.state.game.selected.squares).static.coord
      ) {
        return last(this.$store.state.game.selected.moveset);
      } else {
        const count = this.square.pieces.length;
        return count > 1 ? count : "";
      }
    },
    en() {
      return this.square.static.edges.N;
    },
    ee() {
      return this.square.static.edges.E;
    },
    es() {
      return this.square.static.edges.S;
    },
    ew() {
      return this.square.static.edges.W;
    },
    n() {
      return this.en && this.square.connected.N;
    },
    s() {
      return this.square.connected.S;
    },
    e() {
      return this.ee && this.square.connected.E;
    },
    w() {
      return this.square.connected.W;
    },
    connected() {
      return this.square.connected.length > 0;
    },
    rn() {
      return this.en && this.square.roads.N;
    },
    rs() {
      return this.square.roads.S;
    },
    re() {
      return this.ee && this.square.roads.E;
    },
    rw() {
      return this.square.roads.W;
    },
    road() {
      return this.square.roads.length > 0;
    },
  },
  methods: {
    checkValid() {
      this.valid =
        this.isEditingTPS ||
        this.$store.getters["game/isValidSquare"](this.square);
    },
    select(alt = false) {
      this.checkValid();
      if (this.valid) {
        if (alt && this.isEditingTPS && this.piece) {
          this.$store.dispatch("ui/SET_UI", [
            "selectedPiece",
            { color: this.piece.color, type: this.piece.typeCode },
          ]);
        }
        this.$store.dispatch("game/SELECT_SQUARE", {
          square: this.square,
          alt,
          selectedPiece: this.selectedPiece,
        });
        if (this.isEditingTPS) {
          this.editingTPS = this.$game.board.getTPS(
            this.selectedPiece.color,
            this.firstMoveNumber
          );
        }
      }
    },
  },
};
</script>

<style lang="scss">
.square {
  position: relative;

  .board-container.diamonds1 &,
  .board-container.diamonds2 &,
  .board-container.diamonds3 &,
  .board-container.grid1 &,
  .board-container.grid2 &,
  .board-container.grid3 & {
    background: $board2;
    background: var(--q-color-board2);
    &:before {
      background: $board1;
      background: var(--q-color-board1);
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
    }
    body.boardChecker &.dark {
      background: transparent;
      &:before {
        background: $board2;
        background: var(--q-color-board2);
      }
    }
  }
  .board-container.diamonds1 & {
    &:before,
    .hl {
      border-radius: 10%;
    }
  }
  .board-container.diamonds2 & {
    &:before,
    .hl {
      border-radius: 30%;
    }
  }
  .board-container.diamonds3 & {
    &:before,
    .hl {
      border-radius: 50%;
    }
  }
  .board-container.grid1 & {
    &:before,
    .hl {
      margin: 1%;
    }
  }
  .board-container.grid2 & {
    &:before,
    .hl {
      border-radius: 5%;
      margin: 3%;
    }
  }
  .board-container.grid3 & {
    &:before,
    .hl {
      border-radius: 15%;
      margin: 6%;
    }
  }
  body.boardChecker .board-container.blank & {
    &.dark {
      background: $board2;
      background: var(--q-color-board2);
    }
  }

  .hl {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    opacity: 0;
    transition: background-color $generic-hover-transition,
      opacity $generic-hover-transition;
    will-change: background-color, opacity;
  }

  .hl.current {
    background-color: $primary;
    background-color: var(--q-color-primary);
  }
  .board-container.highlight-squares &.current {
    .hl.current {
      opacity: 0.4;
    }
    &.primary .hl.current {
      opacity: 0.75;
    }
  }

  .stack-count {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    font-size: 0.6em;
    line-height: 1em;
    span {
      color: $textDark;
      color: var(--q-color-textDark);
      background-color: $board2;
      background-color: var(--q-color-board2);
      display: block;
      position: absolute;
      bottom: 0;
      right: 0;
      width: 1.5em;
      height: 1.5em;
      line-height: 1.5em;
      border-radius: 50%;
    }
  }
  &.no-stack-counts:not(.selected):not(:hover) .stack-count span {
    display: none;
  }
  body.boardChecker.board2Dark &.light .stack-count span {
    color: $textLight;
    color: var(--q-color-textLight);
    background-color: $board2;
    background-color: var(--q-color-board2);
  }
  body.boardChecker.board1Dark &.dark .stack-count span {
    color: $textLight;
    color: var(--q-color-textLight);
    background-color: $board1;
    background-color: var(--q-color-board1);
  }
  body:not(.boardChecker).board2Dark & .stack-count span {
    color: $textLight;
    color: var(--q-color-textLight);
    background-color: $board2;
    background-color: var(--q-color-board2);
  }
  body.primaryDark
    .board-container.highlight-squares
    &.current
    .stack-count
    span {
    color: $textLight;
    color: var(--q-color-textLight);
    background-color: $primary;
    background-color: var(--q-color-primary);
  }
  body:not(.primaryDark)
    .board-container.highlight-squares
    &.current
    .stack-count
    span {
    color: $textDark;
    color: var(--q-color-textDark);
    background-color: $primary;
    background-color: var(--q-color-primary);
  }

  .board-container.turn-1 & {
    .hl.player {
      background-color: $player1road;
      background-color: var(--q-color-player1road);
    }
  }
  .board-container.turn-1:not(.pieces-selected) & {
    &.placed:not(.eog) .hl.player {
      background-color: $player2road;
      background-color: var(--q-color-player2road);
    }
  }
  .board-container.turn-2 & {
    .hl.player {
      background-color: $player2road;
      background-color: var(--q-color-player2road);
    }
  }
  .board-container.turn-2:not(.pieces-selected) & {
    &.placed:not(.eog) .hl.player {
      background-color: $player1road;
      background-color: var(--q-color-player1road);
    }
  }
  &.selected .hl.player {
    opacity: 0.5;
  }
  &.selected.primary .hl.player {
    opacity: 0.25;
  }
  &.no-roads.road .hl.player {
    opacity: 0.35;
  }
  &.flatwin .hl.player {
    opacity: 0.4;
  }
  &.eog.p1 .hl.player {
    background-color: $player1road;
    background-color: var(--q-color-player1road);
  }
  &.eog.p2 .hl.player {
    background-color: $player2road;
    background-color: var(--q-color-player2road);
  }
  @media (pointer: fine) {
    &.valid:hover {
      cursor: pointer;
      .hl.player {
        opacity: 0.35;
      }
    }
  }

  .road {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    pointer-events: none;
    > div {
      opacity: 0;
      position: absolute;
      will-change: opacity, top, bottom, left, right;
      transition: opacity $half-time $easing-reverse,
        background-color $half-time $easing-reverse;
      &.center {
        top: 33.33%;
        bottom: 33.33%;
        left: 33.33%;
        right: 33.33%;
      }
      &.n,
      &.s {
        left: 33.33%;
        right: 33.33%;
      }
      &.e,
      &.w {
        top: 33.33%;
        bottom: 33.33%;
      }
      &.n {
        top: 0;
        bottom: 66.67%;
      }
      &.s {
        top: 66.67%;
        bottom: -33.33%;
        &.es {
          bottom: 0;
        }
      }
      &.e {
        left: 66.67%;
        right: 0;
      }
      &.w {
        left: -33.33%;
        right: 66.67%;
        &.ew {
          left: 0;
        }
      }
    }
  }
  &.connected .road .center,
  &.n .road .n,
  &.e .road .e,
  &.s .road .s,
  &.w .road .w {
    opacity: 0.2;
    transition: opacity $half-time $easing $half-time,
      background-color $half-time $easing $half-time;
  }
  &.road .road .center,
  &.rn .road .n,
  &.re .road .e,
  &.rs .road .s,
  &.rw .road .w {
    opacity: 0.8;
  }
  &.p1 .road > div {
    background-color: $player1road;
    background-color: var(--q-color-player1road);
  }
  &.p2 .road > div {
    background-color: $player2road;
    background-color: var(--q-color-player2road);
  }

  .board-container.rotate-1 & .stack-count {
    transform: rotateZ(270deg);
  }
  .board-container.rotate-2 & .stack-count {
    transform: rotateZ(180deg);
  }
  .board-container.rotate-3 & .stack-count {
    transform: rotateZ(90deg);
  }
  .board-container.flip & .stack-count {
    transform: scaleX(-1);
  }
  .board-container.flip.rotate-1 & .stack-count {
    transform: scaleX(-1) rotateZ(90deg);
  }
  .board-container.flip.rotate-2 & .stack-count {
    transform: scaleX(-1) rotateZ(180deg);
  }
  .board-container.flip.rotate-3 & .stack-count {
    transform: scaleX(-1) rotateZ(270deg);
  }
}
</style>
