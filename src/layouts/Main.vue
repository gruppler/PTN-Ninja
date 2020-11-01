<template>
  <q-layout class="non-selectable" view="lHr LpR lFr">
    <q-header elevated class="bg-secondary text-white">
      <q-toolbar class="q-pa-none">
        <q-btn
          icon="moves"
          @click="left = !left"
          :color="left ? 'accent' : ''"
          stretch
          flat
        />
        <q-toolbar-title class="q-pa-none">
          <GameSelector ref="gameSelector" :game="game">
            <q-btn icon="edit" @click.stop="edit" class="q-mr-sm" dense flat />
          </GameSelector>
        </q-toolbar-title>
        <q-btn
          :icon="
            textTab === 'notes' ? (notifyNotes ? 'notes' : 'notes_off') : 'chat'
          "
          @click.left="right = !right"
          @click.right.prevent="notifyNotes = !notifyNotes"
          :color="right ? 'accent' : ''"
          stretch
          flat
        />
      </q-toolbar>
    </q-header>

    <q-page-container
      class="bg-primary"
      v-shortkey="hotkeys.UI"
      @shortkey="$store.dispatch('TOGGLE_UI', $event.srcKey)"
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
          <Board ref="board" class="col-grow" :game="game" />
          <smooth-reflow
            @click.right.self.prevent="$refs.board.resetBoardRotation"
            class="board-move-container"
          >
            <Move
              v-if="game.state.move"
              v-show="game.state.ply && $store.state.showMove"
              class="q-mb-md q-mx-md"
              :class="{ 'lt-sm': $store.state.showPTN }"
              :move="game.state.move"
              :game="game"
              separate-branch
              current-only
              standalone
            />
          </smooth-reflow>
        </div>
        <q-page-sticky position="bottom-right" :offset="[18, 18]">
          <Menu
            @input="menuAction"
            @click.right.prevent="switchGame"
            v-touch-swipe.left="switchGame"
          />
        </q-page-sticky>
        <q-page-sticky position="top-left" :offset="[18, 18]">
          <BoardToggles v-if="!dialogEmbed" />
        </q-page-sticky>
      </q-page>
    </q-page-container>

    <q-drawer
      id="left-drawer"
      v-model="left"
      side="left"
      :breakpoint="right ? $q.screen.sizes.lg : $q.screen.sizes.sm"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <div class="absolute-fit column">
        <PTN-Tools ref="tools" :game="game" :showEditor.sync="dialogEditPTN">
          <ShareButton
            ref="shareButton"
            :title="$t('Share')"
            :game="game"
            :showQR.sync="dialogQR"
            @embed="dialogEmbed = true"
          />
        </PTN-Tools>
        <div class="col-grow relative-position">
          <PTN class="absolute-fit" :game="game" />
        </div>
        <q-toolbar class="footer-toolbar bg-secondary text-white q-pa-none">
          <q-btn-group spread stretch flat unelevated>
            <q-btn
              @click="$store.dispatch('UNDO', game)"
              icon="undo"
              :title="$t('Undo')"
              :disabled="isEditingTPS || !game.canUndo"
            />
            <q-btn
              @click="$store.dispatch('REDO', game)"
              icon="redo"
              :title="$t('Redo')"
              :disabled="isEditingTPS || !game.canRedo"
            />
          </q-btn-group>
          <EvalButtons
            class="full-width"
            spread
            stretch
            flat
            unelevated
            :game="game"
          />
        </q-toolbar>
      </div>
      <div class="gt-sm absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-drawer
      id="right-drawer"
      v-model="right"
      side="right"
      :breakpoint="left ? $q.screen.sizes.lg : $q.screen.sizes.sm"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <div class="absolute-fit column">
        <q-tabs
          v-if="hasChat"
          class="bg-secondary text-white text-weight-medium"
          :value="textTab"
          @input="showTextTab"
          active-color="accent"
          indicator-color="accent"
        >
          <q-tab name="notes">{{ $t("Notes") }}</q-tab>
          <q-tab name="chat">{{ $t("Chat") }}</q-tab>
        </q-tabs>
        <q-toolbar
          v-else
          class="bg-secondary text-white text-weight-medium justify-center text-uppercase"
        >
          {{ $t("Notes") }}
        </q-toolbar>
        <q-tab-panels class="col-grow bg-transparent" :value="textTab" animated>
          <q-tab-panel name="notes">
            <Notes ref="notes" class="fit" :game="game" />
          </q-tab-panel>
          <q-tab-panel v-if="hasChat" name="chat">
            <Chat ref="chat" class="fit" :game="game" />
          </q-tab-panel>
        </q-tab-panels>
      </div>
      <div class="gt-sm absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-footer>
      <Scrubber :game="game" v-if="$store.state.showScrubber" />
      <q-toolbar
        v-show="isEditingTPS || $store.state.showControls"
        class="footer-toolbar q-pa-sm bg-secondary text-white"
      >
        <PieceSelector
          v-if="isEditingTPS"
          class="justify-around items-center"
          style="width: 100%; max-width: 500px; margin: 0 auto"
          v-model="selectedPiece"
          :game="game"
        >
          <q-input
            type="number"
            v-model="firstMoveNumber"
            :label="$t('Move')"
            :min="minFirstMoveNumber"
            :max="999"
            color="accent"
            filled
            dense
          />
          <q-btn
            :label="$t('Cancel')"
            @click="
              isEditingTPS = false;
              game.state.board = game.boards[0].false;
            "
            color="accent"
            flat
          />
          <q-btn
            :label="$t('OK')"
            @click="
              game.setTags({ tps: editingTPS });
              isEditingTPS = false;
            "
            color="accent"
            flat
          />
        </PieceSelector>
        <PlayControls v-else :game="game" />
      </q-toolbar>
    </q-footer>

    <Help ref="help" v-model="dialogHelp" no-route-dismiss />
    <AddGame ref="addGame" v-model="dialogAddGame" no-route-dismiss />
    <EditGame v-model="dialogEditGame" :game="game" no-route-dismiss />
    <UISettings v-model="dialogUISettings" no-route-dismiss />
    <EmbedConfig v-model="dialogEmbed" :game="game" no-route-dismiss />

    <ErrorNotifications :errors="errors" />
    <GameNotifications :game="game" />
    <NoteNotifications :game="game" />
  </q-layout>
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
import GameSelector from "../components/controls/GameSelector";
import PieceSelector from "../components/controls/PieceSelector";
import Menu from "../components/controls/Menu";
import Chat from "../components/drawers/Chat";

