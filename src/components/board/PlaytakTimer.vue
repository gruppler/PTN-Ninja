<template>
  <div class="playtak-timer-container">
    <span
      v-if="playtakTime1"
      class="playtak-time player1"
      :class="{ hurrytime: isHurryTime(playtakTime1Raw) }"
    >
      {{ playtakTime1[0]
      }}<span v-if="playtakTime1[1] !== undefined" class="playtak-time-decimal"
        >.{{ playtakTime1[1] }}</span
      >
    </span>
    <span
      v-if="playtakTime2"
      class="playtak-time player2"
      :class="{ hurrytime: isHurryTime(playtakTime2Raw) }"
    >
      {{ playtakTime2[0]
      }}<span v-if="playtakTime2[1] !== undefined" class="playtak-time-decimal"
        >.{{ playtakTime2[1] }}</span
      >
    </span>
  </div>
</template>

<script>
export default {
  name: "PlaytakTimer",
  data() {
    return {
      currentTime: performance.now(),
      animationFrameId: null,
    };
  },
  computed: {
    playtakTime1RawBase() {
      return this.$store.state.game.config?.playtakTime1;
    },
    playtakTime2RawBase() {
      return this.$store.state.game.config?.playtakTime2;
    },
    playtakLastTimeUpdate() {
      return this.$store.state.game.config?.playtakLastTimeUpdate;
    },
    playtakIsMyMove() {
      return this.$store.state.game.position.turn === 1;
    },
    playtakTime1Raw() {
      if (
        this.playtakTime1RawBase === undefined ||
        this.playtakTime1RawBase === null
      )
        return null;
      if (this.playtakIsMyMove && this.playtakLastTimeUpdate) {
        return Math.max(
          this.playtakTime1RawBase -
            (this.currentTime - this.playtakLastTimeUpdate),
          0
        );
      }
      return this.playtakTime1RawBase;
    },
    playtakTime2Raw() {
      if (
        this.playtakTime2RawBase === undefined ||
        this.playtakTime2RawBase === null
      )
        return null;
      if (!this.playtakIsMyMove && this.playtakLastTimeUpdate) {
        return Math.max(
          this.playtakTime2RawBase -
            (this.currentTime - this.playtakLastTimeUpdate),
          0
        );
      }
      return this.playtakTime2RawBase;
    },
    playtakTime1() {
      return this.formatPlaytakTime(this.playtakTime1Raw);
    },
    playtakTime2() {
      return this.formatPlaytakTime(this.playtakTime2Raw);
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
    formatPlaytakTime(time) {
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
.playtak-timer-container {
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
  height: 2.25em;

  .playtak-time {
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
  .playtak-time-decimal {
    font-size: 70%;
  }
}
</style>
