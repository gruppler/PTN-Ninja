<template>
  <small-dialog
    ref="dialog"
    :value="true"
    content-class="non-selectable"
    no-backdrop-dismiss
    v-bind="$attrs"
  >
    <template v-slot:header>
      <q-tabs
        v-model="tab"
        active-color="primary"
        indicator-color="primary"
        align="justify"
      >
        <q-tab name="load" :label="$t('Load Game')" />
        <q-tab name="new" :label="$t('New Game')" />
      </q-tabs>
    </template>

    <q-card>
      <smooth-reflow>
        <q-tab-panels v-model="tab" keep-alive animated>
          <q-tab-panel name="load" class="q-pa-none">
            <q-list separator>
              <!-- Clipboard -->
              <q-item @click="clipboard" clickable v-ripple>
                <q-item-section avatar>
                  <q-icon name="clipboard" />
                </q-item-section>
                <q-item-section>{{ $t("Clipboard") }}</q-item-section>
              </q-item>

              <!-- Files -->
              <q-item
                @click="$store.dispatch('ui/OPEN', close)"
                clickable
                v-ripple
              >
                <q-item-section avatar>
                  <q-icon name="browse_fs" />
                </q-item-section>
                <q-item-section>{{ $t("Files") }}</q-item-section>
              </q-item>

              <!-- Online -->
              <q-item :to="{ name: 'load-online' }" replace clickable v-ripple>
                <q-item-section avatar>
                  <q-icon name="online" />
                </q-item-section>
                <q-item-section>{{ $t("Online") }}</q-item-section>
              </q-item>

              <!-- PlayTak Game -->
              <q-item @click="playTak" clickable v-ripple>
                <q-item-section avatar>
                  <q-icon name="playtak" />
                </q-item-section>
                <q-item-section>{{ $tc("PlayTak Game") }}</q-item-section>
              </q-item>
            </q-list>
          </q-tab-panel>

          <q-tab-panel name="new" class="q-pa-none">
            <q-card-section class="q-pa-none">
              <q-btn-toggle
                class="highlight q-mx-md q-mt-md"
                v-model="isOnline"
                :options="modes"
                :ripple="false"
                spread
                dense
              />

              <!-- Online: privacy, names, and seat -->
              <q-list v-if="isOnline" class="q-mt-sm">
                <q-item tag="label" :active="config.isPrivate" v-ripple>
                  <q-item-section class="fg-inherit" side>
                    <q-icon name="online_private" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ $t("Private Game") }}</q-item-label>
                    <q-item-label class="text-primary" caption>
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
              </q-list>

              <GameInfo
                ref="gameInfo"
                class="q-pa-md"
                :values="isOnline ? onlineValues : tags"
                :show-all="showAll"
                :hide-missing="isOnline"
                :tps-edit="!isOnline"
                @validate="isGameInfoValid = $event"
                @submit="
                  isOnline ? createOnlineGame($event) : createGame($event)
                "
                tps-current-btn
              />

              <!-- Online: game assists -->
              <q-expansion-item v-if="isOnline" expand-separator>
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
                    <q-item-label
                      v-if="option.hint"
                      class="fg-inherit"
                      caption
                      >{{ $t(option.hint) }}</q-item-label
                    >
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle v-model="config[option.key]" />
                  </q-item-section>
                </q-item>
              </q-expansion-item>
            </q-card-section>
            <q-inner-loading :showing="loading" />
          </q-tab-panel>
        </q-tab-panels>
      </smooth-reflow>
    </q-card>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <MoreToggle v-show="tab === 'new'" v-model="showAll" />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="isNewOnline ? $t('Create') : $t('OK')"
          @click="ok"
          :disable="tab === 'load'"
          :loading="loading"
          :flat="!isNewOnline || !isOnlineValid"
          color="primary"
        />
      </q-card-actions>
    </template>

    <EditPTN
      v-model="showPTN"
      :ptn="ptn"
      @submit="clipboardCreate"
      no-route-dismiss
    />

    <PlayTakGameID
      v-model="showPlayTakID"
      @submit="close"
      no-route-dismiss
      go-back
    />

    <PlayTakGame
      v-model="showPlayTak"
      @submit="close"
      no-route-dismiss
      go-back
    />
  </small-dialog>
