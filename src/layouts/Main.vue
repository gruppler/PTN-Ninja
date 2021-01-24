<template>
  <q-layout v-if="game" class="non-selectable" view="lHr LpR lFr">
    <q-header elevated class="bg-ui">
      <q-toolbar class="q-pa-none">
        <q-btn
          icon="moves"
          @click="showPTN = !showPTN"
          :color="showPTN ? 'primary' : ''"
          stretch
          flat
        />
        <q-toolbar-title class="q-pa-none">
          <GameSelector ref="gameSelector">
            <q-icon
              v-if="game.isLocal || player"
              name="edit"
              @click.stop="edit"
              class="q-field__focusable-action q-mr-sm"
            />
          </GameSelector>
        </q-toolbar-title>
        <q-btn
          :icon="
            textTab === 'notes' ? (notifyNotes ? 'notes' : 'notes_off') : 'chat'
          "
          @click.left="showText = !showText"
          @click.right.prevent="notifyNotes = !notifyNotes"
          :color="showText ? 'primary' : ''"
          stretch
          flat
        />
      </q-toolbar>
    </q-header>

    <q-page-container
      class="bg-bg"
      v-shortkey="hotkeys.UI"
      @shortkey="
        if (!disabledOptions.includes($event.srcKey))
          $store.dispatch('ui/TOGGLE_UI', $event.srcKey);
      "
    >
      <q-page
        v-shortkey="hotkeys.ACTIONS"
        @shortkey="$store.dispatch($event.srcKey, game)"
        class="overflow-hidden"
      >
        <div
          class="column absolute-fit"
          v-shortkey="hotkeys.MISC"
          @shortkey="miscShortkey"
        >
          <Board ref="board" class="col-grow" />
          <div
            @click.right.self.prevent="$refs.board.resetBoardRotation"
            class="board-move-container"
          >
            <Move
              v-if="game.state.move"
              v-show="game.state.ply && $store.state.ui.showMove"
              class="q-mb-md q-mx-md"
              :class="{ 'lt-sm': $store.state.ui.showPTN }"
              :move="game.state.move"
              separate-branch
              current-only
              standalone
            />
          </div>
        </div>
        <q-page-sticky position="bottom-right" :offset="[18, 18]">
          <Menu @input="menuAction" @click.right.prevent="switchGame" />
        </q-page-sticky>
        <q-page-sticky position="top-left" :offset="[18, 18]">
          <BoardToggles
            v-if="$route.name !== 'embed' && !isGamesTableShowing"
          />
        </q-page-sticky>
      </q-page>
    </q-page-container>

    <q-drawer
      id="left-drawer"
      v-model="showPTN"
      side="left"
      :breakpoint="showText ? $q.screen.sizes.lg : $q.screen.sizes.sm"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <div class="absolute-fit column">
        <PTN-Tools ref="tools">
          <ShareButton ref="shareButton" :title="$t('Share')" />
        </PTN-Tools>
        <div class="col-grow relative-position">
          <PTN class="absolute-fit" />
        </div>
        <q-toolbar class="footer-toolbar bg-ui q-pa-none">
          <q-btn-group spread stretch flat unelevated>
            <q-btn
              @click="$store.dispatch('game/UNDO', game)"
              icon="undo"
              :title="$t('Undo')"
              :disabled="isEditingTPS || !game.canUndo"
            />
            <q-btn
              @click="$store.dispatch('game/REDO', game)"
              icon="redo"
              :title="$t('Redo')"
              :disabled="isEditingTPS || !game.canRedo"
            />
          </q-btn-group>
          <EvalButtons class="full-width" spread stretch flat unelevated />
        </q-toolbar>
      </div>
      <div class="gt-sm absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-drawer
      id="right-drawer"
      v-model="showText"
      side="right"
      :breakpoint="showPTN ? $q.screen.sizes.lg : $q.screen.sizes.sm"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <div class="absolute-fit column">
        <q-tabs
          v-if="hasChat"
          class="bg-ui text-weight-medium"
          :value="textTab"
          @input="showTextTab"
          active-color="primary"
          indicator-color="primary"
          align="justify"
        >
          <q-tab name="notes">{{ $t("Notes") }}</q-tab>
          <q-tab name="chat">{{ $t("Chat") }}</q-tab>
        </q-tabs>
        <q-toolbar
          v-else
          class="bg-ui text-weight-medium justify-center text-uppercase"
        >
          {{ $t("Notes") }}
        </q-toolbar>
        <q-tab-panels class="col-grow bg-transparent" :value="textTab" animated>
          <q-tab-panel name="notes">
            <Notes ref="notes" class="fit" />
          </q-tab-panel>
          <q-tab-panel v-if="hasChat" name="chat">
            <Chat ref="chat" class="fit" />
          </q-tab-panel>
        </q-tab-panels>
      </div>
      <div class="gt-sm absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-footer class="bg-ui">
      <Scrubber />
      <q-toolbar
        v-show="isEditingTPS || $store.state.ui.showControls"
        class="footer-toolbar q-pa-sm"
      >
        <PieceSelector
          v-if="isEditingTPS"
          class="justify-around items-center"
          style="width: 100%; max-width: 500px; margin: 0 auto"
          v-model="selectedPiece"
        >
          <q-input
            type="number"
            v-model="firstMoveNumber"
            :label="$t('Move')"
            :min="minFirstMoveNumber"
            :max="999"
            filled
            dense
          />
          <q-btn :label="$t('Cancel')" @click="resetTPS" color="primary" flat />
          <q-btn :label="$t('OK')" @click="saveTPS" color="primary" flat />
        </PieceSelector>
        <PlayControls v-else />
      </q-toolbar>
    </q-footer>

    <router-view ref="dialog" no-route-dismiss />

    <ErrorNotifications :errors="errors" />
    <GameNotifications />
    <NoteNotifications />
  </q-layout>
  <q-dialog v-else :value="true"> No Game </q-dialog>
