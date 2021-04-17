<template>
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
          {{ flatCounts[0] }}
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
          {{ flatCounts[1] }}
        </div>
        <div class="name q-mx-sm relative-position">
          {{ player2 }}
        </div>
      </div>
      <div class="turn-indicator" />
    </div>
  </div>
</template>

<script>
export default {
  name: "TurnIndicator",
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
    board() {
      return this.$store.state.game.board;
    },
    turn() {
      return this.$store.state.ui.isEditingTPS
        ? this.$store.state.ui.selectedPiece.color
        : this.position.turn;
    },
    boardPly() {
      return this.board.ply;
    },
    player1() {
      return this.$store.state.game.ptn.tags.player1;
    },
    player2() {
      return this.$store.state.game.ptn.tags.player2;
    },
    flats() {
      return this.board.flats;
    },
    minNameWidth() {
      return 100 / this.$game.size;
    },
    komi() {
      return this.$game.tags.komi ? this.$game.tags.komi.value : 0;
    },
    flatCounts() {
      if (this.$store.state.ui.flatCounts) {
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
  },
  methods: {
    formatKomi(komi) {
      return "+" + komi.toString().replace(".5", "½");
    },
  },
};
</script>

<style lang="scss">
$turn-indicator-height: 0.5em;
$radius: 0.35em;

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
      white-space: nowrap;
      will-change: transform;
      .komi {
        position: absolute;
        top: 0;
        bottom: 0;
        background: $dim;
        will-change: width;
        transition: width $generic-hover-transition;
      }
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
    min-width: 2em;
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
</style>
