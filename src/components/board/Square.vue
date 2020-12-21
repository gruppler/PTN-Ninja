<template>
  <div
    class="square"
    :class="{
      light: square.static.isLight,
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
      return (
        this.current &&
        this.game.state.ply.squares[0] === this.square.static.coord
      );
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
    showRoads() {
      return !this.game.config.disableRoads && this.$store.state.showRoads;
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
  &.light {
    background: $blue-grey-4;
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
    background-color: $accent;
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
      background-color: $blue-grey-2;
    }
    &.placed:not(.eog) .hl.player {
      background-color: $blue-grey-8;
    }
  }
  .board-container.turn-2 & {
    .hl.player {
      background-color: $blue-grey-8;
    }
    &.placed:not(.eog) .hl.player {
      background-color: $blue-grey-2;
    }
  }
  &.selected .hl.player {
    opacity: 0.5;
  }
  &.no-roads.road .hl.player {
    opacity: 0.25;
  }
  @media (pointer: fine) {
    &.valid:hover .hl.player {
      opacity: 0.35;
      cursor: pointer;
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
      transition: opacity $two-thirds-time $easing-reverse,
        background-color $two-thirds-time $easing-reverse,
        top $half-time $easing-reverse, bottom $half-time $easing-reverse,
        left $half-time $easing-reverse, right $half-time $easing-reverse;
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
        top: 35%;
        bottom: 65%;
      }
      &.s {
        top: 65%;
        bottom: 35%;
      }
      &.e {
        left: 65%;
        right: 35%;
      }
      &.w {
        left: 35%;
        right: 65%;
      }
    }
  }
  &.n .road .n {
    top: 0;
  }
  &.s .road .s {
    bottom: 0;
  }
  &.e .road .e {
    right: 0;
  }
  &.w .road .w {
    left: 0;
  }
  &.connected .road .center,
  &.n .road .n,
  &.e .road .e,
  &.s .road .s,
  &.w .road .w {
    opacity: 0.2;
    transition: opacity $two-thirds-time $easing $one-third-time,
      background-color $two-thirds-time $easing $one-third-time,
      top $half-time $easing $half-time, bottom $half-time $easing $half-time,
      left $half-time $easing $half-time, right $half-time $easing $half-time;
  }
  &.road .road .center,
  &.rn .road .n,
  &.re .road .e,
  &.rs .road .s,
  &.rw .road .w {
    opacity: 0.8;
  }
  &.p1 .road > div {
    background-color: $blue-grey-2;
  }
  &.p2 .road > div {
    background-color: $blue-grey-8;
  }
}
</style>
