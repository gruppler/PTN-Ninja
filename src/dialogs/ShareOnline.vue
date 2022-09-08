<template>
  <small-dialog :value="true" content-class="non-selectable" v-bind="$attrs">
    <template v-slot:header>
      <dialog-header icon="online">{{ $t("Play Online") }}</dialog-header>
    </template>

    <q-card>
      <smooth-reflow tag="recess" class="col">
        <div v-if="isLocal">
          <q-list>
            <q-item>
              <q-item-section>
                <q-btn-toggle
                  v-model="config.playerSeat"
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

            <q-item>
              <q-item-section>
                <PlayerName
                  v-model="config.playerName"
                  :player="config.playerSeat"
                  :is-private="config.isPrivate"
                  @validate="isPlayerValid = $event"
                />
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section>
                <OpponentName
                  v-model="opponentName"
                  :player="opponent"
                  :is-private="config.isPrivate"
                  @validate="isOpponentValid = $event"
                  :error="!isOpponentValid"
                  :error-message="$t('error[\'Invalid opponent name\']')"
                />
              </q-item-section>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Private Game") }}</q-item-label>
                <q-item-label caption>
                  {{
                    $t(
                      "hint." +
                        (config.isPrivate ? "privateGame" : "publicGame")
                    )
                  }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="config.isPrivate" />
              </q-item-section>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Allow Scratchboard") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="config.allowScratchboard" />
              </q-item-section>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="config.flatCounts" />
              </q-item-section>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Road Connections") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="config.showRoads" />
              </q-item-section>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Stack Counts") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="config.stackCounts" />
              </q-item-section>
            </q-item>
          </q-list>
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

      <message-output :error="error" content-class="q-ma-md" />

      <q-card-actions align="right">
        <template v-if="isLocal">
          <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
          <q-btn
            @click="create"
            :label="$t('Create Online Game')"
            :disabled="!isPlayerValid || !isOpponentValid"
            :loading="loading"
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
import OpponentName from "../components/controls/OpponentName";

import { cloneDeep } from "lodash";

export default {
  name: "ShareOnline",
  components: { PlayerName, OpponentName },
  data() {
    const user = this.$store.state.online.user;
    const config = cloneDeep(this.$store.state.ui.onlineConfig);
    if (!user || user.isAnonymous) {
      config.isPrivate = true;
    }
    return {
      config,
      error: "",
      isPlayerValid: false,
      isOpponentValid: false,
      opponentName: "",
      qrText: "",
      loading: false,
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
    opponent() {
      return this.config.playerSeat === "random"
        ? this.config.playerSeat
        : this.config.playerSeat === 1
        ? 2
        : 1;
    },
    playerBGColor() {
      switch (this.config.playerSeat) {
        case 1:
          return "player1";
        case 2:
          return "player2";
        default:
          return "primary";
      }
    },
    playerTextColor() {
      switch (this.config.playerSeat) {
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
    async create() {
      if (!this.isPlayerValid || !this.isOpponentValid) {
        return;
      }

      try {
        this.error = null;
        this.loading = true;
        await this.$store.dispatch("online/CREATE_GAME", {
          game: this.$game,
          config: {
            isPrivate: this.config.isPrivate,
            playerSeat: this.config.playerSeat,
            playerName: this.config.isPrivate ? this.config.playerName : "",
            opponentName: this.opponentName,
            allowScratchboard: this.config.allowScratchboard,
            flatCounts: this.config.flatCounts,
            showRoads: this.config.showRoads,
            stackCounts: this.config.stackCounts,
          },
        });
      } catch (error) {
        this.error = error;
      } finally {
        this.loading = false;
      }
    },
    copy(text) {
      this.$store.dispatch("ui/COPY", { text, title: "URL" });
    },
    qrCode(text) {
      this.$router.push({ name: "qr", params: { text } });
    },
  },
  watch: {
    isLoggedIn(isLoggedIn) {
      if (isLoggedIn) {
        this.config.isPrivate = false;
      }
    },
    config: {
      handler(config) {
        this.$store.dispatch("ui/SET_UI", ["onlineConfig", cloneDeep(config)]);
      },
      deep: true,
    },
  },
};
</script>
