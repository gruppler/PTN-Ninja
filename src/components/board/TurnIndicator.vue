<template>
  <div v-if="$store.state.ui.turnIndicator" class="turn-indicator">
    <div class="player-names row no-wrap" @click.right.prevent>
      <div
        class="player1 relative-position"
        :style="{ width: showFlatCounts ? widths[1] : '50%' }"
      >
        <div class="content absolute-fit">
          <div
            v-if="showFlatCounts && komi < 0"
            class="komi"
            :class="{ dark: komiDark }"
            :style="{ width: komiWidth }"
          />
          <div class="name absolute-left q-px-sm">
            {{ hideNames ? "" : player1 }}
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
        :style="{ width: showFlatCounts ? widths[2] : '50%' }"
      >
        <div class="content absolute-fit row no-wrap">
          <div
            v-if="showFlatCounts && komi > 0"
            class="komi"
            :class="{ dark: komiDark }"
            :style="{ width: komiWidth }"
          />
          <div class="flats q-px-sm">
            {{ counts[1] }}
            <span v-if="komi > 0 && counts[2]" class="komi-count">
              +{{ counts[2] }}
            </span>
          </div>
          <div class="name q-mx-sm relative-position">
            {{ hideNames ? "" : player2 }}
          </div>
        </div>
      </div>
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
  props: {
    hideNames: Boolean,
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
    board() {
      return this.$store.state.game.board;
    },
    position() {
      return this.$store.state.game.position;
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
    showFlatCounts() {
      return this.$store.state.ui.flatCounts;
    },
    flats() {
      return this.position.flats;
    },
    flatsflatsWithoutKomi() {
      return this.position.flatsWithoutKomi;
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
      if (this.showFlatCounts) {
        return [
          ...this.flatsflatsWithoutKomi,
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
      return {
        1: player1width + "%",
        2: player2width + "%",
      };
    },
    komiWidth() {
      return `calc(${100 * Math.abs(this.komi)}% / ${
        this.komi < 0 ? this.flats[0] : this.flats[1]
      })`;
    },
  },
  methods: {
    formatKomi(komi) {
      return komi.toString().replace(/0?\.5/, "½");
    },
  },
};
</script>

<style lang="scss">
$turn-indicator-height: 0.5em;
$radius: 0.35em;

.turn-indicator {
  transform-style: preserve-3d;

  .player-names {
    $fadeWidth: 8px;
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
      transition-duration: $transition-duration;
      transition-timing-function: $transition-easing;
      transition-property: width;
      .content {
        white-space: nowrap;
      }
    }
    .player1 .content {
      color: var(--q-color-textDark);
      background: var(--q-color-player1);
      .flats {
        text-align: right;
        background: var(--q-color-player1);
        background: linear-gradient(
          to left,
          var(--q-color-player1) calc(100% - #{$fadeWidth}),
          var(--q-color-player1clear)
        );
      }
      body.player1Dark & {
        color: var(--q-color-textLight);
      }
    }
    .player2 .content {
      color: var(--q-color-textDark);
      background: var(--q-color-player2);
      &::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        right: 0;
        width: $fadeWidth;
        text-align: left;
        background: linear-gradient(
          to left,
          var(--q-color-player2) 0,
          var(--q-color-player2clear)
        );
      }
      body.player2Dark & {
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
      left: 0;
      opacity: 0.13;
      background: #000;
      will-change: width;
      transition-duration: $transition-duration;
      transition-timing-function: $transition-easing;
      transition-property: width;
      z-index: 1;
      &.dark {
        background: #fff;
      }
      .player1 & {
        left: auto;
        right: 0;
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
      background: var(--q-color-primary);
      transition-duration: $transition-duration;
      transition-timing-function: $transition-easing;
      transition-property: opacity;
      .board-container.eog & {
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
