<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    content-class="non-selectable"
    v-bind="$attrs"
  >
    <q-card style="width: 400px" class="bg-secondary">
      <DialogHeader>{{ $t("Play Online") }}</DialogHeader>

      <SmoothReflow tag="Recess" class="col">
        <div class="scroll" style="max-height: calc(100vh - 18.5rem)">
          <div v-if="this.isLocal">
            <q-list>
              <SmoothReflow class="q-gutter-y-md column no-wrap">
                <q-item v-if="isPrivate || isLoggedIn">
                  <q-item-section>
                    <q-input
                      :value="isPrivate ? playerName : username"
                      @input="playerName = $event"
                      :label="$t('Player Name')"
                      :rules="[validateName]"
                      :hint="
                        $t(
                          'hints.playerName' +
                            (isPrivate ? 'Private' : 'Public')
                        )
                      "
                      @keydown.enter.prevent="create"
                      :readonly="!isPrivate"
                      color="accent"
                      filled
                    >
                      <template v-slot:prepend>
                        <q-icon :name="$store.getters.playerIcon(player)" />
                      </template>
                      <template v-slot:append v-if="!isPrivate && isLoggedIn">
                        <q-btn
                          @click="$store.dispatch('online/LOG_OUT')"
                          :label="$t('Log Out')"
                          color="accent"
                          dense
                          flat
                        />
                      </template>
                    </q-input>
                  </q-item-section>
                </q-item>

                <q-item
                  v-else
                  class="text-accent q-btn full-width"
                  clickable
                  v-ripple
                  :to="{ name: 'login' }"
                >
                  <q-item-section label>
                    {{ $t("Log In") }}
                  </q-item-section>
                </q-item>
              </SmoothReflow>

              <q-item>
                <q-item-section>
                  <q-btn-toggle
                    v-model="player"
                    class="highlight"
                    :toggle-color="playerBGColor"
                    :toggle-text-color="playerTextColor"
                    :options="players"
                    spread
                    dense
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Private Game") }}</q-item-label>
                  <SmoothReflow>
                    <q-item-label caption v-show="isPrivate">
                      {{ $t("hints.privateGame") }}
                    </q-item-label>
                  </SmoothReflow>
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
          </div>

          <div v-else>
            <q-list>
              <q-item v-if="game && game.config.id">
                <q-input
                  class="col-grow"
                  :value="publicURL"
                  :label="$t('Public')"
                  :hint="
                    game.config.playerKey
                      ? $t('hints.public')
                      : $t('hints.spectate')
                  "
                  readonly
                  filled
                >
                  <template v-slot:prepend>
                    <q-icon name="public" />
                  </template>
                  <template v-slot:append>
                    <q-btn
                      @click="qrCode(publicURL)"
                      icon="app:qrcode"
                      color="accent"
                      dense
                      flat
                    />
                    <q-btn
                      @click="copy(publicURL)"
                      icon="file_copy"
                      dense
                      flat
                    />
                  </template>
                </q-input>
              </q-item>
              <q-item v-if="game && game.config.playerKey">
                <q-input
                  class="col-grow"
                  :value="privateURL"
                  :label="$t('Private')"
                  :hint="$t('hints.private')"
                  readonly
                  filled
                >
                  <template v-slot:prepend>
                    <q-icon :name="playerIcon(game.config.player)" />
                  </template>
                  <template v-slot:append>
                    <q-btn
                      @click="qrCode(privateURL)"
                      icon="app:qrcode"
                      color="accent"
                      dense
                      flat
                    />
                    <q-btn
                      @click="copy(privateURL)"
                      icon="file_copy"
                      dense
                      flat
                    />
                  </template>
                </q-input>
              </q-item>
            </q-list>
          </div>
        </div>

        <QInnerLoading :showing="loading" />
      </SmoothReflow>

      <q-separator />

      <q-card-actions align="right">
        <q-btn :label="$t('Close')" color="accent" flat v-close-popup />
        <q-btn
          v-show="isLocal"
          @click="create"
          :label="$t('Create Online Game')"
          :disabled="!isValid"
          color="accent"
          flat
        />
      </q-card-actions>
    </q-card>

    <QRCode v-model="showQR" :text="qrText" />
  </q-dialog>
</template>

<script>
import DialogHeader from "../general/DialogHeader";

import QRCode from "./QRCode";

import { formats } from "../../PTN/Tag";

export default {
  name: "ShareOnline",
  components: { DialogHeader, QRCode },
  props: ["value", "game"],
  data() {
    return {
      players: [
        { label: this.$t("Player1"), icon: this.playerIcon(1), value: 1 },
        { label: this.$t("Player2"), icon: this.playerIcon(2), value: 2 },
        {
          label: this.$t("Random"),
          icon: "casino",
          value: "random"
        }
      ],
      isPrivate: true,
      playerName: this.$store.state.playerName,
      qrText: "",
      loading: false,
      showQR: false,
      showRoads: false
    };
  },
  computed: {
    isLocal() {
      return this.game.isLocal;
    },
    isLoggedIn() {
      return this.user && !this.user.isAnonymous;
    },
    isValid() {
      if (this.isPrivate) {
        return this.validateName(this.playerName) === true;
      } else {
        return this.isLoggedIn;
      }
    },
    user() {
      return this.$store.state.online.user;
    },
    username() {
      return this.$store.getters["online/playerName"]();
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
    publicURL() {
      return this.game.isLocal
        ? ""
        : this.$store.getters["online/url"](this.game) || "";
    },
    privateURL() {
      return this.game.isLocal
        ? ""
        : this.$store.getters["online/url"](this.game, true) || "";
    }
  },
  methods: {
    validateName(value) {
      return (
        formats.player1.test(value.trim()) ||
        this.$t("error['Invalid player name']")
      );
    },
    playerIcon(player) {
      return this.$store.getters.playerIcon(player);
    },
    create() {
      let player = this.player;
      let players = {};

      // Determine player
      if (player === "random") {
        player = Math.round(Math.random() + 1);
      }
      players[player] = this.user.uid;
      if (this.isPrivate) {
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
          this.$store.getters.error(error);
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
        if (!this.playerName) {
          this.playerName = this.username;
        }
      }
    }
  }
};
</script>
