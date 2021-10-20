<template>
  <div
    class="square"
    @mouseover="checkValid"
    :class="{
      light: square.static.isLight,
      dark: !square.static.isLight,
      ['p' + color]: !!color,
      'no-roads': !showRoads,
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
    <div class="road" v-if="showRoads">
      <div v-if="en" class="n" />
      <div v-if="ee" class="e" />
      <div class="s" :class="{ es }" />
      <div class="w" :class="{ ew }" />
      <div class="center" />
    </div>
    <div class="hl player" />
  </div>
</template>

<script>
import { atoi, itoa } from "../../Game/PTN/Ply";

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
    isEditingTPS() {
      return this.$store.state.ui.isEditingTPS;
    },
    selectedPiece() {
      return this.$store.state.ui.selectedPiece;
    },
    editingTPS: {
      get() {
        return this.$store.state.ui.editingTPS;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["editingTPS", value]);
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
      return (
        this.game.position.ply &&
        this.game.position.ply.squares.includes(this.square.static.coord)
      );
    },
    primary() {
      if (this.selected) {
        return (
          this.game.selected.squares.length > 1 &&
          this.game.selected.squares[0].static.coord === this.coord
        );
      } else if (this.current) {
        const isDestination =
          this.game.position.ply.squares.length === 1 ||
          this.game.position.ply.squares[0] !== this.square.static.coord;
        return this.game.position.plyIsDone ? isDestination : !isDestination;
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
        !(
          (this.game.openingSwap && this.game.position.isFirstMove) ||
          (this.game.position.plyIsDone && this.game.position.turn === 1)
        )
      );
    },
    showRoads() {
      return !this.game.config.disableRoads && this.$store.state.ui.showRoads;
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
          isEditingTPS: this.isEditingTPS,
          selectedPiece: this.selectedPiece,
        });
        if (this.isEditingTPS) {
          this.editingTPS = this.$game.board._getTPS(
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
        bottom: -35%;
        &.es {
          bottom: 0;
        }
      }
      &.e {
        left: 65%;
        right: 0;
      }
      &.w {
        left: -35%;
        right: 65%;
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
}
</style>
