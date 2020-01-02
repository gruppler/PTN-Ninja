<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    content-class="non-selectable"
  >
    <q-card style="width: 400px" class="bg-secondary">
      <DialogHeader>{{ $t("Play Online") }}</DialogHeader>
      <SmoothReflow tag="Recess" class="col">
        <div class="scroll" style="max-height: calc(100vh - 18.5rem)">
          <div v-if="this.isLocal">
            <q-list>
              <q-item>
                <q-item-section>
                  <q-input
                    ref="playerName"
                    v-model="playerName"
                    :label="$t('Player Name')"
                    :rules="[validateName]"
                    :autofocus="!playerName.length"
                    @keydown.enter.prevent="create"
                    input-class="ellipsis"
                    color="accent"
                    hide-bottom-space
                    filled
                  >
                    <template v-slot:prepend>
                      <q-icon :name="playerIcon(player)" />
                    </template>
                  </q-input>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section>
                  <q-btn-toggle
                    v-model="player"
                    :toggle-color="playerBGColor"
                    :toggle-text-color="playerTextColor"
                    :options="players"
                    rounded
                    spread
                    dense
                    push
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Private Game") }}</q-item-label>
                  <SmoothReflow>
                    <q-item-label caption v-show="privateGame">
                      {{ $t("hints.privateGame") }}
                    </q-item-label>
                  </SmoothReflow>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="privateGame" />
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
                  :value="publicCode"
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
                      @click="qrCode(publicCode)"
                      icon="app:qrcode"
                      color="accent"
                      dense
                      flat
                    />
                    <q-btn
                      @click="copy(publicCode)"
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
                  :value="privateCode"
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
                      @click="qrCode(privateCode)"
                      icon="app:qrcode"
                      color="accent"
                      dense
                      flat
                    />
                    <q-btn
                      @click="copy(privateCode)"
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
          :disabled="
            !playerName.length ||
              ($refs.playerName && $refs.playerName.innerError)
          "
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
          icon: this.playerIcon("random"),
          value: "random"
        }
      ],
      playerName: this.$store.state.playerName,
      qrText: "",
      loading: false,
      showQR: false,
      showRoads: false,
      validateName: value => formats.player1.test(value)
    };
  },
  computed: {
    isLocal() {
      return this.game.isLocal;
    },
    player: {
      get() {
        return this.$store.state.player;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["player", value]);
      }
    },
    privateGame: {
      get() {
        return this.$store.state.privateGame;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["privateGame", value]);
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
    publicCode() {
      return this.game.isLocal
        ? ""
        : this.$store.getters["online/url"](this.game) || "";
    },
    privateCode() {
      return this.game.isLocal
        ? ""
        : this.$store.getters["online/url"](this.game, true) || "";
    }
  },
  methods: {
    playerIcon(player) {
      return this.$store.getters.playerIcon(player);
    },
    create() {
      let player = this.player;
      let player1, player2;

      // Remember player name
      if (this.validateName(this.playerName)) {
        this.$store.dispatch("SET_UI", ["playerName", this.playerName]);
      } else {
        return;
      }

      // Determine player
      if (player === "random") {
        player = Math.round(Math.random() + 1);
      }
      if (player === 1) {
        player1 = this.playerName;
        player2 = "";
      } else {
        player2 = this.playerName;
        player1 = "";
      }

      this.loading = true;
      this.$store.dispatch("online/CREATE_GAME", {
        game: this.game,
        tags: {
          player1,
          player2,
          rating1: "",
          rating2: ""
        },
        config: {
          isOnline: true,
          isUnlisted: this.privateGame,
          disableRoads: !this.showRoads,
          player
        }
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
    value(isVisible) {
      if (isVisible) {
        this.playerName = this.$store.state.playerName;
      }
    },
    isLocal() {
      this.loading = false;
    }
  }
};
</script>