// Dialogs:
import Help from "../components/dialogs/Help";
import AddGame from "../components/dialogs/AddGame";
import EditGame from "../components/dialogs/EditGame";
import UISettings from "../components/dialogs/UISettings";
import EmbedConfig from "../components/dialogs/EmbedConfig";

import Game from "../PTN/Game";
import { HOTKEYS } from "../keymap";

import { Platform } from "quasar";
import { isEqual, zipObject } from "lodash";

const HISTORY_DIALOGS = {
  dialogHelp: "help",
  dialogAddGame: "add",
  dialogUISettings: "preferences",
  dialogEditGame: "info",
  dialogEditPTN: "edit",
  dialogEmbed: "embed",
  dialogQR: "qr"
};

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
    Help,
    AddGame,
    EditGame,
    UISettings,
    EmbedConfig
  },
  props: ["ptn", "state", "name"],
  data() {
    return {
      Platform,
      game: this.getGame(),
      errors: [],
      hotkeys: HOTKEYS
    };
  },
  computed: {
    ...zipObject(
      Object.keys(HISTORY_DIALOGS),
      Object.values(HISTORY_DIALOGS).map(key => ({
        get() {
          return this.$route.name === key;
        },
        set(value) {
          if (value) {
            if (this.$route.name !== key) {
              this.$router.push({ name: key });
            }
          } else {
            if (this.$route.name === key) {
              this.$router.go(-1);
              this.$router.replace({ name: "local" });
            }
          }
        }
      }))
    ),
    left: {
      get() {
        return this.$store.state.showPTN;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["showPTN", value]);
      }
    },
    right: {
      get() {
        return this.$store.state.showText;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["showText", value]);
      }
    },
    hasChat() {
      return this.game.hasChat;
    },
    textTab: {
      get() {
        return this.hasChat ? this.$store.state.textTab : "notes";
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["textTab", value]);
      }
    },
    notifyNotes: {
      get() {
        return this.$store.state.notifyNotes;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["notifyNotes", value]);
      }
    },
    isEditingTPS: {
      get() {
        return this.$store.state.isEditingTPS;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["isEditingTPS", value]);
        if (!value) {
          this.editingTPS = "";
        }
      }
    },
    selectedPiece: {
      get() {
        return this.$store.state.selectedPiece;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["selectedPiece", value]);
        this.editingTPS = this.game.state.getTPS(
          this.selectedPiece.color,
          this.firstMoveNumber
        );
      }
    },
    minFirstMoveNumber() {
      const min1 =
        this.game.state.pieces.played[1].cap.length +
        this.game.state.pieces.played[1].flat.length +
        this.game.state.squares.reduce(
          (total, row) =>
            row.reduce(
              (total, square) =>
                square.length
                  ? total +
                    square.slice(1).filter(piece => piece.color === 1).length
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
                square.length
                  ? total +
                    square.slice(1).filter(piece => piece.color === 2).length
                  : total,
              total
            ),
          0
        );
      return Math.max(min1, min2) + 1 * (min1 <= min2);
    },
    firstMoveNumber: {
      get() {
        return this.$store.state.firstMoveNumber;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["firstMoveNumber", 1 * value]);
        this.editingTPS = this.game.state.getTPS(
          this.selectedPiece.color,
          this.firstMoveNumber
        );
      }
    },
    editingTPS: {
      get() {
        return this.$store.state.editingTPS;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["editingTPS", value]);
      }
    },
    games() {
      return this.$store.state.games.concat();
    },
    gameState() {
      let state = this.game.minState;
      state.name = this.game.name;
      return state;
    },
    gameHistory() {
      return {
        history: this.game.history.concat(),
        index: this.game.historyIndex,
        name: this.game.name
      };
    },
    gameText() {
      return { ptn: this.game.ptn, name: this.game.name };
    },
    gameName() {
      return { name: this.game.name, game: this.game };
    }
  },
  methods: {
    setWindowTitle(prefix = this.game.name) {
      document.title = prefix + " — " + this.$t("app_title");
    },
    newGame() {
      return new Game(
        `[Player1 "${this.$store.state.player1}"]\n` +
          `[Player2 "${this.$store.state.player2}"]\n` +
          `[Size "${this.$store.state.size}"]\n` +
          "\n" +
          "1. "
      );
    },
    getGame() {
      let game;
      this.errors = [];
      try {
        if (this.ptn) {
          // Add game from URL then redirect to /
          game = new Game(this.ptn, { name: this.name, state: this.state });
          if (game) {
            this.$store.dispatch("ADD_GAME", {
              ptn: this.ptn,
              name: game.name,
              state: game.minState
            });
            this.$router.replace("/");
          }
        } else if (this.$store.state.games && this.$store.state.games.length) {
          game = this.$store.state.games[0];
          game = new Game(game.ptn, game);
          if (this.$store.state.isEditingTPS && this.$store.state.editingTPS) {
            game.doTPS(this.$store.state.editingTPS);
          }
        }
      } catch (error) {
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
      }
      if (!game) {
        game = this.newGame();
      }
      this.setWindowTitle(game.name);

      if (process.env.DEV) {
        window.main = this;
        window.game = game;
      }
      return game;
    },
    updateGame() {
      this.game = this.getGame();
    },
    menuAction(action) {
      switch (action) {
        case "help":
          this.dialogHelp = true;
          break;
        case "add":
          this.dialogAddGame = true;
          break;
        case "share":
          this.share();
          break;
        case "settings":
          this.dialogUISettings = true;
          break;
      }
    },
    miscShortkey({ srcKey }) {
      switch (srcKey) {
        case "editGame":
          this.dialogEditGame = true;
          break;
        case "editPTN":
          this.dialogEditPTN = true;
          break;
        case "embedGame":
          this.dialogEmbed = true;
          break;
        case "focusText":
          this.right = true;
          this.$refs[
            this.hasChat && this.textTab === "chat" ? "chat" : "notes"
          ].$refs.input.focus();
          break;
        case "focusGame":
          this.$refs.gameSelector.$refs.select.showPopup();
          break;
        case "previousGame":
          if (this.$store.state.games.length > 1) {
            this.$refs.gameSelector.select(1);
          }
          break;
        case "help":
          if (!this.dialogHelp || this.$refs.help.section !== "usage") {
            this.dialogHelp = true;
            this.$refs.help.section = "usage";
          } else {
            this.dialogHelp = false;
          }
          break;
        case "hotkeys":
          if (!this.dialogHelp || this.$refs.help.section !== "hotkeys") {
            this.dialogHelp = true;
            this.$refs.help.section = "hotkeys";
          } else {
            this.dialogHelp = false;
          }
          break;
        case "loadGame":
          if (!this.dialogAddGame) {
            this.$router.push({ name: "add", params: { tab: "load" } });
          } else if (this.$route.params.tab !== "load") {
            this.$router.replace({ name: "add", params: { tab: "load" } });
          } else {
            this.dialogAddGame = false;
          }
          break;
        case "newGame":
          if (!this.dialogAddGame || this.$refs.addGame.tab !== "new") {
            this.dialogAddGame = true;
            this.$refs.addGame.tab = "new";
          } else {
            this.dialogAddGame = false;
          }
          break;
        case "preferences":
          this.dialogUISettings = !this.dialogUISettings;
          break;
        case "qrCode":
          if (this.dialogQR) {
            this.dialogQR = false;
          } else {
            this.$refs.shareButton.qrCode();
          }
          break;
        case "share":
          this.share();
          break;
      }
    },
    edit() {
      this.dialogEditGame = true;
    },
    switchGame({ distance }) {
      if (!distance || distance.x > 10) {
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
      this.$store.dispatch("OPEN_FILES", event.dataTransfer.files);
    },
    nop(event) {
      event.stopPropagation();
      event.preventDefault();
    }
  },
  watch: {
    games(newGames, oldGames) {
      if (!newGames[0] || !oldGames[0] || newGames[0] !== oldGames[0]) {
        this.isEditingTPS = false;
        this.updateGame();
      }
    },
    gameState(newState, oldState) {
      if (oldState.name === newState.name) {
        this.$store.dispatch("SET_STATE", this.game.minState);
      }
    },
    gameHistory(newHistory, oldHistory) {
      if (oldHistory.name === newHistory.name) {
        if (oldHistory.index !== newHistory.index) {
          this.$store.dispatch("SAVE_UNDO_INDEX", this.game);
        }
        if (!isEqual(oldHistory.history, newHistory.history)) {
          this.$store.dispatch("SAVE_UNDO_HISTORY", this.game);
        }
      }
    },
    gameText(newText, oldText) {
      if (oldText.name === newText.name) {
        this.$store.dispatch("UPDATE_PTN", newText.ptn);
      }
    },
    gameName(newName, oldName) {
      if (oldName.game === newName.game) {
        this.$store.dispatch("SET_NAME", newName.name);
      }
      this.setWindowTitle(newName.name);
    },
    editingTPS() {
      if (this.firstMoveNumber < this.minFirstMoveNumber) {
        this.firstMoveNumber = this.minFirstMoveNumber;
      }
    }
  },
  beforeCreate() {
    // Redirect hash URLs
    if (location.hash.length) {
      const url = location.hash.substr(1);
      location.hash = "";
      this.$router.replace(url);
      location.reload();
    }
  },
  created() {
    this.$q.dark.set(true);
    if (!this.games.length) {
      this.$store.dispatch("ADD_GAME", {
        ptn: this.game.text(),
        name: this.game.name,
        state: this.game.minState
      });
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
  }
};
</script>

<style lang="stylus">
#left-drawer, #right-drawer
  .q-drawer
    background rgba($blue-grey-5, 0.75)
    .q-drawer__content
      overflow hidden

#right-drawer
  .q-tabs
    height $toolbar-min-height
  .q-tab-panel
    padding 0

.board-move-container
  @media (max-width: $breakpoint-sm-max)
    align-items flex-start
    margin-right 84px
</style>
