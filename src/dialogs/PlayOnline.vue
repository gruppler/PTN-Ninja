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
          <q-item tag="label" v-ripple>
            <q-item-section>
              <q-item-label>{{ $t("Private Game") }}</q-item-label>
              <q-item-label caption>
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

          <!-- Game Info -->
          <q-expansion-item
            group="options"
            v-model="showGameOptions"
            icon="board"
            :label="$t('Game Options')"
            expand-separator
          >
            <GameInfo
              ref="gameInfo"
              class="q-pa-md"
              :values="tags"
              :show-all="showAll"
              @submit="create"
              @validate="isGameInfoValid = $event"
              hide-missing
            />
          </q-expansion-item>

          <!-- UI Options -->
          <q-expansion-item
            group="options"
            icon="ui"
            :label="$t('UI Options')"
            expand-separator
          >
            <q-item
              v-for="toggle in toggles"
              :key="toggle.key"
              :class="{ 'text-primary': config[toggle.key] }"
              tag="label"
              v-ripple
            >
              <q-item-section class="fg-inherit" side>
                <q-icon :name="toggle.icon" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t(toggle.label) }}</q-item-label>
                <q-item-label v-if="toggle.hint" class="fg-inherit" caption>{{
                  $t(toggle.hint(config[toggle.key]))
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="config[toggle.key]" />
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
      tags[key] = this.$game.tag(key) || "";
    });
    if (
      this.$game.tags.tps ||
      this.$game.board.plyID > 0 ||
      (this.$game.board.plyID === 0 && this.$game.board.plyIsDone)
    ) {
      tags.tps = this.$game.board.tps;
    }

    const toggles = cloneDeep(uiOptions);
    toggles.find((o) => o.key === "scratchboard").hint = (enabled) =>
      enabled ? "hint.scratchboardAllowed" : "hint.scratchboardDenied";

    return {
      config,
      tags,
      toggles,
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
    async create() {
      if (!this.isValid) {
        return;
      }

      try {
        this.loading = true;
        const id = await this.$store.dispatch("online/CREATE_GAME", {
          game: new Game({ tags: this.tags }),
          config: {
            isPrivate: this.config.isPrivate,
            playerSeat: this.config.playerSeat,
            playerName: this.config.isPrivate ? this.config.playerName : "",
            opponentName: this.opponentName,
            scratchboard: this.config.scratchboard,
            flatCounts: this.config.flatCounts,
            showRoads: this.config.showRoads,
            stackCounts: this.config.stackCounts,
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
