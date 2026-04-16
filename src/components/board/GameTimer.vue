<template>
  <div class="game-timer-container">
    <span
      v-if="time1"
      class="game-time player1"
      :class="{ hurrytime: isHurryTime(time1Raw) }"
    >
      {{ time1[0]
      }}<span v-if="time1[1] !== undefined" class="game-time-decimal"
        >.{{ time1[1] }}</span
      >
    </span>
    <span
      v-if="time2"
      class="game-time player2"
      :class="{ hurrytime: isHurryTime(time2Raw) }"
    >
      {{ time2[0]
      }}<span v-if="time2[1] !== undefined" class="game-time-decimal"
        >.{{ time2[1] }}</span
      >
    </span>
  </div>
</template>

<script>
export default {
  name: "GameTimer",
  data() {
    return {
      currentTime: performance.now(),
      animationFrameId: null,
    };
  },
  computed: {
    time1RawBase() {
      return this.$store.state.game.config?.gameTime1;
    },
    time2RawBase() {
      return this.$store.state.game.config?.gameTime2;
    },
    lastTimeUpdate() {
      return this.$store.state.game.config?.gameLastTimeUpdate;
    },
    timerTurn() {
      return this.$store.state.game.config?.gameTimerTurn;
    },
    isPlayer1Turn() {
      return this.timerTurn === 1;
    },
    time1Raw() {
      if (this.time1RawBase === undefined || this.time1RawBase === null)
        return null;
      if (this.isPlayer1Turn && this.lastTimeUpdate) {
        return Math.max(
          this.time1RawBase - (this.currentTime - this.lastTimeUpdate),
          0
        );
      }
      return this.time1RawBase;
    },
    time2Raw() {
      if (this.time2RawBase === undefined || this.time2RawBase === null)
        return null;
      if (!this.isPlayer1Turn && this.lastTimeUpdate) {
        return Math.max(
          this.time2RawBase - (this.currentTime - this.lastTimeUpdate),
          0
        );
      }
      return this.time2RawBase;
    },
    time1() {
      return this.formatTime(this.time1Raw);
    },
    time2() {
      return this.formatTime(this.time2Raw);
    },
  },
  mounted() {
    this.startTimer();
  },
  beforeDestroy() {
    this.stopTimer();
  },
  methods: {
    startTimer() {
      this.stopTimer();
      const tick = () => {
        this.currentTime = performance.now();
        this.animationFrameId = requestAnimationFrame(tick);
      };
      this.animationFrameId = requestAnimationFrame(tick);
    },
    stopTimer() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    },
    isHurryTime(time) {
      return time !== null && time <= 10000;
    },
    formatTime(time) {
      if (time === null) return null;
      if (time <= 0) return ["0:00"];
      const getZero = (t) => (t < 10 ? "0" + t : t);
      if (time > 59900) {
        const st = Math.ceil(time / 1000);
        return [Math.floor(st / 60) + ":" + getZero(st % 60)];
      } else {
        const dst = Math.ceil(time / 100);
        return [getZero(Math.floor(dst / 10)), dst % 10];
      }
    },
  },
};
</script>

<style lang="scss">
.game-timer-container {
  grid-column-start: 2;
  grid-row-start: 1;
  z-index: 1;

  .board-container.horizontal.show-unplayed-pieces.show-move-number:not(
      .show-turn-indicator
    )
    & {
    grid-row-start: 2;
  }

  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  pointer-events: none;
  height: 1.75em;
  line-height: 1.75em;

  .game-time {
    display: inline-block;
    padding: 0 10px;
    font-size: 1.1em;
    font-family: "Source Code Pro";
    font-weight: bold;
    color: var(--q-color-textDark);
    text-shadow: 0 0.05em 0.1em var(--q-color-textLight);

    body.secondaryDark & {
      color: var(--q-color-textLight);
      text-shadow: 0 0.05em 0.1em var(--q-color-textDark);
    }

    &.hurrytime {
      color: var(--q-color-negative);
    }
  }
  .game-time-decimal {
    font-size: 70%;
  }
}
</style>
