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
             request. It's lit while a request is pending; the opponent's
             opens Accept and Decline. -->
        <q-btn
          class="undo-button"
          :class="{
            'request-pending': myTakeback,
            'opponent-request': theirTakeback,
          }"
          @touchstart="vibrate"
          @click="undoOrTakeback"
          @shortkey="undo"
          v-shortkey="hotkeys.undo"
          v-ripple="false"
          :disable="!canUndo && !canTakeback && !theirTakeback"
          :loading="busy === 'takeback'"
          :color="isTakebackLit ? 'primary' : undefined"
          :icon="isTakebackShown ? 'undo_request' : 'undo'"
        >
          <hint v-if="theirTakeback">{{ requestMessage }}</hint>
          <hint v-else-if="canUndo">
            {{ $t("Undo") }}
          </hint>
          <hint v-else-if="canTakeback">
            {{ $t(myTakeback ? "Withdraw Undo Request" : "Request Undo") }}
          </hint>
          <q-menu
            v-if="theirTakeback"
            content-class="request-menu takeback-request-menu"
            transition-show="none"
            transition-hide="none"
            auto-close
            square
          >
            <q-list>
              <q-item-label header>{{ requestMessage }}</q-item-label>
              <q-item
                class="accept-request"
                @click="answer('ACCEPT_REQUEST')"
                clickable
                v-ripple
              >
                <q-item-section side>
                  <q-icon name="check" />
                </q-item-section>
                <q-item-section>{{ $t("Accept") }}</q-item-section>
              </q-item>
              <q-item
                class="decline-request"
                @click="answer('DECLINE_REQUEST')"
                clickable
                v-ripple
              >
                <q-item-section side>
                  <q-icon name="close" />
                </q-item-section>
                <q-item-section>{{ $t("Decline") }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <!-- Draw Button: offers a draw, or withdraws my offer. It's lit
             while an offer is pending; the opponent's opens Accept and
             Decline. -->
        <q-btn
          class="draw-button"
          :class="{ 'request-pending': myDraw, 'opponent-request': theirDraw }"
          @touchstart="vibrate"
          @click="draw"
          v-ripple="false"
          :disable="!canDraw && !theirDraw"
          :loading="busy === 'draw'"
          :color="myDraw || theirDraw ? 'primary' : undefined"
          icon="draw"
        >
          <hint v-if="theirDraw">{{ requestMessage }}</hint>
          <hint v-else-if="canDraw">
            {{ $t(myDraw ? "Withdraw Draw Offer" : "Offer Draw") }}
          </hint>
          <q-menu
            v-if="theirDraw"
            content-class="request-menu draw-request-menu"
            transition-show="none"
            transition-hide="none"
            auto-close
            square
          >
            <q-list>
              <q-item-label header>{{ requestMessage }}</q-item-label>
              <q-item
                class="accept-request"
                @click="answer('ACCEPT_REQUEST')"
                clickable
                v-ripple
              >
                <q-item-section side>
                  <q-icon name="check" />
                </q-item-section>
                <q-item-section>{{ $t("Accept") }}</q-item-section>
              </q-item>
              <q-item
                class="decline-request"
                @click="answer('DECLINE_REQUEST')"
                clickable
                v-ripple
              >
                <q-item-section side>
                  <q-icon name="close" />
                </q-item-section>
                <q-item-section>{{ $t("Decline") }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
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
             one is. Otherwise it switches Auto-send on or off, as does a
             right-click or long-press. -->
        <q-btn
          class="submit-button"
          :class="{
            'can-send': canSubmit,
            sending: isSending,
            'auto-send-mode': isAutoSend,
          }"
          @touchstart="touchSend"
          @click="sendOrToggle"
          @contextmenu.prevent="toggleSendMode(true)"
          v-ripple="false"
          :loading="isSending"
          :color="canSubmit || isSending ? 'primary' : undefined"
          :icon="!canSubmit && isAutoSend ? 'auto_send' : 'send'"
        >
          <hint v-if="isSending">{{ $t("Sending") }}</hint>
          <hint v-else-if="canSubmit">{{ $t("Send Move") }}</hint>
          <hint v-else>
            {{ $t("Auto-send") }}: {{ $t(isAutoSend ? "On" : "Off") }}
          </hint>
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
      // The type of the request ("draw" or "takeback") being made, withdrawn
      // or answered, until the game reflects it
      busy: null,
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
      pendingRequest: "online/pendingRequest",
      myRequest: "online/myRequest",
      opponentRequest: "online/opponentRequest",
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
    // The opponent's pending draw offer / takeback request, mine to answer
    theirDraw() {
      return Boolean(
        this.opponentRequest && this.opponentRequest.type === "draw"
      );
    },
    theirTakeback() {
      return Boolean(
        this.opponentRequest && this.opponentRequest.type === "takeback"
      );
    },
    requestMessage() {
      const request = this.opponentRequest;
      if (!request) {
        return "";
      }
      const current = this.$store.state.online.currentGame;
      const tags = (current && current.game && current.game.tags) || {};
      const key = `player${request.player}`;
      return this.$t(`request.${request.type}Requested`, {
        player: tags[key] || this.$t(key === "player1" ? "Player1" : "Player2"),
      });
    },
    // Offer a draw, or withdraw my offer
    canDraw() {
      return Boolean(!this.busy && (this.myDraw || this.canRequest));
    },
    // Whether a takeback of mine can be asked for or withdrawn: only with no
    // unsent move left to undo
    hasTakeback() {
      return Boolean(
        !this.lastUnsentPly &&
          !this.plyInProgress &&
          (this.myTakeback || this.canRequestTakeback)
      );
    },
    canTakeback() {
      return Boolean(!this.busy && this.hasTakeback);
    },
    // Whether the Undo button stands for a takeback rather than a local
    // undo, and whether it's lit for a pending one
    isTakebackShown() {
      return Boolean(
        this.theirTakeback ||
          this.busy === "takeback" ||
          (!this.canUndo && this.hasTakeback)
      );
    },
    isTakebackLit() {
      return Boolean(
        this.theirTakeback || (this.myTakeback && this.isTakebackShown)
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
      if (this.theirTakeback) {
        // Its menu opens
        return;
      }
      if (this.canUndo) {
        this.undo();
      } else if (this.canTakeback) {
        this.request("takeback", this.myTakeback);
      }
    },
    draw() {
      if (!this.theirDraw && this.canDraw) {
        this.request("draw", this.myDraw);
      }
    },
    // Make a request, or withdraw mine
    request(type, withdraw) {
      return this.callRequest(
        type,
        withdraw ? "WITHDRAW_REQUEST" : "MAKE_REQUEST",
        type
      );
    },
    // Accept or decline the opponent's request
    answer(action) {
      if (this.opponentRequest) {
        return this.callRequest(this.opponentRequest.type, action);
      }
    },
    // The button of the request's type is busy until the game reflects the
    // outcome, which can arrive a moment after the server answers
    async callRequest(type, action, payload) {
      if (this.busy) {
        return;
      }
      const before = this.pendingRequest;
      this.busy = type;
      try {
        await this.$store.dispatch(`online/${action}`, payload);
      } catch (error) {
        // Shown by the action
        this.busy = null;
        return;
      }
      if (this.pendingRequest !== before) {
        this.busy = null;
      } else {
        clearTimeout(this.busyTimer);
        this.busyTimer = setTimeout(() => {
          this.busy = null;
        }, 5000);
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
    // Switch Auto-send on or off, saying which it now is
    toggleSendMode(isContextMenu) {
      if (isContextMenu === true && Date.now() - this.sendTouched < 2000) {
        // A long-press can end in a click; don't let it switch back or send
        clearTimeout(this.toggledTimer);
        this.justToggled = true;
        this.toggledTimer = setTimeout(() => {
          this.justToggled = false;
        }, 1000);
      }
      const isAutoSend = !this.isAutoSend;
      this.$store.dispatch("ui/SET_UI", [
        "onlineSendMode",
        isAutoSend ? "auto" : "submit",
      ]);
      this.$store.dispatch("ui/NOTIFY", {
        id: "send-mode",
        icon: isAutoSend ? "auto_send" : "send",
        message: `${this.$t("Auto-send")}: ${this.$t(
          isAutoSend ? "On" : "Off"
        )}`,
        caption: this.$t(isAutoSend ? "hint.autoSendOn" : "hint.autoSendOff"),
        timeout: 2500,
      });
    },
    submit() {
      if (this.canSubmit) {
        this.$store.dispatch("online/SEND_PLY");
      }
    },
    touchSend() {
      this.sendTouched = Date.now();
      this.vibrate();
    },
    sendOrToggle() {
      if (this.justToggled) {
        return;
      }
      if (this.canSubmit) {
        this.submit();
      } else if (!this.isSending) {
        this.toggleSendMode();
      }
    },
  },
  watch: {
    pendingRequest() {
      clearTimeout(this.busyTimer);
      this.busy = null;
    },
    hasEnded() {
      clearTimeout(this.busyTimer);
      this.busy = null;
    },
  },
  beforeDestroy() {
    clearTimeout(this.busyTimer);
    clearTimeout(this.toggledTimer);
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
