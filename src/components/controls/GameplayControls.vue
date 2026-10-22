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

        <!-- Undo Button -->
        <q-btn
          @touchstart="vibrate"
          @click="undo"
          @shortkey="undo"
          v-shortkey="hotkeys.undo"
          v-ripple="false"
          :disable="!canUndo"
          icon="undo"
        >
          <hint>
            {{ $t("Undo") }}
          </hint>
        </q-btn>

        <!-- Resign Button -->
        <q-btn
          @touchstart="vibrate"
          @click="resign"
          v-ripple="false"
          :disable="!game || game.hasEnded"
          icon="resign"
        >
          <hint v-if="game && !game.hasEnded">
            {{ $t("Resign") }}
          </hint>
        </q-btn>

        <template v-if="scratchboardEnabled">
          <q-separator vertical />

          <!-- Submit Move Button (for scratchboard games) -->
          <q-btn
            @touchstart="vibrate"
            @click="submitPendingMove"
            v-ripple="false"
            :disable="!pendingMove || !isMyTurn"
            icon="send"
          >
            <hint v-if="pendingMove && isMyTurn">
              {{ $t("Submit Move") }}
            </hint>
          </q-btn>
        </template>
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
      pendingMove: null,
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
    }),
    ...mapGetters({
      player: "online/player",
      isMyTurn: "online/isMyTurn",
      isPlayer: "online/isPlayer",
    }),
    game() {
      return this.$store.state.game;
    },
    scratchboardEnabled() {
      return this.game.config && this.game.config.scratchboard;
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
    canUndo() {
      return this.position.ply && !this.plyInProgress && !this.isBoardDisabled;
    },
    shouldShowControls() {
      return this.isPlayer && !this.game.config.hasEnded;
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
        this.$store.dispatch("game/DELETE_PLY");
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
    submitMove(evalText = "") {
      if (!this.isMyTurn || this.game.config.hasEnded) return;

      const ply = this.position.ply;
      if (ply) {
        const moveWithEval = evalText ? `${ply.text}${evalText}` : ply.text;
        this.submitPly(moveWithEval);
      }
    },
    submitPendingMove() {
      if (this.pendingMove && this.isMyTurn) {
        this.submitPly(this.pendingMove);
        this.pendingMove = null;
      }
    },
    async submitPly(ply) {
      try {
        await this.$store.dispatch("online/INSERT_PLY", {
          gameId: this.game.config.id,
          ply: ply,
          isPrivate: this.game.config.isPrivate,
        });
      } catch (error) {
        this.$q.notify({
          type: "negative",
          message: error.message || this.$t("Failed to submit move"),
        });
      }
    },
  },
  watch: {
    "position.ply"(newPly) {
      if (this.scratchboardEnabled && newPly) {
        this.pendingMove = newPly.text;
      } else if (!this.scratchboardEnabled && newPly && this.isMyTurn) {
        // Auto-submit for games without scratchboard
        this.submitPly(newPly.text);
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
