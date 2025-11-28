<template>
  <div class="gameplay-controls absolute-fit justify-center">
    <div class="row no-wrap justify-around items-center full-height">
      <q-btn-group class="evaluation-buttons" stretch flat>
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

        <EvalButtons v-if="scratchboardEnabled" :disable="!isMyTurn" />

        <!-- Submit Move Button (for scratchboard games) -->
        <q-btn
          v-if="scratchboardEnabled"
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
      </q-btn-group>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex";
import { HOTKEYS } from "../../keymap";
import EvalButtons from "./EvalButtons.vue";

export default {
  name: "GameplayControls",
  components: {
    EvalButtons,
  },
  data() {
    return {
      pendingMove: null,
      hotkeys: {
        undo: HOTKEYS.MISC["game/UNDO"],
      },
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