</template>

<script>
import GameInfo from "../components/controls/GameInfo";
import PlayerName from "../components/controls/PlayerName";
import OpponentName from "../components/controls/OpponentName";
import EditPTN from "../dialogs/EditPTN.vue";
import PlayTakGame from "../dialogs/PlayTakGame.vue";
import PlayTakGameID from "../dialogs/PlayTakGameID.vue";
// import GameTable from "../components/controls/GameTable";
import MoreToggle from "../components/controls/MoreToggle.vue";

import Game from "../Game";
import { uiOptions } from "./GameInfo";
import { cloneDeep, omit, pick } from "lodash";

// The tags an online game can be created with
const ONLINE_TAGS = {
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
  round: "",
  event: "",
};

export default {
  name: "AddGame",
  components: {
    GameInfo,
    PlayerName,
    OpponentName,
    EditPTN,
    PlayTakGame,
    PlayTakGameID,
    /* GameTable, */
    MoreToggle,
  },
  data() {
    const user = this.$store.state.online.user;
    const config = cloneDeep(this.$store.state.ui.onlineConfig);
    if (!user || user.isAnonymous) {
      config.isPrivate = true;
    }
    if (!config.playerName) {
      config.playerName = this.$store.state.ui.playerName || "";
    }

    return {
      config,
      uiOptions,
      opponentName: "",
      isPlayerValid: false,
      isOpponentValid: false,
      isGameInfoValid: false,
      loading: false,
      tags: {
        player1: this.$store.state.ui.player1,
        player2: this.$store.state.ui.player2,
        size: String(this.$store.state.ui.size),
        komi: Number(this.$store.state.ui.komi),
        site: this.$t("site_name"),
      },
      ptn: "",
      showAll: false,
    };
  },
  computed: {
    tab: {
      get() {
        return this.$route.params.tab || "new";
      },
      set(tab) {
        this.$router.replace({ params: { tab } });
      },
    },
    isOnline: {
      get() {
        return this.$route.params.type === "online";
      },
      set(isOnline) {
        this.$router.replace({
          params: { tab: "new", type: isOnline ? "online" : undefined },
        });
      },
    },
    isNewOnline() {
      return this.tab === "new" && this.isOnline;
    },
    modes() {
      return [
        { label: this.$t("Local"), value: false },
        { label: this.$t("Online"), value: true },
      ];
    },
    onlineValues() {
      return { ...ONLINE_TAGS, size: this.tags.size, komi: this.tags.komi };
    },
    user() {
      return this.$store.state.online.user;
    },
    isLoggedIn() {
      return this.user && !this.user.isAnonymous;
    },
    players() {
      return [
        { label: this.$t("Player1"), icon: this.playerIcon(1), value: 1 },
        { label: this.$t("Player2"), icon: this.playerIcon(2), value: 2 },
        { label: this.$t("Random"), icon: "random", value: "random" },
      ];
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
    isOnlineValid() {
      return this.isPlayerValid && this.isOpponentValid && this.isGameInfoValid;
    },
    showPTN: {
      get() {
        return this.$route.params.type === "ptn";
      },
      set(show) {
        if (!show && this.showPTN) {
          this.$router.back();
        } else if (show && !this.showPTN) {
          this.$router.push({ params: { type: show ? "ptn" : null } });
        }
      },
    },
    showPlayTak: {
      get() {
        return this.$route.params.type === "playtak-game";
      },
      set(show) {
        if (!show && this.showPlayTak) {
          this.$router.back();
        } else if (show && !this.showPlayTak) {
          this.$router.push({
            params: { type: show ? "playtak-game" : null },
          });
        }
      },
    },
    showPlayTakID: {
      get() {
        return this.$route.params.type === "playtak";
      },
      set(show) {
        if (!show && this.showPlayTakID) {
          this.$router.back();
        } else if (show && !this.showPlayTakID) {
          this.$router.push({ params: { type: show ? "playtak" : null } });
        }
      },
    },
    size: {
      get() {
        return this.$store.state.ui.size;
      },
      set(value) {
        this.tags.size = value;
        this.$store.dispatch("ui/SET_UI", ["size", value || ""]);
      },
    },
    komi: {
      get() {
        return this.$store.state.ui.komi;
      },
      set(value) {
        this.tags.komi = value;
        this.$store.dispatch("ui/SET_UI", ["komi", Number(value) || 0]);
      },
    },
    player1: {
      get() {
        return this.$store.state.ui.player1;
      },
      set(value) {
        this.tags.player1 = value;
        this.$store.dispatch("ui/SET_UI", ["player1", value || ""]);
      },
    },
    player2: {
      get() {
        return this.$store.state.ui.player2;
      },
      set(value) {
        this.tags.player2 = value;
        this.$store.dispatch("ui/SET_UI", ["player2", value || ""]);
      },
    },
  },
  methods: {
    close() {
      this.$refs.dialog.hide();
    },
    playerIcon(player) {
      return this.$store.getters["ui/playerIcon"](player);
    },
    async clipboard() {
      const success = await this.$store.dispatch("game/IMPORT_FROM_CLIPBOARD");
      if (success) {
        this.close();
      }
    },
    async clipboardCreate(ptn) {
      const games = Game.split(ptn);

      const _createGame = (ptn, i) => {
        try {
          const game = new Game({ ptn });
          game.warnings.forEach((warning) => {
            console.log(i, warning);
            this.notifyWarning(warning);
          });
          if (games.length > 1) {
            game.name += " - " + this.$tc("Game x", i + 1);
          }
          games[i] = game;
        } catch (error) {
          console.error(error);
        }
      };

      if (games) {
        games.forEach(_createGame);
      } else {
        _createGame(ptn);
      }

      await this.$store.dispatch("game/ADD_GAMES", { games });
      this.close();
    },
    playTak() {
      this.showPlayTak = true;
    },
    createGame({ name, tags, editTPS }) {
      this.player1 = tags.player1;
      this.player2 = tags.player2;
      this.size = tags.size;
      this.komi = tags.komi;

      let game;
      try {
        game = new Game({ name, tags });
      } catch (error) {
        console.error(error);
      }

      game.warnings.forEach((warning) => this.notifyWarning(warning));

      this.$store.dispatch("game/ADD_GAME", game).then(() => {
        if (editTPS) {
          this.$store.dispatch("ui/SET_UI", [
            "selectedPiece",
            { color: 1, type: "F" },
          ]);
          this.$store.dispatch("ui/SET_UI", ["firstMoveNumber", 1]);
          return this.$store.dispatch("game/EDIT_TPS", "");
        } else {
          this.close();
        }
      });
    },
    async createOnlineGame({ tags }) {
      if (!this.isOnlineValid || this.loading) {
        return;
      }
      tags = pick(tags, Object.keys(ONLINE_TAGS));
      this.size = tags.size;
      this.komi = tags.komi;

      try {
        this.loading = true;
        await this.$store.dispatch("online/CREATE_GAME", {
          config: { ...this.config, opponentName: this.opponentName },
          tags: omit(tags, ["tps"]),
          tps: tags.tps,
        });
        if (!this.isLoggedIn && this.config.playerName) {
          // Remember a guest's name
          this.$store.dispatch("ui/SET_UI", [
            "playerName",
            this.config.playerName.trim(),
          ]);
        }
        this.close();
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.loading = false;
      }
    },
    ok() {
      if (this.tab === "new") {
        this.$refs.gameInfo.submit();
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
