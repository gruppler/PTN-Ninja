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
        @contextmenu="contextmenu('prev', $event)"
        @shortkey="hotkey('prev', $event)"
        v-shortkey="{
          whole: hotkeys.prev,
          half: hotkeys.prevHalf,
        }"
        class="nav-hold"
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
        @contextmenu="contextmenu('next', $event)"
        @shortkey="hotkey('next', $event)"
        v-shortkey="{
          whole: hotkeys.next,
          half: hotkeys.nextHalf,
        }"
        class="nav-hold"
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

// Cmd on a Mac, the Windows key elsewhere ("OS" in older Firefox)
const META = ["Meta", "OS"];

// Keys that don't end a key hold when pressed during it (Meta does)
const MODIFIERS = ["Alt", "AltGraph", "CapsLock", "Control", "Fn", "Shift"];

// Focus moving into one of these ends a key hold: its keyup may not follow
const FOCUS_ENDS_HOLD = [
  "input",
  "textarea",
  "select",
  '[contenteditable]:not([contenteditable="false"])',
  ".q-select",
  ".q-dialog",
].join(", ");

export default {
  name: "NavControls",
  data() {
    return {
      isPlaying: false,
      timer: null,
      timestamp: null,
      hotkeys: HOTKEYS.CONTROLS,
      // A Backward or Forward button or hotkey being held down:
      // { direction: "prev" | "next", half, key and code (for a hotkey) }
      hold: null,
    };
  },
  created() {
    // Bookkeeping the template never shows, kept out of reactivity
    this.holdTimer = null;
    // When the hold's latest step began
    this.holdTimestamp = null;
    // A press already stepped, so the click (or right click) it ends in
    // does not step again
    this.pressStepped = false;
    this.pressSteppedTimer = null;
    // The pointer that pressed: { id, type, el }, kept until the press is
    // forgotten, so a long press's contextmenu can tell it came from a touch
    this.pressPointer = null;
    // Whether that pointer is still down, and for a touch, the identifier of
    // the touch that pressed
    this.pressDown = false;
    this.pressTouchId = null;
    // The latest keydown, seen before vue-shortkey handles it, for its
    // `repeat`, `key` and `code`, which the shortkey event does not carry
    this.lastKeydown = null;
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
      // A speed from a URL or a backup may be a string, or nonsense
      const speed = Number(this.$store.state.ui.playSpeed);
      return speed > 0 ? 6e4 / speed : 1e3;
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
        this.pressPointer = null;
        clearTimeout(this.pressSteppedTimer);
        return;
      }
      this[direction](half);
    },
    // A right click is a half-step. A long press on a touch screen (or with
    // a pen) also sends a contextmenu, which must neither step nor open the
    // browser's menu: the press is a hold, and the click that ends it is
    // still to come
    contextmenu(direction, event) {
      event.preventDefault();
      if (
        this.isTouch(event.pointerType) ||
        (this.pressStepped &&
          this.pressPointer &&
          this.isTouch(this.pressPointer.type))
      ) {
        return;
      }
      this.click(direction, true);
    },
    isTouch(pointerType) {
      return pointerType === "touch" || pointerType === "pen";
    },
    // A mouse, touch or pen pressed on Backward or Forward
    press(direction, event) {
      if (event.button !== 0 && event.button !== 2) {
        return;
      }
      if (
        this.pressDown &&
        event.pointerType === "touch" &&
        this.pressPointer.type === "touch" &&
        this.pressPointer.el === event.currentTarget
      ) {
        // Another finger on a button already held by one: the hold goes on
        return;
      }
      this.endPress();
      clearTimeout(this.pressSteppedTimer);
      this.pressStepped = true;
      this.pressDown = true;
      this.pressTouchId = null;
      this.pressPointer = {
        id: event.pointerId,
        type: event.pointerType,
        el: event.currentTarget,
      };
      window.addEventListener("pointerup", this.release, true);
      window.addEventListener("pointercancel", this.release, true);
      if (event.pointerType === "touch") {
        window.addEventListener("touchstart", this.touchStart, true);
        window.addEventListener("touchend", this.touchEnd, true);
        window.addEventListener("touchcancel", this.touchEnd, true);
      }
      // On a Mac, Ctrl+click is a right click
      const right =
        event.button === 2 || (event.ctrlKey && this.$q.platform.is.mac);
      this.startHold(direction, right, null);
    },
    // A Backward or Forward hotkey, whole or half-step
    hotkey(direction, event) {
      const keydown = this.lastKeydown;
      if (keydown && keydown.repeat) {
        // The OS's key repeat: the hold steps at its own rate
        return;
      }
      this.startHold(direction, event.srcKey === "half", keydown);
    },
    // Step once now, then again every interval while held
    startHold(direction, half, keydown) {
      this.stopHold();
      this.holdTimestamp = performance.now();
      this[direction](half);
      if (this.isPlaying) {
        return;
      }
      this.hold = {
        direction,
        half,
        key: keydown ? keydown.key : null,
        code: keydown ? keydown.code : null,
      };
      if (!this.canHoldStep) {
        this.hold = null;
        return;
      }
      window.addEventListener("blur", this.stopHold);
      window.addEventListener("focusin", this.onFocusin, true);
      document.addEventListener("visibilitychange", this.stopHold);
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
      // The next step is an interval after this one began, so the time a
      // step takes doesn't add up, and a late timer never brings the next
      // step closer than an interval
      this.holdTimestamp = performance.now();
      this[this.hold.direction](this.hold.half);
      if (this.canHoldStep) {
        this.scheduleHold(
          this.holdTimestamp + this.interval - performance.now()
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
        window.removeEventListener("focusin", this.onFocusin, true);
        document.removeEventListener("visibilitychange", this.stopHold);
      }
    },
    // The pointer let go, or the browser took it over
    release(event) {
      const pointer = this.pressPointer;
      if (pointer && event.pointerId !== pointer.id) {
        return;
      }
      if (
        event.type === "pointercancel" &&
        pointer &&
        pointer.type === "touch" &&
        "ontouchstart" in window
      ) {
        // The browser claimed the touch (for its long-press menu, say), but
        // the finger is still down: the touch's own end ends the hold
        return;
      }
      this.endPress();
    },
    // The touch that pressed, seen just after its pointerdown
    touchStart(event) {
      window.removeEventListener("touchstart", this.touchStart, true);
      const touch = event.changedTouches && event.changedTouches[0];
      this.pressTouchId = touch ? touch.identifier : null;
    },
    // A finger lifted (or a touch was cancelled): the hold ends with the
    // touch that started it, whatever other fingers do
    touchEnd(event) {
      const id = this.pressTouchId;
      if (id !== null) {
        const ended = Array.from(event.changedTouches || []);
        if (ended.some((touch) => touch.identifier === id)) {
          this.endPress();
        }
        return;
      }
      const el = this.pressPointer && this.pressPointer.el;
      const touches = Array.from(event.touches || []);
      if (!el || !touches.some((touch) => el.contains(touch.target))) {
        this.endPress();
      }
    },
    endPress() {
      window.removeEventListener("pointerup", this.release, true);
      window.removeEventListener("pointercancel", this.release, true);
      window.removeEventListener("touchstart", this.touchStart, true);
      window.removeEventListener("touchend", this.touchEnd, true);
      window.removeEventListener("touchcancel", this.touchEnd, true);
      const wasDown = this.pressDown;
      this.pressDown = false;
      this.pressTouchId = null;
      if (!wasDown) {
        return;
      }
      if (this.hold && this.hold.key === null) {
        this.stopHold();
      }
      // Forget the press if no click follows it
      clearTimeout(this.pressSteppedTimer);
      this.pressSteppedTimer = setTimeout(() => {
        this.pressStepped = false;
        this.pressPointer = null;
      }, 300);
    },
    // A key hold ends on any sign its key may have been let go unseen: a
    // keyup can go missing (a Mac sends none for a key released while Cmd is
    // down), so Cmd, another key, or focus moving into a text field or a
    // dialog ends it too
    onKeydown(event) {
      this.lastKeydown = {
        key: event.key,
        code: event.code,
        repeat: event.repeat,
      };
      if (
        this.hold &&
        this.hold.key &&
        (META.includes(event.key) ||
          (!event.repeat &&
            !MODIFIERS.includes(event.key) &&
            event.key !== this.hold.key &&
            event.code !== this.hold.code))
      ) {
        this.stopHold();
      }
    },
    onKeyup(event) {
      if (
        this.hold &&
        this.hold.key &&
        (event.key === this.hold.key ||
          (this.hold.code && event.code === this.hold.code) ||
          META.includes(event.key) ||
          // Shift let go ends a half-step hold
          (this.hold.half && event.key === "Shift"))
      ) {
        this.stopHold();
      }
    },
    onFocusin(event) {
      if (
        this.hold &&
        this.hold.key &&
        event.target &&
        event.target.closest &&
        event.target.closest(FOCUS_ENDS_HOLD)
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
    "$store.state.ui.playSpeed"() {
      let now = new Date().getTime();

      if (this.isPlaying) {
        let nextFrame = this.timestamp + this.interval;
        if (nextFrame < now) {
          this.next();
        } else {
          clearTimeout(this.timer);
          this.timer = setTimeout(this.next, nextFrame - now);
        }
      }

      if (this.hold) {
        this.scheduleHold(
          this.holdTimestamp + this.interval - performance.now()
        );
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
    this.endPress();
    clearTimeout(this.pressSteppedTimer);
    window.removeEventListener("keydown", this.onKeydown, true);
    window.removeEventListener("keyup", this.onKeyup, true);
    window.removeEventListener("focusin", this.onFocusin, true);
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

  // Held down on a touch screen, these step: the browser must not take the
  // press for scrolling, text selection or its long-press callout
  .nav-hold {
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
}
</style>
