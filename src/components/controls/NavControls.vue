<template>
  <div class="play-controls absolute-fit justify-center">
    <div class="row no-wrap justify-around items-center full-height">
      <q-btn
        @touchstart="vibrate"
        @click="first"
        @shortkey="first"
        v-shortkey="hotkeys.first"
        stretch
        flat
        :color="fg"
        v-ripple="false"
        :disable="isFirst || plyInProgress"
        icon="first"
      >
        <hint v-if="!isFirst && !plyInProgress">
          {{ $t("Beginning") }}
        </hint>
      </q-btn>
      <q-btn
        @touchstart="vibrate"
        @pointerdown="press('prev', $event)"
        @click="click('prev', false)"
        @click.right.prevent="click('prev', true)"
        @shortkey="hotkey('prev', $event)"
        v-shortkey="{
          whole: hotkeys.prev,
          half: hotkeys.prevHalf,
        }"
        stretch
        flat
        :color="fg"
        v-ripple="false"
        :disable="isFirst || plyInProgress"
        icon="backward"
      >
        <hint v-if="!isFirst && !plyInProgress">
          {{ $t("Backward") }}
        </hint>
      </q-btn>
      <q-btn
        v-if="showPlayButton"
        @touchstart="vibrate"
        @click="playpause"
        @shortkey="playpause"
        v-shortkey="hotkeys.playpause"
        round
        v-ripple="false"
        color="primary"
        :text-color="primaryFG"
        :disable="!position.ply || plyInProgress"
        :icon="isPlaying ? 'pause' : 'play'"
      >
        <hint v-if="position.ply && !plyInProgress">
          {{ $t("Play/Pause") }}
        </hint>
      </q-btn>
      <q-btn
        @touchstart="vibrate"
        @pointerdown="press('next', $event)"
        @click="click('next', false)"
        @click.right.prevent="click('next', true)"
        @shortkey="hotkey('next', $event)"
        v-shortkey="{
          whole: hotkeys.next,
          half: hotkeys.nextHalf,
        }"
        stretch
        flat
        :color="fg"
        v-ripple="false"
        :disable="isLast || plyInProgress"
        icon="forward"
      >
        <hint v-if="!isLast && !plyInProgress">
          {{ $t("Forward") }}
        </hint>
      </q-btn>
      <q-btn
        @touchstart="vibrate"
        @click="last"
        @shortkey="last"
        v-shortkey="hotkeys.last"
        stretch
        flat
        :color="fg"
        v-ripple="false"
        :disable="isLast || plyInProgress"
        icon="last"
      >
        <hint v-if="!isLast && !plyInProgress">
          {{ $t("End") }}
        </hint>
      </q-btn>
      <q-separator v-if="!$store.state.ui.disableUndo" vertical />
      <q-btn
        v-if="!$store.state.ui.disableUndo"
        @touchstart="vibrate"
        @click="$store.dispatch('game/UNDO')"
        stretch
        flat
        :color="fg"
        v-ripple="false"
        :disable="!canUndo"
        icon="undo"
      >
        <hint v-if="canUndo">{{ $t("Undo") }}</hint>
      </q-btn>
      <q-btn
        v-if="!$store.state.ui.disableUndo"
        @touchstart="vibrate"
        @click="$store.dispatch('game/REDO')"
        stretch
        flat
        :color="fg"
        v-ripple="false"
        :disable="!canRedo"
        icon="redo"
      >
        <hint v-if="canRedo">{{ $t("Redo") }}</hint>
      </q-btn>
    </div>
  </div>
</template>

<script>
import { HOTKEYS } from "../../keymap";

