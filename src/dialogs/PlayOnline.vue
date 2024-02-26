<template>
  <small-dialog
    ref="dialog"
    :value="true"
    content-class="non-selectable"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="players" :title="$t('Play Online')">
        <template v-slot:buttons>
          <!-- Online Games -->
          <q-btn icon="online" :to="{ name: 'load-online' }" replace dense flat>
            <hint>{{ $tc("Online Game", 100) }}</hint>
          </q-btn>
        </template>
      </dialog-header>
    </template>

    <q-card style="width: 350px; max-width: 100%">
      <smooth-reflow tag="recess" class="col">
        <q-list>
          <q-item tag="label" :active="config.isPrivate" v-ripple>
            <q-item-section class="fg-inherit" side>
              <q-icon name="online_private" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $t("Private Game") }}</q-item-label>
              <q-item-label class="text-primary" caption>
                {{
                  $t(
                    "hint." + (config.isPrivate ? "privateGame" : "publicGame")
                  )
                }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="config.isPrivate" />
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

          <q-item>
            <q-item-section>
              <q-btn-toggle
                class="highlight"
                v-model="config.playerSeat"
                :options="players"
                :ripple="false"
                spread
                dense
                stack
              />
            </q-item-section>
          </q-item>

          <!-- Game Info -->
          <q-expansion-item
            group="options"
            v-model="showGameOptions"
            icon="board"
            :label="$t('Game Options')"
            expand-separator
          >
            <div>
              <GameInfo
                ref="gameInfo"
                class="q-pa-md"
                :values="tags"
                :show-all="showAll"
                @submit="create"
                @validate="isGameInfoValid = $event"
                tps-current-btn
                hide-missing
              />
            </div>
          </q-expansion-item>

          <!-- UI Options -->
          <q-expansion-item group="options" expand-separator>
            <template v-slot:header>
              <q-item-section avatar>
                <q-icon name="ui" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("UI Options") }}</q-item-label>
              </q-item-section>
              <q-item-section v-if="uiOptionsEnabled.length" side>
                <div class="row justify-end q-gutter-xs fg-inherit">
                  <q-icon
                    v-for="o in uiOptionsEnabled"
                    :key="o.key"
                    :name="o.icon"
                    color="primary"
                    size="sm"
                  >
                    <hint>{{ $t(o.label) }}</hint>
                  </q-icon>
                </div>
              </q-item-section>
            </template>
            <q-item
              v-for="option in uiOptions"
              :key="option.key"
              :class="{ 'text-primary': config[option.key] }"
              tag="label"
              v-ripple
            >
              <q-item-section class="fg-inherit" side>
                <q-icon :name="option.icon" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t(option.label) }}</q-item-label>
                <q-item-label v-if="option.hint" class="fg-inherit" caption>{{
                  $t(option.hint)
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="config[option.key]" />
              </q-item-section>
            </q-item>
          </q-expansion-item>
        </q-list>

        <q-inner-loading :showing="loading" />
      </smooth-reflow>
    </q-card>

    <template v-slot:footer>
      <q-separator />

      <q-card-actions align="right">
        <MoreToggle v-show="showGameOptions" v-model="showAll" />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          @click="submit"
          :label="$t('Create')"
          :disabled="!isValid"
          :loading="loading"
          color="primary"
          flat
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import PlayerName from "../components/controls/PlayerName";
import OpponentName from "../components/controls/OpponentName";
import GameInfo from "../components/controls/GameInfo";
import MoreToggle from "../components/controls/MoreToggle.vue";

import Game from "../Game";

import { uiOptions } from "./GameInfo";
import { cloneDeep } from "lodash";

const TAGS = {
  size: "",
  tps: "",
  komi: "",
  opening: "",
  flats: "",
  caps: "",
  flats1: "",
  caps1: "",
  flats2: "",
  caps2: "",
  // clock: "",
  round: "",
  event: "",
};

export default {
  name: "PlayOnline",
  components: { PlayerName, OpponentName, GameInfo, MoreToggle },
  data() {
    const user = this.$store.state.online.user;
    const config = cloneDeep(this.$store.state.ui.onlineConfig);
    if (!user || user.isAnonymous) {
      config.isPrivate = true;
    }

    const tags = { ...TAGS };
    Object.keys(TAGS).forEach((key) => {
      const tag = this.$store.state.game.ptn.tags[key];
      tags[key] = tag ? tag.text || tag.toString() : "";
    });

    return {
      config,
      tags,
      uiOptions,
      isPlayerValid: false,
      isOpponentValid: false,
      isGameInfoValid: false,
      opponentName: "",
      showGameOptions: true,
      showAll: false,
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
    isLoggedIn() {
      return this.user && !this.user.isAnonymous;
    },
    user() {
      return this.$store.state.online.user;
    },
    opponent() {
      return this.config.playerSeat === "random"
        ? this.config.playerSeat
        : this.config.playerSeat === 1
        ? 2
        : 1;
    },
    uiOptionsEnabled() {
      return this.uiOptions.filter((option) => this.config[option.key]);
    },
    isValid() {
      return this.isPlayerValid && this.isOpponentValid && this.isGameInfoValid;
    },
  },
  methods: {
    close() {
      this.$refs.dialog.hide();
    },
    playerIcon(player) {
      return this.$store.getters["ui/playerIcon"](player);
    },
    submit() {
      this.$refs.gameInfo.submit();
    },
    async create({ tags }) {
      if (!this.isValid) {
        return;
      }

      try {
        this.loading = true;
        const game = new Game({ tags });
        const id = await this.$store.dispatch("online/CREATE_GAME", {
          game,
          config: {
            ...this.config,
            playerName: this.config.isPrivate ? this.config.playerName : "",
            opponentName: this.opponentName,
          },
        });
        await this.$store.dispatch("online/LOAD_GAME", {
          id,
          isPrivate: this.config.isPrivate,
        });
        this.close();
      } catch (error) {
        this.$store.dispatch("ui/NOTIFY_ERROR", error);
      } finally {
        this.loading = false;
      }
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
