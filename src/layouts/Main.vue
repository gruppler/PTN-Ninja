<template>
  <q-layout class="non-selectable" view="lHr LpR lFr">
    <q-header elevated class="bg-secondary text-white">
      <q-toolbar class="q-pa-none">
        <q-btn
          icon="notes"
          @click="left = !left"
          :color="left ? 'accent' : ''"
          stretch
          flat
        />
        <QToolbarTitle>
          <GameSelector @input="updateGame">
            <q-btn
              icon="edit"
              @click.stop="edit"
              text-color="white"
              class="q-pa-sm"
              dense
              flat
            />
          </GameSelector>
        </QToolbarTitle>
        <q-btn
          :icon="textTab == 'notes' ? 'comment' : 'chat_bubble'"
          @click="right = !right"
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
        ref="page"
        class="flex flex-center"
        v-shortkey="hotkeys.ACTIONS"
        @shortkey="$store.dispatch($event.srcKey, game)"
      >
        <Board :game="game" :space="size" />
        <q-page-sticky position="bottom-right" :offset="[18, 18]">
          <Menu @input="menuAction" />
        </q-page-sticky>
        <q-page-sticky position="top-left" :offset="[18, 18]">
          <FullscreenToggle class="dimmed-btn" color="white" />
        </q-page-sticky>
        <q-resize-observer @resize="resize" debounce="0" />
      </q-page>
    </q-page-container>

    <q-drawer
      id="left-drawer"
      :value="left"
      @input="showPTN"
      side="left"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <div class="absolute-fit column">
        <q-toolbar class="bg-secondary text-white q-pa-none">
          <q-btn-group class="full-width" spread stretch flat unelevated>
            <q-btn
              @click="showAllBranches = !showAllBranches"
              :title="$t('Show_All_Branches')"
              :text-color="showAllBranches ? 'accent' : ''"
              class="no-border-radius"
            >
              <q-icon name="call_split" class="rotate-180" />
            </q-btn>
            <CopyButton :game="game" />
            <q-btn
              icon="assignment_returned"
              :title="$t('Paste_from_Clipboard')"
            />
            <q-btn :title="$t('Trim')" class="no-border-radius">
              <q-icon name="flip" class="rotate-270" />
              <q-menu auto-close square>
                <q-list dark class="bg-secondary text-white">
                  <q-item clickable>
                    <q-item-section side>
                      <q-icon name="flip" class="rotate-270" />
                    </q-item-section>
                    <q-item-section>{{
                      $t("Trim_to_current_ply")
                    }}</q-item-section>
                  </q-item>
                  <q-item clickable>
                    <q-item-section side>
                      <q-icon name="apps" />
                    </q-item-section>
                    <q-item-section>{{
                      $t("Trim_to_current_board")
                    }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </q-btn-group>
        </q-toolbar>
        <div class="col-grow relative-position">
          <PTN class="absolute-fit" :game="game" />
        </div>
        <q-toolbar class="footer-toolbar bg-secondary text-white q-pa-none">
          <q-btn-group spread stretch flat unelevated>
            <q-btn
              @click="$store.dispatch('UNDO', game)"
              icon="undo"
              :title="$t('Undo')"
              :disabled="!game.canUndo"
            />
            <q-btn
              @click="$store.dispatch('REDO', game)"
              icon="redo"
              :title="$t('Redo')"
              :disabled="!game.canRedo"
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
      :value="right"
      @input="showText"
      side="right"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <div class="absolute-fit column">
        <q-tabs
          class="bg-secondary text-white text-weight-medium"
          :value="textTab"
          @input="showTextTab"
          active-color="accent"
          indicator-color="accent"
        >
          <q-tab name="notes">{{ $t("Notes") }}</q-tab>
          <q-tab name="chat">{{ $t("Chat") }}</q-tab>
        </q-tabs>
        <q-tab-panels class="col-grow bg-transparent" :value="textTab" animated>
          <q-tab-panel name="notes">
            <Notes class="fit" :game="game" />
          </q-tab-panel>
          <q-tab-panel name="chat">
            <Chat class="fit" :game="game" />
          </q-tab-panel>
        </q-tab-panels>
      </div>
      <div class="gt-sm absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-footer reveal>
      <Scrubber :game="game" v-if="$store.state.showScrubber" />
      <q-toolbar
        v-if="$store.state.showControls"
        class="footer-toolbar q-pa-sm bg-secondary text-white"
      >
        <PlayControls :game="game" />
      </q-toolbar>
    </q-footer>

    <AddGame v-model="dialogAddGame" />
    <EditGame v-model="dialogEditGame" :game="game" />
    <UISettings v-model="dialogUISettings" />

    <NoteNotifications :game="game" />
    <GameNotifications :game="game" />
  </q-layout>
</template>

<script>
import Board from "../components/Board";
import Notes from "../components/Notes";
import Chat from "../components/Chat";
import GameSelector from "../components/GameSelector";
import Menu from "../components/Menu";
import PTN from "../components/PTN";
import GameNotifications from "../components/GameNotifications";
import NoteNotifications from "../components/NoteNotifications";
import PlayControls from "../components/PlayControls";
import Scrubber from "../components/Scrubber";
import CopyButton from "../components/CopyButton";
import EvalButtons from "../components/EvalButtons";
import AddGame from "../components/AddGame";
import EditGame from "../components/EditGame";
import UISettings from "../components/UISettings";
import FullscreenToggle from "../components/FullscreenToggle";

import Game from "../PTN/Game";
import { isEqual } from "lodash";
import { HOTKEYS } from "../keymap";

import { Platform } from "quasar";

export default {
  components: {
    Board,
    Notes,
    Chat,
    GameSelector,
    Menu,
    PTN,
    GameNotifications,
    NoteNotifications,
    PlayControls,
    Scrubber,
    CopyButton,
    EvalButtons,
    AddGame,
    EditGame,
    UISettings,
    FullscreenToggle
  },
  props: ["ptn", "state", "name"],
  data() {
    return {
      Platform,
      game: this.getGame(),
      size: null,
      notifyClosers: [],
      hotkeys: HOTKEYS
    };
  },
  computed: {
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
    textTab: {
      get() {
        return this.$store.state.textTab;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["textTab", value]);
      }
    },
    showAllBranches: {
      get() {
        return this.$store.state.showAllBranches;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["showAllBranches", value]);
      }
    },
    dialogAddGame: {
      get() {
        return this.$route.name === "add";
      },
      set(value) {
        if (value) {
          if (this.$route.name !== "add") {
            this.$router.push({ name: "add" });
          }
        } else {
          if (this.$route.name == "add") {
            this.$router.go(-1);
            this.$router.replace({ name: "local" });
          }
        }
      }
    },
    dialogUISettings: {
      get() {
        return this.$route.name === "settings";
      },
      set(value) {
        if (value) {
          if (this.$route.name !== "settings") {
            this.$router.push({ name: "settings" });
          }
        } else {
          if (this.$route.name == "settings") {
            this.$router.go(-1);
            this.$router.replace({ name: "local" });
          }
        }
      }
    },
    dialogEditGame: {
      get() {
        return this.$route.name === "edit";
      },
      set(value) {
        if (value) {
          if (this.$route.name !== "edit") {
            this.$router.push({ name: "edit" });
          }
        } else {
          if (this.$route.name == "edit") {
            this.$router.go(-1);
            this.$router.replace({ name: "local" });
          }
        }
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
    newGame() {
      return new Game(
        '[Date ""]\n' +
          `[Player1 "${this.$store.state.player1}"]\n` +
          `[Player2 "${this.$store.state.player2}"]\n` +
          `[Size "${this.$store.state.size}"]\n` +
          '[Result ""]\n' +
          "\n" +
          "1. "
      );
    },
    getGame() {
      let game;
      if (this.ptn) {
        // Add game from URL then redirect to /
        game = Game.parse(this.ptn, { name: this.name, state: this.state });
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
        game = Game.parse(game.ptn, game);
      } else {
        game = this.newGame();
      }
      return game;
    },
    updateGame() {
      this.game = this.getGame();
    },
    menuAction(action) {
      switch (action) {
        case "add":
          this.dialogAddGame = true;
          break;
        case "settings":
          this.dialogUISettings = true;
          break;
      }
    },
    edit() {
      this.dialogEditGame = true;
    },
    showPTN(value) {
      this.left = value;
    },
    showText(value) {
      this.right = value;
    },
    showTextTab(value) {
      this.textTab = value;
    },
    resize(size) {
      this.size = size;
      this.size.height = parseInt(this.$refs.page.style.minHeight, 10);
    },
    openFiles(event) {
      event.stopPropagation();
      event.preventDefault();
      this.$store.dispatch("OPEN_FILES", event.dataTransfer.files);
    },
    nop(event) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  watch: {
    games(newGames, oldGames) {
      if (!newGames[0] || !oldGames[0] || newGames[0] !== oldGames[0]) {
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
    }
  },
  created() {
    if (!this.games.length) {
      this.$store.dispatch("ADD_GAME", {
        ptn: this.game.text(),
        name: this.game.name,
        state: this.game.minState
      });
    }
  },
  mounted() {
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
</style>
