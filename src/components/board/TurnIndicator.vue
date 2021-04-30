<template>
  <div v-if="$store.state.ui.turnIndicator" class="turn-indicator">
    <div class="player-names row no-wrap" @click.right.prevent>
      <div
        class="player1 relative-position"
        :style="{ width: $store.state.ui.flatCounts ? widths[1] : '50%' }"
      >
        <div class="content absolute-fit">
          <div class="name absolute-left q-px-sm">
            {{ player1 }}
          </div>
          <div class="flats absolute-right q-px-sm">
            <span v-if="komi < 0 && counts[2]" class="komi-count">
              {{ counts[2] }}+
            </span>
            {{ counts[0] }}
          </div>
        </div>
      </div>
      <div
        class="player2 relative-position"
        :style="{ width: $store.state.ui.flatCounts ? widths[2] : '50%' }"
      >
        <div class="content absolute-fit row no-wrap">
          <div class="flats q-px-sm">
            {{ counts[1] }}
            <span v-if="komi > 0 && counts[2]" class="komi-count">
              +{{ counts[2] }}
            </span>
          </div>
          <div class="name q-mx-sm relative-position">
            {{ player2 }}
          </div>
        </div>
      </div>
      <div
        v-if="komi !== 0 && $store.state.ui.flatCounts"
        class="komi"
        :class="{ dark: komiDark }"
        :style="{ width: widths.komiWidth, left: widths.komiLeft }"
      />
    </div>
    <div class="indicator">
      <div class="player1" />
      <div class="player2" />
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
      return 100 / this.$store.state.game.config.size;
    },
    komi() {
      return this.$store.state.game.config.komi;
    },
    komiDark() {
      return this.komi < 0
        ? this.$store.state.ui.theme.player1Dark
        : this.$store.state.ui.theme.player2Dark;
    },
    counts() {
      if (this.$store.state.ui.flatCounts) {
        return [
          this.komi < 0 ? this.flats[0] + this.komi : this.flats[0],
          this.komi > 0 ? this.flats[1] - this.komi : this.flats[1],
          this.formatKomi(Math.abs(this.komi)),
        ];
      } else {
        return [
          this.komi < 0 ? "+" + this.formatKomi(-this.komi) : "",
          this.komi > 0 ? "+" + this.formatKomi(this.komi) : "",
        ];
      }
    },
    widths() {
      const total = (this.flats[0] + this.flats[1]) / 100;
      const player1width = total
        ? Math.max(
            this.minNameWidth,
            Math.min(100 - this.minNameWidth, this.flats[0] / total)
          ).toPrecision(4)
        : 50;
      const player2width = 100 - player1width;
      const komiWidth = (this.komi < 0
        ? player1width * (-this.komi / this.flats[0])
        : player2width * (this.komi / this.flats[1])
      ).toPrecision(4);
      const komiLeft = this.komi < 0 ? player1width - komiWidth : player1width;
      return {
        1: player1width + "%",
        2: player2width + "%",
        komiWidth: komiWidth + "%",
        komiLeft: komiLeft + "%",
      };
    },
  },
  methods: {
    formatKomi(komi) {
      return komi.toString().replace(".5", "½");
    },
  },
};
</script>

<style lang="scss">
$turn-indicator-height: 0.5em;
$radius: 0.35em;

.turn-indicator {
  .player-names {
    $fadeWidth: 10px;
    text-align: left;
    height: 1.75em;
    line-height: 1.75;
    position: relative;
    overflow: hidden;
    will-change: transform;
    border-top-left-radius: $radius;
    border-top-right-radius: $radius;

    .player1,
    .player2 {
      width: 50%;
      will-change: width;
      transition: width $generic-hover-transition;
      .content {
        white-space: nowrap;
      }
    }
    .player1 .content {
      color: $textDark;
      color: var(--q-color-textDark);
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

    .komi-count {
      opacity: 0.5;
    }

    .komi {
      position: absolute;
      top: 0;
      bottom: 0;
      opacity: 0.13;
      background: #000;
      will-change: width, left;
      transition: width $generic-hover-transition,
        left $generic-hover-transition;
      z-index: 1;
      &.dark {
        background: #fff;
      }
    }
  }

  .indicator {
    position: relative;
    width: 100%;
    height: $turn-indicator-height;
    .player1,
    .player2 {
      opacity: 0;
      width: 50%;
      height: $turn-indicator-height;
      position: absolute;
      top: 0;
      bottom: 0;
      background: $primary;
      background: var(--q-color-primary);
      will-change: opacity;
      transition: opacity $generic-hover-transition;
      .board-container.is-game-end & {
        opacity: 0 !important;
      }
    }
    .player1 {
      left: 0;
    }
    .player2 {
      right: 0;
    }
    .board-container.turn-1 & .player1,
    .board-container.turn-2 & .player2 {
      opacity: 1;
    }
  }
}
</style>
