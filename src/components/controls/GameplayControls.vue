<template>
  <div class="gameplay-controls absolute-fit justify-center">
    <div class="row no-wrap justify-evenly items-center full-height">
      <q-btn-group class="evaluation-buttons" stretch flat>
        <!-- First Button -->
        <q-btn
          @touchstart="vibrate"
          @click="first"
          @shortkey="first"
          v-shortkey="navHotkeys.first"
          v-ripple="false"
          :disable="isFirst || plyInProgress"
          icon="first"
        >
          <hint v-if="!isFirst && !plyInProgress">
            {{ $t("Beginning") }}
          </hint>
        </q-btn>

        <!-- Backward Button -->
        <q-btn
          @touchstart="vibrate"
          @click="prev"
          @click.right.prevent="prev(true)"
          @shortkey="prev"
          v-shortkey="{
            whole: navHotkeys.prev,
            half: navHotkeys.prevHalf,
          }"
          v-ripple="false"
          :disable="isFirst || plyInProgress"
          icon="backward"
        >
          <hint v-if="!isFirst && !plyInProgress">
            {{ $t("Backward") }}
          </hint>
        </q-btn>

        <!-- Forward Button -->
        <q-btn
          @touchstart="vibrate"
          @click="next"
          @click.right.prevent="next(true)"
          @shortkey="next"
          v-shortkey="{
            whole: navHotkeys.next,
            half: navHotkeys.nextHalf,
          }"
          v-ripple="false"
          :disable="isLast || plyInProgress"
          icon="forward"
        >
          <hint v-if="!isLast && !plyInProgress">
            {{ $t("Forward") }}
          </hint>
        </q-btn>

        <!-- Last Button -->
        <q-btn
          @touchstart="vibrate"
          @click="last"
          @shortkey="last"
          v-shortkey="navHotkeys.last"
          v-ripple="false"
          :disable="isLast || plyInProgress"
          icon="last"
        >
          <hint v-if="!isLast && !plyInProgress">
            {{ $t("End") }}
          </hint>
        </q-btn>

        <q-separator vertical />

        <!-- Undo Button: removes the last unsent ply -->
        <q-btn
          class="undo-button"
          @touchstart="vibrate"
          @click="undo"
          @shortkey="undo"
          v-shortkey="hotkeys.undo"
          v-ripple="false"
          :disable="!canUndo"
          icon="undo"
        >
          <hint v-if="canUndo">
            {{ $t("Undo") }}
          </hint>
        </q-btn>

        <!-- Resign Button -->
        <q-btn
          @touchstart="vibrate"
          @click="resign"
          v-ripple="false"
          :disable="!game || game.config.hasEnded"
          icon="resign"
        >
          <hint v-if="game && !game.config.hasEnded">
            {{ $t("Resign") }}
          </hint>
        </q-btn>

        <q-separator vertical />

        <!-- Send mode: Auto-send, or the Submit button, also shown in Auto-send
             mode for a move that wasn't sent when it was made -->
        <q-btn
          v-if="isAutoSend && !heldPly"
          class="auto-send-mode"
          @touchstart="vibrate"
          @click="toggleSendMode"
          v-ripple="false"
          icon="auto_send"
        >
          <hint>{{ $t("Auto-send") }}</hint>
        </q-btn>
        <q-btn
          v-else
          class="submit-button"
          @touchstart="vibrate"
          @click="submit"
          v-ripple="false"
          :disable="!canSubmit"
          icon="send"
        >
          <hint v-if="canSubmit">{{ $t("Submit") }}</hint>
        </q-btn>

        <!-- Send mode toggle -->
        <q-btn
          class="send-mode-toggle"
          @touchstart="vibrate"
          @click="toggleSendMode"
          v-ripple="false"
          icon="swap_vert"
        >
          <hint>{{ $t(isAutoSend ? "Submit" : "Auto-send") }}</hint>
        </q-btn>
      </q-btn-group>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex";
import { HOTKEYS } from "../../keymap";
import { countedThrottle } from "../../utilities";

export default {
  name: "GameplayControls",
  data() {
    return {
      hotkeys: {
        undo: HOTKEYS.MISC["game/UNDO"],
      },
      navHotkeys: HOTKEYS.CONTROLS,
    };
  },
  computed: {
    ...mapState({
      position: (state) => state.game.position,
      plyInProgress: (state) => state.ui.plyInProgress,
      isBoardDisabled: (state) => state.ui.isBoardDisabled,
      sendMode: (state) => state.ui.onlineSendMode,
    }),
    ...mapGetters({
      isMyTurn: "online/isMyTurn",
      unsentPly: "online/unsentPly",
      heldPly: "online/heldPly",
      lastUnsentPly: "online/lastUnsentPly",
      syncedPlyCount: "online/syncedPlyCount",
    }),
    game() {
      return this.$store.state.game;
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
    isAutoSend() {
      return this.sendMode !== "submit";
    },
    // Send status of my next move
    status() {
      return this.$store.getters["online/sendStatus"](this.syncedPlyCount);
    },
    isSending() {
      return Boolean(this.unsentPly && this.status === "sending");
    },
    canSubmit() {
      return Boolean(this.heldPly);
    },
    canUndo() {
      return Boolean(
        this.lastUnsentPly &&
          !this.plyInProgress &&
          !this.isBoardDisabled &&
          !(
            this.isSending &&
            this.unsentPly &&
            this.lastUnsentPly.id === this.unsentPly.id
          )
      );
    },
  },
  methods: {
    vibrate() {
      if (this.$store.state.ui.hapticNavControls && navigator.vibrate) {
        navigator.vibrate(2);
      }
    },
    first() {
      if (!this.isFirst) {
        this.$store.dispatch("game/FIRST");
      }
    },
    last() {
      if (!this.isLast) {
        this.$store.dispatch("game/LAST");
      }
    },
    prev(times = 1, event) {
      if (!this.isFirst) {
        this.$store.dispatch("game/PREV", {
          half: event === true || (event && event.srcKey === "half"),
          times,
        });
      }
    },
    next(times = 1, event) {
      if (!this.isLast) {
        this.$store.dispatch("game/NEXT", {
          half: event === true || (event && event.srcKey === "half"),
          times,
        });
      }
    },
    undo() {
      if (this.canUndo) {
        this.$store.dispatch("game/DELETE_PLY", this.lastUnsentPly.id);
      }
    },
    resign() {
      if (!this.game.config.hasEnded) {
        this.$q
          .dialog({
            title: this.$t("Resign"),
            message: this.$t("confirm.resign"),
            color: "primary",
            cancel: true,
            persistent: true,
          })
          .onOk(() => {
            this.$store.dispatch("online/RESIGN");
          });
      }
    },
    toggleSendMode() {
      this.$store.dispatch("ui/SET_UI", [
        "onlineSendMode",
        this.isAutoSend ? "submit" : "auto",
      ]);
    },
    submit() {
      if (this.canSubmit) {
        this.$store.dispatch("online/SEND_PLY");
      }
    },
  },
  created() {
    this.prev = countedThrottle(this.prev.bind(this), 250);
    this.next = countedThrottle(this.next.bind(this), 250);
  },
};
</script>

<style lang="scss">
.gameplay-controls {
  .q-btn.disabled {
    opacity: 0.3 !important;
  }

  .row {
    max-width: 500px;
    margin: 0 auto;
  }
}
</style>
