<template>
  <div
    class="square"
    :class="{
      light: square.static.isLight,
      dark: !square.static.isLight,
      ['p' + color]: !!color,
      'no-roads': !$store.state.showRoads,
      eog,
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
    <div class="road" v-if="$store.state.showRoads">
      <div class="n" />
      <div class="e" />
      <div class="s" />
      <div class="w" />
      <div class="center" />
    </div>
    <div class="hl player" />
  </div>
</template>

<script>
export default {
  name: "Square",
  props: ["game", "x", "y"],
  computed: {
    eog() {
      return this.game.state.isGameEnd;
    },
    isEditingTPS() {
      return this.$store.state.isEditingTPS;
    },
    selectedPiece() {
      return this.$store.state.selectedPiece;
    },
    editingTPS: {
      get() {
        return this.$store.state.editingTPS;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["editingTPS", value]);
      },
    },
    firstMoveNumber() {
      return this.$store.state.firstMoveNumber;
    },
    square() {
      return this.game.state.squares[this.y][this.x];
    },
    piece() {
      return this.square.piece;
    },
    color() {
      return this.piece ? this.piece.color : "";
    },
    current() {
      return (
        this.game.state.ply &&
        this.game.state.ply.squares.includes(this.square.static.coord)
      );
    },
    primary() {
      if (this.selected) {
        return (
          this.game.state.selected.squares.length > 1 &&
          this.game.state.selected.squares[0] === this.square
        );
      } else if (this.current) {
        const isDestination =
          this.game.state.ply.squares.length === 1 ||
          this.game.state.ply.squares[0] !== this.square.static.coord;
        return this.game.state.plyIsDone ? isDestination : !isDestination;
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
        this.piece.ply === this.game.state.ply &&
        !this.game.state.isFirstMove
      );
    },
    valid() {
      return this.isEditingTPS || this.game.isValidSquare(this.square);
    },
    n() {
      return this.square.connected.N;
    },
    s() {
      return this.square.connected.S;
    },
    e() {
      return this.square.connected.E;
    },
    w() {
      return this.square.connected.W;
    },
    connected() {
      return this.square.connected.length > 0;
    },
    rn() {
      return this.square.roads.N;
    },
    rs() {
      return this.square.roads.S;
    },
    re() {
      return this.square.roads.E;
    },
    rw() {
      return this.square.roads.W;
    },
    road() {
      return this.square.roads.length > 0;
    },
  },
  methods: {
    select(alt = false) {
      if (this.valid) {
        if (alt && this.isEditingTPS && this.piece) {
          this.$store.dispatch("SET_UI", [
            "selectedPiece",
            { color: this.piece.color, type: this.piece.typeCode },
          ]);
        }
        this.game.selectSquare(
          this.square,
          alt,
          this.isEditingTPS,
          this.selectedPiece
        );
        if (this.isEditingTPS) {
          this.editingTPS = this.game.state.getTPS(
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

  .board-container.turn-1 & {
    .hl.player {
      background-color: $player1road;
      background-color: var(--q-color-player1road);
    }
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
    opacity: 0.25;
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
        top: 35%;
        bottom: 35%;
        left: 35%;
        right: 35%;
      }
      &.n,
      &.s {
        left: 35%;
        right: 35%;
      }
      &.e,
      &.w {
        top: 35%;
        bottom: 35%;
      }
      &.n {
        top: 0;
        bottom: 65%;
      }
      &.s {
        top: 65%;
        bottom: 0;
      }
      &.e {
        left: 65%;
        right: 0;
      }
      &.w {
        left: 0;
        right: 65%;
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
}
</style>
