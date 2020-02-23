<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    content-class="non-selectable"
    v-bind="$attrs"
  >
    <q-card style="width: 400px" class="bg-secondary">
      <dialog-header>{{ $t("Play Online") }}</dialog-header>

      <smooth-reflow tag="recess" class="col">
        <div class="scroll" style="max-height: calc(100vh - 15rem)">
          <div v-if="this.isLocal">
            <q-list>
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
                  <q-item-label>{{ $t("Private Game") }}</q-item-label>
                  <smooth-reflow>
                    <q-item-label caption v-show="isPrivate">
                      {{ $t("hint.privateGame") }}
                    </q-item-label>
                  </smooth-reflow>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="isPrivate" />
                </q-item-section>
              </q-item>

              <q-item tag="label" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Road Connections") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="showRoads" />
                </q-item-section>
              </q-item>
            </q-list>

            <message-output :error="error" content-class="q-ma-md" />
          </div>

          <div v-else>
            <q-list>
              <q-item v-if="game && game.config.id">
                <q-input
                  class="col-grow"
                  :value="gameURL"
                  :hint="
                    user && game.player(user.uid)
                      ? $t('hint.url')
                      : $t('hint.spectate')
                  "
                  readonly
                  filled
                >
                  <template v-slot:prepend>
                    <q-icon name="link" />
                  </template>
                  <template v-slot:append>
                    <q-btn @click="qrCode(gameURL)" icon="qrcode" dense flat />
                    <q-btn @click="copy(gameURL)" icon="copy" dense flat />
                  </template>
                </q-input>
              </q-item>
            </q-list>
          </div>
        </div>

        <q-inner-loading :showing="loading" />
      </smooth-reflow>

      <q-separator />

      <q-card-actions align="right">
        <template v-if="isLocal">
          <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
          <q-btn
            @click="create"
            :label="$t('Create Online Game')"
            :disabled="!isValid"
            color="accent"
            flat
          />
        </template>
        <template v-else>
          <q-btn :label="$t('Close')" color="accent" flat v-close-popup />
        </template>
      </q-card-actions>
    </q-card>

    <QRCode v-model="showQR" :text="qrText" no-route-dismiss />
  </q-dialog>
</template>

<script>
import QRCode from "./QRCode";
import PlayerName from "../controls/PlayerName";

export default {
  name: "ShareOnline",
  components: { QRCode, PlayerName },
  props: ["value", "game"],
  data() {
    return {
      error: "",
      isValid: false,
      players: [
        { label: this.$t("Player1"), icon: this.playerIcon(1), value: 1 },
        { label: this.$t("Player2"), icon: this.playerIcon(2), value: 2 },
        {
          label: this.$t("Random"),
          icon: "random",
          value: "random"
        }
      ],
      isPrivate: true,
      playerName: this.$store.state.playerName,
      qrText: "",
      loading: false,
      showRoads: false
    };
  },
  computed: {
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
      }
    },
    isLocal() {
      return this.game.isLocal;
    },
    isLoggedIn() {
      return this.user && !this.user.isAnonymous;
    },
    user() {
      return this.$store.state.online.user;
    },
    player: {
      get() {
        return this.$store.state.player;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["player", value]);
      }
    },
    playerBGColor() {
      switch (this.player) {
        case 1:
          return "grey-1";
        case 2:
          return "grey-10";
        default:
          return "accent";
      }
    },
    playerTextColor() {
      switch (this.player) {
        case 2:
          return "grey-1";
        default:
          return "grey-10";
      }
    },
    gameURL() {
      return this.game.isLocal
        ? ""
        : this.$store.getters["online/url"](this.game) || "";
    }
  },
  methods: {
    playerIcon(player) {
      return this.$store.getters.playerIcon(player);
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
        this.$store.dispatch("SET_UI", ["playerName", this.playerName]);
      }

      this.loading = true;
      this.$store
        .dispatch("online/CREATE_GAME", {
          game: this.game,
          players,
          isPrivate: this.isPrivate,
          disableRoads: !this.showRoads
        })
        .then(() => {
          this.loading = false;
        })
        .catch(error => {
          this.loading = false;
          this.error = error;
        });
    },
    copy(text) {
      this.$store.dispatch("COPY", {
        text,
        message: this.$t("Copied")
      });
    },
    qrCode(text) {
      this.qrText = text;
      this.showQR = true;
    }
  },
  watch: {
    isLoggedIn(isLoggedIn) {
      if (isLoggedIn) {
        this.isPrivate = false;
      }
    },
    "$store.state.playerName"(playerName) {
      this.playerName = playerName;
    }
  }
};
</script>