</template>

<script>
// Essentials:
import Board from "../components/board/Board";
import Move from "../components/PTN/Move";
import PTN from "../components/drawers/PTN";
import Notes from "../components/drawers/Notes";

// Notifications:
import ErrorNotifications from "../components/notify/ErrorNotifications";
import GameNotifications from "../components/notify/GameNotifications";
import NoteNotifications from "../components/notify/NoteNotifications";

// Controls:
import PlayControls from "../components/controls/PlayControls";
import Scrubber from "../components/controls/Scrubber";
import PTNTools from "../components/controls/PTNTools";
import EvalButtons from "../components/controls/EvalButtons";
import BoardToggles from "../components/controls/BoardToggles";
import ShareButton from "../components/controls/ShareButton";

// Excluded from Embed layout:
import onlineStore from "../store/online";
import GameSelector from "../components/controls/GameSelector";
import PieceSelector from "../components/controls/PieceSelector";
import Menu from "../components/controls/Menu";
import Chat from "../components/drawers/Chat";

import Game from "../PTN/Game";
import { HOTKEYS } from "../keymap";

import { Platform } from "quasar";

export default {
  components: {
    Board,
    Move,
    PTN,
    Notes,
    ErrorNotifications,
    GameNotifications,
    NoteNotifications,
    PlayControls,
    Scrubber,
    PTNTools,
    EvalButtons,
    BoardToggles,
    ShareButton,
    Chat,
    GameSelector,
    PieceSelector,
    Menu,
  },
  props: ["ptn", "state", "name", "gameID"],
  data() {
    return {
      Platform,
      errors: [],
      hotkeys: HOTKEYS,
    };
  },
  computed: {
    game() {
      return this.$store.state.game.current;
    },
    showPTN: {
      get() {
        return this.$store.state.ui.showPTN;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["showPTN", value]);
      },
    },
    showText: {
      get() {
        return this.$store.state.ui.showText;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["showText", value]);
      },
    },
    hasChat() {
      return this.game.hasChat;
    },
    textTab: {
      get() {
        return this.hasChat ? this.$store.state.ui.textTab : "notes";
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["textTab", value]);
      },
    },
    notifyNotes: {
      get() {
        return this.$store.state.ui.notifyNotes;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["notifyNotes", value]);
      },
    },
    isEditingTPS: {
      get() {
        return this.$store.state.ui.isEditingTPS;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["isEditingTPS", value]);
        if (!value) {
          this.editingTPS = "";
        }
      },
    },
    selectedPiece: {
      get() {
        return this.$store.state.ui.selectedPiece;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["selectedPiece", value]);
        this.editingTPS = this.game.state.getTPS(
          this.selectedPiece.color,
          this.firstMoveNumber
        );
      },
    },
    minFirstMoveNumber() {
      const min1 =
        this.game.state.pieces.played[1].cap.length +
        this.game.state.pieces.played[1].flat.length +
        this.game.state.squares.reduce(
          (total, row) =>
            row.reduce(
              (total, square) =>
                square.pieces.length
                  ? total +
                    square.pieces.slice(1).filter((piece) => piece.color === 1)
                      .length
                  : total,
              total
            ),
          0
        );
      const min2 =
        this.game.state.pieces.played[2].cap.length +
        this.game.state.pieces.played[2].flat.length +
        this.game.state.squares.reduce(
          (total, row) =>
            row.reduce(
              (total, square) =>
                square.pieces.length
                  ? total +
                    square.pieces.slice(1).filter((piece) => piece.color === 2)
                      .length
                  : total,
              total
            ),
          0
        );
      return Math.max(min1, min2) + 1 * (min1 <= min2);
    },
    firstMoveNumber: {
      get() {
        return this.$store.state.ui.firstMoveNumber;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["firstMoveNumber", 1 * value]);
        this.editingTPS = this.game.state.getTPS(
          this.selectedPiece.color,
          this.firstMoveNumber
        );
      },
    },
    editingTPS: {
      get() {
        return this.$store.state.ui.editingTPS;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["editingTPS", value]);
      },
    },
    disabledOptions() {
      return this.$store.getters["game/disabledOptions"];
    },
    isGamesTableShowing() {
      return (
        this.$route.name === "add" &&
        this.$route.params.tab === "load" &&
        this.$route.params.online
      );
    },
    games() {
      return this.$store.state.game.list;
    },
    user() {
      return this.$store.state.online.user;
    },
    player() {
      return this.user ? this.game.player(this.user.uid) : 0;
    },
    isAnonymous() {
      return !this.user || this.user.isAnonymous;
    },
  },
  methods: {
    newGame() {
      const game = new Game(
        `[Player1 "${this.$store.state.ui.player1}"]\n` +
          `[Player2 "${this.$store.state.ui.player2}"]\n` +
          `[Size "${this.$store.state.ui.size}"]\n` +
          "\n" +
          "1. "
      );
      return game;
    },
    getGame() {
      let game;
      this.errors = [];

      const _handleError = (error) => {
        const name = game ? game.name : "";
        game = this.newGame();
        if (name) {
          game.name = name;
        }
        if (error.message in this.$i18n.messages[this.$i18n.locale].error) {
          this.errors.push(this.$t(`error["${error.message}"]`));
        } else {
          console.error(error);
        }
      };

      const _loadPrevious = () => {
        if (this.$store.state.game.list && this.$store.state.game.list.length) {
          try {
            game = this.$store.state.game.list[0];
            game = new Game(game.ptn, game);
            if (
              this.$store.state.isEditingTPS &&
              this.$store.state.editingTPS
            ) {
              game.doTPS(this.$store.state.editingTPS);
            }
          } catch (error) {
            _handleError(error);
          }
        }
      };

      if (this.ptn) {
        try {
          // Add game from URL
          let name = this.name;
          if (!this.name) {
            game = new Game(this.ptn, { state: this.state });
            name = game.name;
          }
          const index = this.$store.state.game.list.findIndex(
            (g) => g.name === name
          );
          if (index < 0 || this.$store.state.ui.openDuplicate !== "replace") {
            if (!game) {
              game = new Game(this.ptn, { name, state: this.state });
            }
            if (game) {
              this.$store.dispatch("game/ADD_GAME", {
                ptn: this.ptn,
                name: game.name,
                state: game.minState,
                config: game.config,
              });
              this.$router.replace("/");
            }
          } else {
            if (index > 0) {
              this.$store.dispatch("game/SELECT_GAME", {
                index,
                immediate: true,
              });
            }

            game = this.$store.state.game.list[0];
            game = new Game(game.ptn, game);

            if (game.ptn !== this.ptn) {
              game.replacePTN(this.ptn, this.state);
              this.$store.dispatch("game/SAVE_UNDO_INDEX", game);
              this.$store.dispatch("game/SAVE_UNDO_HISTORY", game);
              this.$store.dispatch("game/SAVE_PTN", this.ptn);
              this.$store.dispatch("game/SAVE_STATE", {
                game,
                gameState: game.minState,
              });

              this.$nextTick(() => {
                this.$store.dispatch("ui/NOTIFY", {
                  message: this.$t("success.replacedExistingGame"),
                  timeout: 5000,
                  progress: true,
                  multiLine: false,
                  actions: [
                    {
                      label: this.$t("Undo"),
                      color: "primary",
                      handler: () => {
                        this.$store.dispatch("game/UNDO", game);
                      },
                    },
                    { icon: "close" },
                  ],
                });
              });
            }
            this.$router.replace("/");
          }
        } catch (error) {
          _handleError(error);
          _loadPrevious();
        }
      } else {
        _loadPrevious();
      }
      if (!game) {
        game = this.newGame();
      }

      if (game.config.unseen) {
        this.$store.dispatch("game/SAVE_CONFIG", {
          game,
          config: { ...game.config, unseen: false },
        });
      }

      if (process.env.DEV) {
        window.main = this;
        window.game = game;
      }
      this.$store.dispatch("game/SET_GAME", game);

      if (
        this.$store.state.ui.isEditingTPS &&
        this.$store.state.ui.editingTPS
      ) {
        this.$store.dispatch("game/DO_TPS", this.$store.state.ui.editingTPS);
      }
    },
    resetTPS() {
      this.$store.dispatch("game/RESET_TPS");
    },
    saveTPS() {
      this.$store.dispatch("game/SAVE_TPS", this.editingTPS);
    },
    menuAction(action) {
      switch (action) {
        case "help":
          this.$router.push({ name: "help" });
          break;
        case "account":
          if (this.isAnonymous) {
            this.$router.push({ name: "login" });
          } else {
            this.$router.push({ name: "account" });
          }
          break;
        case "settings":
          this.$router.push({ name: "preferences" });
          break;
        case "share":
          this.share();
          break;
        case "add":
          this.$router.push({ name: "add", params: { tab: "new" } });
          break;
      }
    },
    miscShortkey({ srcKey }) {
      switch (srcKey) {
        case "editGame":
          if (this.$route.name !== "info-edit") {
            this.$router.push({ name: "info-edit" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "editPTN":
          if (this.$route.name !== "edit") {
            this.$router.push({ name: "edit" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "embedGame":
          if (this.$route.name !== "embed") {
            this.$router.push({ name: "embed" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "sharePNG":
          if (this.$route.name !== "png") {
            this.$router.push({ name: "png" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "focusText":
          this.showText = true;
          this.$refs[
            this.hasChat && this.textTab === "chat" ? "chat" : "notes"
          ].$refs.input.focus();
          break;
        case "focusGame":
          this.$refs.gameSelector.$refs.select.showPopup();
          break;
        case "previousGame":
          if (this.$store.state.game.list.length > 1) {
            this.$refs.gameSelector.select(1);
          }
          break;
        case "toggleText":
          if (this.hasChat) {
            this.textTab = this.textTab === "notes" ? "chat" : "notes";
          }
          break;
        case "help":
          if (this.$route.name !== "help") {
            this.$router.push({
              name: "help",
              params: { section: "usage" },
            });
          } else if (this.$route.params.section !== "usage") {
            this.$router.replace({
              name: "help",
              params: { section: "usage" },
            });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "account":
          if (this.isAnonymous) {
            if (this.$route.name !== "login") {
              this.$router.push({ name: "login" });
            } else {
              this.$refs.dialog.$children[0].hide();
            }
          } else {
            if (this.$route.name !== "account") {
              this.$router.push({ name: "account" });
            } else {
              this.$refs.dialog.$children[0].hide();
            }
          }
          break;
        case "hotkeys":
          if (this.$route.name !== "help") {
            this.$router.push({
              name: "help",
              params: { section: "hotkeys" },
            });
          } else if (this.$route.params.section !== "hotkeys") {
            this.$router.replace({
              name: "help",
              params: { section: "hotkeys" },
            });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "loadGame":
          if (this.$route.name !== "add") {
            this.$router.push({
              name: "add",
              params: { tab: "load" },
            });
          } else if (this.$route.params.tab !== "load") {
            this.$router.replace({
              name: "add",
              params: { tab: "load" },
            });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "loadOnlineGame":
          if (this.$route.name !== "add") {
            this.$router.push({
              name: "add",
              params: { tab: "load", online: "online" },
            });
          } else if (
            this.$route.params.tab !== "load" ||
            !this.$route.params.online
          ) {
            this.$router.replace({
              name: "add",
              params: { tab: "load", online: "online" },
            });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "newGame":
          if (this.$route.name !== "add") {
            this.$router.push({
              name: "add",
              params: { tab: "new" },
            });
          } else if (this.$route.params.tab !== "new") {
            this.$router.replace({
              name: "add",
              params: { tab: "new" },
            });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "online":
          if (this.$route.name !== "online") {
            this.$router.push({ name: "online" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "preferences":
          if (this.$route.name !== "preferences") {
            this.$router.push({ name: "preferences" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "theme":
          if (this.$route.name !== "theme") {
            this.$router.push({ name: "theme" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "qrCode":
          if (this.$route.name !== "qr") {
            this.$router.push({ name: "qr" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "share":
          this.share();
          break;
      }
    },
    edit() {
      this.$router.push({ name: "info-edit" });
    },
    switchGame(event) {
      if (!event.currentTarget.classList.contains("q-fab--opened")) {
        this.$refs.gameSelector.select(1);
      }
    },
    showTextTab(value) {
      this.textTab = value;
    },
    share() {
      this.$refs.shareButton.share();
    },
    openFiles(event) {
      this.nop(event);
      this.$store.dispatch("ui/OPEN_FILES", event.dataTransfer.files);
    },
    nop(event) {
      event.stopPropagation();
      event.preventDefault();
    },
  },
  watch: {
    game() {
      this.$store.dispatch("online/LISTEN_CURRENT_GAME");
    },
    editingTPS() {
      if (this.firstMoveNumber < this.minFirstMoveNumber) {
        this.firstMoveNumber = this.minFirstMoveNumber;
      }
    },
    user(user, oldUser) {
      if (this.game && this.game.config.isOnline) {
        if (
          user &&
          (!oldUser || user.uid !== oldUser.uid) &&
          !this.game.player(user.uid) &&
          this.game.openPlayer
        ) {
          this.$router.push({ name: "join" });
        }
      }
    },
  },
  beforeCreate() {
    // Load online functionality
    if (process.env.DEV && this.$store.state.online) {
      this.$store.unregisterModule("online");
    }
    this.$store.registerModule("online", onlineStore);

    // Redirect hash URLs
    if (location.hash.length) {
      const url = location.hash.substr(1);
      location.hash = "";
      this.$router.replace(url);
      location.reload();
      return;
    }

    // Initialize
    this.$store.dispatch("online/INIT").then(() => {
      if (this.gameID) {
        // Check that the game is not already open
        const index = this.$store.state.game.list.findIndex(
          (game) => game.config.id === this.gameID
        );
        if (index >= 0) {
          this.$store.dispatch("game/SELECT_GAME", index);
        } else {
          // Add online game from URL
          this.$store
            .dispatch("online/LOAD_GAME", this.gameID)
            .then(() => {
              this.$router.replace("/");
            })
            .catch((error) => {
              this.$store.dispatch("ui/NOTIFY_ERROR", error);
            });
        }
      }
    });
  },
  created() {
    this.getGame();

    if (!this.gameID) {
      if (!this.games.length) {
        this.$store.dispatch("game/ADD_GAME", {
          ptn: this.game.text(),
          name: this.game.name,
          state: this.game.minState,
          config: this.game.config,
        });
      }
    }

    // Listen for dropped files
    if (window.File && window.FileReader && window.FileList && window.Blob) {
      window.addEventListener("drop", this.openFiles, true);
      window.addEventListener("dragover", this.nop, true);
      window.addEventListener("dragleave", this.nop, true);
    }
  },
  beforeDestroy() {
    window.removeEventListener("drop", this.openFiles);
    window.removeEventListener("dragover", this.nop);
    window.removeEventListener("dragleave", this.nop);
  },
};
</script>

<style lang="scss">
#left-drawer,
#right-drawer {
  .q-drawer {
    background: $panel;
    background: var(--q-color-panel);
    .q-drawer__content {
      overflow: hidden;
    }
  }
}

#right-drawer {
  .q-tabs {
    height: $toolbar-min-height;
  }
  .q-tab-panel {
    padding: 0;
  }
}

.board-move-container {
  @media (max-width: $breakpoint-sm-max) {
    align-items: flex-start;
    margin-right: 84px;
  }
}
</style>