export default {
  name: "NavControls",
  data() {
    return {
      isPlaying: false,
      timer: null,
      timestamp: null,
      hotkeys: HOTKEYS.CONTROLS,
      // A Backward or Forward button or hotkey being held down:
      // { direction: "prev" | "next", half, key (for a hotkey) }
      hold: null,
      holdTimer: null,
      holdTimestamp: null,
      // A press already stepped, so the click (or right click) it ends in
      // does not step again
      pressStepped: false,
      pressSteppedTimer: null,
      // The latest keydown, seen before vue-shortkey handles it, for its
      // `repeat` and `key`, which the shortkey event does not carry
      lastKeydown: null,
    };
  },
  computed: {
    position() {
      return this.$store.state.game.position;
    },
    isBoardDisabled() {
      return this.$store.state.ui.disableBoard;
    },
    fg() {
      return this.$store.state.ui.theme.isDark ? "textLight" : "textDark";
    },
    primaryFG() {
      return this.$store.state.ui.theme.primaryDark ? "textLight" : "textDark";
    },
    isFirst() {
      return !this.position.prevPly && !this.position.plyIsDone;
    },
    isLast() {
      return (
        (!this.position.nextPly && this.position.plyIsDone) ||
        !this.position.ply
      );
    },
    plyInProgress() {
      return this.$store.state.game.selected.pieces.length !== 0;
    },
    canUndo() {
      return this.$store.state.game.historyIndex > 0 && !this.isBoardDisabled;
    },
    canRedo() {
      return (
        this.$store.state.game.historyIndex <
          this.$store.state.game.history.length && !this.isBoardDisabled
      );
    },
    showPlayButton() {
      return this.$store.state.ui.showPlayButton;
    },
    interval() {
      return 6e4 / this.$store.state.ui.playSpeed;
    },
    // Whether the held control can step again
    canHoldStep() {
      if (!this.hold || this.plyInProgress || this.isPlaying) {
        return false;
      }
      return this.hold.direction === "prev" ? !this.isFirst : !this.isLast;
    },
  },
  methods: {
    play() {
      if (!this.isLast) {
        this.stopHold();
        this.isPlaying = true;
        this.next(true);
      }
    },
    pause() {
      if (this.isPlaying) {
        clearTimeout(this.timer);
        this.isPlaying = false;
      }
    },
    playpause() {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    },
    first() {
      if (!this.isFirst) {
        this.$store.dispatch("game/FIRST");
      }
    },
    restartPlayTimer() {
      if (this.isPlaying) {
        clearTimeout(this.timer);
        this.timer = setTimeout(this.next, this.interval);
        this.timestamp = new Date().getTime();
      }
    },
    prev(half = false) {
      this.restartPlayTimer();
      if (!this.isFirst) {
        this.$store.dispatch("game/PREV", { half: half === true, times: 1 });
      }
    },
    next(half = false) {
      this.restartPlayTimer();
      if (this.$store.state.game.error) {
        this.pause();
        return false;
      }
      if (!this.isLast) {
        this.$store.dispatch("game/NEXT", {
          half: this.isPlaying || half === true,
          times: 1,
        });
        if (this.isLast && this.isPlaying) {
          this.pause();
        }
      }
    },
    last() {
      if (!this.isLast) {
        this.$store.dispatch("game/LAST");
        if (this.isPlaying) {
          this.pause();
        }
      }
    },

    // A tap, click or right click: one step, unless the press already took it
    click(direction, half) {
      if (this.pressStepped) {
        this.pressStepped = false;
        clearTimeout(this.pressSteppedTimer);
        return;
      }
      this[direction](half);
    },
    // A mouse, touch or pen pressed on Backward or Forward
    press(direction, event) {
      if (event.button !== 0 && event.button !== 2) {
        return;
      }
      clearTimeout(this.pressSteppedTimer);
      this.pressStepped = true;
      window.addEventListener("pointerup", this.release, true);
      window.addEventListener("pointercancel", this.release, true);
      this.startHold(direction, event.button === 2, null);
    },
    // A Backward or Forward hotkey, whole or half-step
    hotkey(direction, event) {
      const keydown = this.lastKeydown;
      if (keydown && keydown.repeat) {
        // The OS's key repeat: the hold steps at its own rate
        return;
      }
      this.startHold(
        direction,
        event.srcKey === "half",
        keydown ? keydown.key : null
      );
    },
    // Step once now, then again every interval while held
    startHold(direction, half, key) {
      this.stopHold();
      this[direction](half);
      if (this.isPlaying) {
        return;
      }
      this.hold = { direction, half, key };
      if (!this.canHoldStep) {
        this.hold = null;
        return;
      }
      window.addEventListener("blur", this.stopHold);
      document.addEventListener("visibilitychange", this.stopHold);
      this.holdTimestamp = new Date().getTime();
      this.scheduleHold(this.interval);
    },
    scheduleHold(delay) {
      clearTimeout(this.holdTimer);
      this.holdTimer = setTimeout(this.holdStep, Math.max(0, delay));
    },
    holdStep() {
      if (!this.canHoldStep) {
        this.stopHold();
        return;
      }
      // Keep to the interval from the press, so slow steps don't add up
      const now = new Date().getTime();
      this.holdTimestamp += this.interval;
      if (now - this.holdTimestamp > this.interval) {
        this.holdTimestamp = now;
      }
      this[this.hold.direction](this.hold.half);
      if (this.canHoldStep) {
        this.scheduleHold(
          this.holdTimestamp + this.interval - new Date().getTime()
        );
      } else {
        this.stopHold();
      }
    },
    stopHold() {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
      if (this.hold) {
        this.hold = null;
        window.removeEventListener("blur", this.stopHold);
        document.removeEventListener("visibilitychange", this.stopHold);
      }
    },
    // The pointer let go
    release() {
      window.removeEventListener("pointerup", this.release, true);
      window.removeEventListener("pointercancel", this.release, true);
      if (this.hold && this.hold.key === null) {
        this.stopHold();
      }
      // Forget the press if no click follows it
      clearTimeout(this.pressSteppedTimer);
      this.pressSteppedTimer = setTimeout(() => {
        this.pressStepped = false;
      }, 300);
    },
    onKeydown(event) {
      this.lastKeydown = { key: event.key, repeat: event.repeat };
    },
    onKeyup(event) {
      if (
        this.hold &&
        this.hold.key &&
        (event.key === this.hold.key ||
          (this.hold.half && event.key === "Shift"))
      ) {
        this.stopHold();
      }
    },

    vibrate() {
      if (this.$store.state.ui.hapticNavControls && navigator.vibrate) {
        navigator.vibrate(2);
      }
    },
  },
  watch: {
    // Make playback and held navigation respond immediately to speed changes
    "$store.state.ui.playSpeed"(speed) {
      let now = new Date().getTime();

      if (this.isPlaying) {
        let nextFrame = this.timestamp + 6e4 / speed;
        if (nextFrame < now) {
          this.next();
        } else {
          clearTimeout(this.timer);
          this.timer = setTimeout(this.next, nextFrame - now);
        }
      }

      if (this.hold) {
        this.scheduleHold(this.holdTimestamp + 6e4 / speed - now);
      }
    },
    // Stop a hold once its button is disabled
    canHoldStep(canStep) {
      if (this.hold && !canStep) {
        this.stopHold();
      }
    },
  },
  mounted() {
    // Capture on window runs before vue-shortkey's listeners on document
    window.addEventListener("keydown", this.onKeydown, true);
    window.addEventListener("keyup", this.onKeyup, true);
  },
  beforeDestroy() {
    this.stopHold();
    this.pause();
    clearTimeout(this.pressSteppedTimer);
    window.removeEventListener("pointerup", this.release, true);
    window.removeEventListener("pointercancel", this.release, true);
    window.removeEventListener("keydown", this.onKeydown, true);
    window.removeEventListener("keyup", this.onKeyup, true);
  },
};
</script>

<style lang="scss">
.play-controls {
  .q-btn.disabled {
    opacity: 0.3 !important;
  }

  .row {
    max-width: 500px;
    margin: 0 auto;
  }
}
</style>
