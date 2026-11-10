<template>
  <q-toolbar
    v-if="request"
    class="online-request bg-ui"
    :class="{ 'opponent-request': !isMine }"
  >
    <div class="row no-wrap items-center justify-center full-width">
      <q-icon
        :name="request.type === 'draw' ? 'draw' : 'undo'"
        size="sm"
        class="q-mr-sm"
      />
      <div class="request-message ellipsis q-mr-sm">{{ message }}</div>
      <q-btn
        v-if="isMine"
        class="withdraw-request"
        @click="send('WITHDRAW_REQUEST')"
        :label="$t('Withdraw')"
        :disable="busy"
        flat
        dense
      />
      <template v-else>
        <q-btn
          class="accept-request"
          @click="send('ACCEPT_REQUEST')"
          :label="$t('Accept')"
          :disable="busy"
          color="primary"
          flat
          dense
        />
        <q-btn
          class="decline-request"
          @click="send('DECLINE_REQUEST')"
          :label="$t('Decline')"
          :disable="busy"
          flat
          dense
        />
      </template>
    </div>
  </q-toolbar>
</template>

<script>
// The pending draw offer or takeback request of an online game, shown to
// its players in place: the opponent's with Accept and Decline, my own with
// Withdraw
export default {
  name: "OnlineRequest",
  data() {
    return {
      busy: false,
    };
  },
  computed: {
    myRequest() {
      return this.$store.getters["online/myRequest"];
    },
    request() {
      return this.myRequest || this.$store.getters["online/opponentRequest"];
    },
    isMine() {
      return Boolean(this.myRequest);
    },
    // The name of the player who made the opponent's request
    player() {
      const current = this.$store.state.online.currentGame;
      const tags = (current && current.game && current.game.tags) || {};
      const key = `player${this.request.player}`;
      return tags[key] || this.$t(key === "player1" ? "Player1" : "Player2");
    },
    message() {
      const key = this.request.type + (this.isMine ? "Pending" : "Requested");
      return this.$t(`request.${key}`, { player: this.player });
    },
  },
  methods: {
    async send(action) {
      if (this.busy) {
        return;
      }
      this.busy = true;
      try {
        await this.$store.dispatch(`online/${action}`);
      } catch (error) {
        // Shown by the action
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style lang="scss">
.online-request {
  min-height: 40px;
  .row {
    max-width: 500px;
    margin: 0 auto;
  }
}
</style>
