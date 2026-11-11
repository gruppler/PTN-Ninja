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

        <!-- Undo Button: removes the last unsent ply. With none, it asks the
             opponent to take back my last sent move, or withdraws that
             request. -->
        <q-btn
          class="undo-button"
          :class="{ 'request-pending': myTakeback }"
          @touchstart="vibrate"
          @click="undoOrTakeback"
          @shortkey="undo"
          v-shortkey="hotkeys.undo"
          v-ripple="false"
          :disable="!canUndo && !canTakeback"
          :color="myTakeback && !canUndo ? 'primary' : undefined"
          :icon="canUndo || !canTakeback ? 'undo' : 'undo_request'"
        >
          <hint v-if="canUndo">
            {{ $t("Undo") }}
          </hint>
          <hint v-else-if="canTakeback">
            {{ $t(myTakeback ? "Withdraw Undo Request" : "Request Undo") }}
          </hint>
        </q-btn>

        <!-- Draw Button: offers a draw, or withdraws my offer -->
        <q-btn
          class="draw-button"
          :class="{ 'request-pending': myDraw }"
          @touchstart="vibrate"
          @click="draw"
          v-ripple="false"
          :disable="!canDraw"
          :color="myDraw ? 'primary' : undefined"
          icon="draw"
        >
          <hint v-if="canDraw">
            {{ $t(myDraw ? "Withdraw Draw Offer" : "Offer Draw") }}
          </hint>
        </q-btn>

        <!-- Resign Button -->
        <q-btn
          @touchstart="vibrate"
          class="resign-button"
          @click="resign"
          v-ripple="false"
          :disable="!canResign"
          icon="resign"
        >
          <hint v-if="canResign">
            {{ $t("Resign") }}
          </hint>
        </q-btn>

        <q-separator vertical />

        <!-- Send Button: sends the move that is waiting, and is lit while
             one is. Otherwise it opens the Auto-send switch, as does a
             right-click or long-press. -->
        <q-btn
          class="submit-button"
          :class="{ 'can-send': canSubmit, 'auto-send-mode': isAutoSend }"
          @touchstart="vibrate"
          @click="sendOrMenu"
          v-ripple="false"
          :color="canSubmit ? 'primary' : undefined"
          :icon="!canSubmit && isAutoSend ? 'auto_send' : 'send'"
        >
          <hint v-if="canSubmit">{{ $t("Send Move") }}</hint>
          <hint v-else>
            {{ $t("Auto-send") }}: {{ $t(isAutoSend ? "On" : "Off") }}
          </hint>
          <q-menu
            ref="sendMenu"
            content-class="send-mode-menu"
            context-menu
            transition-show="none"
            transition-hide="none"
            auto-close
            square
          >
            <q-list>
              <q-item @click="toggleSendMode" clickable v-ripple>
                <q-item-section side>
                  <q-icon name="auto_send" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ $t("Auto-send") }}</q-item-label>
                  <q-item-label caption>
                    {{
                      $t(isAutoSend ? "hint.autoSendOn" : "hint.autoSendOff")
                    }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle :value="isAutoSend" class="no-pointer-events" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
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
      // A draw offer or takeback request is being sent or withdrawn
      requesting: false,
    };
  },
  computed: {
    hasEnded() {
      return this.$store.getters["online/hasEnded"];
    },
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
      myRequest: "online/myRequest",
      canRequest: "online/canRequest",
      canRequestTakeback: "online/canRequestTakeback",
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
    // Only once both seats are filled, and until the game ends
    canResign() {
      const current = this.$store.state.online.currentGame;
      const players =
        (current &&
          current.game &&
          current.game.config &&
          current.game.config.players) ||
        [];
      return Boolean(
        this.game &&
          !this.hasEnded &&
          players.length === 2 &&
          players.every(Boolean)
      );
    },
    // My pending draw offer / takeback request
    myDraw() {
      return Boolean(this.myRequest && this.myRequest.type === "draw");
    },
    myTakeback() {
      return Boolean(this.myRequest && this.myRequest.type === "takeback");
    },
    // Offer a draw, or withdraw my offer
    canDraw() {
      return Boolean(!this.requesting && (this.myDraw || this.canRequest));
    },
    // Ask to take back my last sent move, or withdraw that request: only
    // with no unsent move left to undo
    canTakeback() {
      return Boolean(
        !this.requesting &&
          !this.lastUnsentPly &&
          !this.plyInProgress &&
          (this.myTakeback || this.canRequestTakeback)
      );
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
    undoOrTakeback() {
      if (this.canUndo) {
        this.undo();
      } else if (this.canTakeback) {
        this.request("takeback", this.myTakeback);
      }
    },
    draw() {
      if (this.canDraw) {
        this.request("draw", this.myDraw);
      }
    },
    // Make a request, or withdraw mine
    async request(type, withdraw) {
      this.requesting = true;
      try {
        await this.$store.dispatch(
          withdraw ? "online/WITHDRAW_REQUEST" : "online/MAKE_REQUEST",
          type
        );
      } catch (error) {
        // Shown by the action
      } finally {
        this.requesting = false;
      }
    },
    resign() {
      if (this.canResign) {
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
    sendOrMenu(event) {
      const menu = this.$refs.sendMenu;
      if (menu.showing) {
        // A long-press has just opened the switch; don't send as well
        return;
      }
      if (this.canSubmit) {
        this.submit();
      } else {
        // A context menu closes itself on its button's click, so open it
        // once this click is over
        setTimeout(() => menu.show(event));
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

  // Every button shares the width, so none is pushed off a narrow screen
  .q-btn-group {
    width: 100%;
  }
  .q-btn {
    flex: 1 1 0;
    min-width: 0;
    padding-left: 0;
    padding-right: 0;
  }
}
</style>
