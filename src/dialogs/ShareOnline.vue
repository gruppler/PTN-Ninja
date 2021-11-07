<template>
  <small-dialog :value="true" content-class="non-selectable" v-bind="$attrs">
    <template v-slot:header>
      <dialog-header icon="online">{{ $t("Play Online") }}</dialog-header>
    </template>

    <q-card style="width: 330px">
      <smooth-reflow tag="recess" class="col">
        <div v-if="isLocal">
          <q-list>
            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Private Game") }}</q-item-label>
                <smooth-reflow>
                  <q-item-label caption v-show="isPrivate">
                    {{ $t("hint.privateGame") }}
                  </q-item-label>
                </smooth-reflow>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="isPrivate" />
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section>
                <PlayerName
                  ref="playerName"
                  v-model="playerName"
                  :player="player"
                  :is-private="isPrivate"
                  @validate="isValid = $event"
                />
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section>
                <q-btn-toggle
                  v-model="player"
                  class="highlight"
                  :toggle-color="playerBGColor"
                  :toggle-text-color="playerTextColor"
                  :options="players"
                  :ripple="false"
                  spread
                  dense
                  stack
                />
              </q-item-section>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="flatCounts" />
              </q-item-section>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Road Connections") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="showRoads" />
              </q-item-section>
            </q-item>
          </q-list>

          <message-output :error="error" content-class="q-ma-md" />
        </div>

        <div v-else>
          <q-list>
            <q-item v-if="config.id">
              <q-input
                class="col-grow"
                :value="gameURL"
                :hint="isSpectator ? $t('hint.spectate') : $t('hint.url')"
                readonly
                filled
              >
                <template v-slot:prepend>
                  <q-icon name="link" />
                </template>
                <template v-slot:append>
                  <q-icon
                    @click="qrCode(gameURL)"
                    name="qrcode"
                    class="q-field__focusable-action"
                  />
                  <q-icon
                    @click="copy(gameURL)"
                    name="copy"
                    class="q-field__focusable-action"
                  />
                </template>
              </q-input>
            </q-item>
          </q-list>
        </div>

        <q-inner-loading :showing="loading" />
      </smooth-reflow>
    </q-card>

    <template v-slot:footer>
      <q-separator />

      <q-card-actions align="right">
        <template v-if="isLocal">
          <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
          <q-btn
            @click="create"
            :label="$t('Create Online Game')"
            :disabled="!isValid"
            color="primary"
            flat
          />
        </template>
        <template v-else>
          <q-btn :label="$t('Close')" color="primary" flat v-close-popup />
        </template>
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import PlayerName from "../components/controls/PlayerName";

export default {
  name: "ShareOnline",
  components: { PlayerName },
  data() {
    return {
      error: "",
      isValid: false,
      isPrivate: true,
      playerName: this.$store.state.ui.playerName,
      qrText: "",
      loading: false,
      flatCounts: false,
      showRoads: false,
    };
  },
  computed: {
    players() {
      return [
        { label: this.$t("Player1"), icon: this.playerIcon(1), value: 1 },
        { label: this.$t("Player2"), icon: this.playerIcon(2), value: 2 },
        {
          label: this.$t("Random"),
          icon: "random",
          value: "random",
        },
      ];
    },
    showQR: {
      get() {
        return !!this.$route.params.qr;
      },
      set(value) {
        if (value) {
          if (!this.$route.params.qr) {
            this.$router.push({ params: { qr: "qr" } });
          }
        } else {
          if (this.$route.params.qr) {
            this.$router.go(-1);
            this.$router.replace({ params: { qr: null } });
          }
        }
      },
    },
    isLocal() {
      return this.$game.isLocal;
    },
    isLoggedIn() {
      return this.user && !this.user.isAnonymous;
    },
    user() {
      return this.$store.state.online.user;
    },
    isSpectator() {
      return !this.user || !this.$game.getPlayerFromUID(this.user.id);
    },
    player: {
      get() {
        return this.$store.state.ui.player;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["player", value]);
      },
    },
    playerBGColor() {
      switch (this.player) {
        case 1:
          return "player1";
        case 2:
          return "player2";
        default:
          return "primary";
      }
    },
    playerTextColor() {
      switch (this.player) {
        case 1:
          return "player2";
        case 2:
          return "player1";
        default:
          return "textDark";
      }
    },
    gameURL() {
      return this.$game.isLocal
        ? ""
        : this.$store.getters["ui/url"](this.$game) || "";
    },
  },
  methods: {
    playerIcon(player) {
      return this.$store.getters["ui/playerIcon"](player);
    },
    create() {
      if (!this.isValid) {
        return;
      }

      let player = this.player;
      let players = {};

      // Determine player
      if (player === "random") {
        player = Math.round(Math.random() + 1);
      }
      players[player] = this.user.uid;

      if (this.isPrivate) {
        // Remember player name
        this.$store.dispatch("ui/SET_UI", ["playerName", this.playerName]);
      }

      this.loading = true;
      this.$store
        .dispatch("online/CREATE_GAME", {
          game: this.$game,
          players,
          isPrivate: this.isPrivate,
          disableFlatCounts: !this.flatCounts,
          disableShowRoads: !this.showRoads,
        })
        .then(() => {
          this.loading = false;
        })
        .catch((error) => {
          this.loading = false;
          this.error = error;
        });
    },
    copy(text) {
      this.$store.dispatch("ui/COPY", {
        text,
        message: this.$t("Copied"),
      });
    },
    qrCode(text) {
      this.$router.push({ name: "qr", params: { text } });
    },
  },
  watch: {
    isLoggedIn(isLoggedIn) {
      if (isLoggedIn) {
        this.isPrivate = false;
      }
    },
    "$store.state.ui.playerName"(playerName) {
      this.playerName = playerName;
    },
  },
};
</script>
