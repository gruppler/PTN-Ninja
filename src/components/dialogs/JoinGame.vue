<template>
  <small-dialog :value="value" @input="$emit('input', $event)" v-bind="$attrs">
    <template v-slot:header>
      <dialog-header>{{ $t("Join Game") }}</dialog-header>
    </template>

    <q-card style="width: 300px">
      <q-card-section>
        <PlayerName
          ref="playerName"
          v-model="playerName"
          :player="player || openPlayer"
          :is-private="isPrivate"
          @validate="isValid = $event"
        />
      </q-card-section>
    </q-card>

    <template v-slot:footer>
      <q-separator />

      <q-card-actions align="right">
        <q-btn :label="$t('Spectate')" @click="spectate" color="primary" flat />
        <q-btn
          :label="$t('Play')"
          :disabled="!validatePlay()"
          @click="play"
          color="primary"
          flat
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import PlayerName from "../controls/PlayerName";

export default {
  name: "JoinGame",
  components: { PlayerName },
  props: ["value", "game"],
  data() {
    return {
      isValid: false,
      playerName: this.$store.state.ui.playerName,
    };
  },
  computed: {
    openPlayer() {
      return this.game.openPlayer;
    },
    player() {
      const user = this.$store.state.online.user;
      return user ? this.game.player(user.uid) : 0;
    },
    isPrivate() {
      return this.game.config.isPrivate;
    },
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    spectate() {
      this.close();
    },
    play() {
      if (!this.validatePlay()) {
        return;
      }

      if (this.isPrivate) {
        // Remember player name
        this.$store.dispatch("SET_UI", ["playerName", this.playerName]);
      }

      // Join game
      this.$store.dispatch("online/JOIN_GAME", this.game).catch((error) => {
        this.$store.dispatch("NOTIFY_ERROR", error);
      });

      this.close();
    },
    validatePlay() {
      return !this.player && this.openPlayer && this.playerName && this.isValid;
    },
  },
  watch: {
    value(visible) {
      if (visible) {
        this.playerName = this.$store.state.ui.playerName;
      }
    },
    player(player) {
      if (player) {
        this.close();
      }
    },
    "game.isLocal"(isLocal) {
      if (isLocal) {
        this.close();
      }
    },
  },
};
</script>
