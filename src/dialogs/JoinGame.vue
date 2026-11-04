<template>
  <small-dialog ref="dialog" :value="true" v-bind="$attrs">
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
          :disable="!validatePlay()"
          @click="play"
          color="primary"
          flat
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import PlayerName from "../components/controls/PlayerName";
import { dismissJoinPrompt } from "../utilities";

export default {
  name: "JoinGame",
  components: { PlayerName },
  data() {
    return {
      isValid: false,
      isJoining: false,
      playerName: this.$store.state.ui.playerName,
    };
  },
  computed: {
    config() {
      return this.$store.state.game.config;
    },
    gameID() {
      return this.config.isOnline ? this.config.id : null;
    },
    openPlayer() {
      return this.$store.getters["game/openPlayer"];
    },
    player() {
      return this.config.player;
    },
    isLocal() {
      return !this.config.isOnline;
    },
    isPrivate() {
      return this.config.isPrivate;
    },
    user() {
      return this.$store.state.online.user;
    },
    isGuest() {
      return !this.user || this.user.isAnonymous;
    },
    isReservedForOther() {
      const reservedFor = this.config.reservedFor;
      return Boolean(
        reservedFor && (!this.user || reservedFor !== this.user.uid)
      );
    },
  },
  methods: {
    close() {
      this.$refs.dialog.hide();
    },
    spectate() {
      this.close();
    },
    play() {
      if (!this.validatePlay()) {
        return;
      }

      const playerName = this.isGuest ? this.playerName.trim() : undefined;
      if (playerName) {
        // Remember a guest's name
        this.$store.dispatch("ui/SET_UI", ["playerName", playerName]);
      }

      this.isJoining = true;
      this.$store
        .dispatch("online/JOIN_GAME", {
          id: this.gameID,
          isPrivate: this.isPrivate,
          playerName,
        })
        .catch((error) => {
          this.notifyError(error);
        });

      this.close();
    },
    validatePlay() {
      if (this.player || !this.openPlayer || this.isReservedForOther) {
        return false;
      }
      if (this.isGuest) {
        // Guests join private games only, under the name they type
        return Boolean(this.isPrivate && this.playerName && this.isValid);
      }
      return true;
    },
  },
  watch: {
    player(player) {
      if (player) {
        this.close();
      }
    },
    isLocal(isLocal) {
      if (isLocal) {
        this.close();
      }
    },
  },
  created() {
    // The game this prompt is for, even if another game is current by the
    // time it closes
    this.promptedGameID = this.gameID;
  },
  mounted() {
    if (this.player || this.isLocal) {
      this.close();
    }
  },
  beforeDestroy() {
    // Closing without joining dismisses the prompt for this game
    if (!this.isJoining && this.promptedGameID) {
      dismissJoinPrompt(this.promptedGameID);
    }
  },
};
</script>
