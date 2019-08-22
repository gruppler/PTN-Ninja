<template>
  <q-layout class="non-selectable" view="hHh LpR fFf">
    <q-header elevated class="bg-secondary text-white">
      <q-toolbar>
        <q-btn icon="notes" @click="left = !left" flat dense />
        <QToolbarTitle>
          <GameSelector @input="updateGame">
            <q-btn
              icon="edit"
              @click.stop="edit"
              text-color="white"
              flat
              dense
            />
          </GameSelector>
        </QToolbarTitle>
        <q-btn
          :icon="textTab == 'notes' ? 'comment' : 'chat_bubble'"
          @click="right = !right"
          flat
          dense
        />
      </q-toolbar>
    </q-header>

    <q-page-container
      class="bg-primary"
      v-shortkey="hotkeys"
      @shortkey="$store.dispatch('TOGGLE_UI', $event.srcKey)"
    >
      <q-page ref="page" class="flex flex-center">
        <Board :game="game" :space="size" />
        <q-page-sticky position="bottom-right" :offset="[18, 18]">
          <Menu @input="menuAction" />
        </q-page-sticky>
        <q-resize-observer @resize="resize" debounce="0" />
      </q-page>
    </q-page-container>

    <q-drawer
      id="left-drawer"
      :value="left"
      @input="showPTN"
      side="left"
      persistent
    >
      <PTN class="fit" :game="game" />
    </q-drawer>

    <q-drawer
      id="right-drawer"
      :value="right"
      @input="showText"
      side="right"
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
    </q-drawer>

    <q-footer reveal>
      <Scrubber :game="game" v-if="$store.state.showScrubber" />
      <div class="controls" :class="{ visible: $store.state.showControls }">
        <q-toolbar class="q-pa-sm bg-secondary text-white">
          <PlayControls :game="game" />
        </q-toolbar>
      </div>
    </q-footer>

    <AddGame v-model="dialogAddGame" />
    <EditGame v-model="dialogEditGame" :game="game" />
    <UISettings v-model="dialogUISettings" />
  </q-layout>
</template>

<script>
import Board from "../components/Board";
import Notes from "../components/Notes";
import Chat from "../components/Chat";
import GameSelector from "../components/GameSelector";
import Menu from "../components/Menu";
import PTN from "../components/PTN";
import PlayControls from "../components/PlayControls";
import Scrubber from "../components/Scrubber";
import AddGame from "../components/AddGame";
import EditGame from "../components/EditGame";
import UISettings from "../components/UISettings";

import Game from "../PTN/Game";
import { each, pick } from "lodash";
import { GAME_STATE_PROPS, HOTKEYS } from "../constants";

export default {
  components: {
    Board,
    Notes,
    Chat,
    GameSelector,
    Menu,
    PTN,
    PlayControls,
    Scrubber,
    AddGame,
    EditGame,
    UISettings
  },
  props: ["ptn", "state", "name"],
  data() {
    return {
      game: this.getGame(),
      dialogAddGame: false,
      dialogUISettings: false,
      dialogEditGame: false,
      size: null,
      notifyClosers: [],
      hotkeys: HOTKEYS.UI
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
    games() {
      return this.$store.state.games;
    },
    gameState() {
      let state = pick(this.game.state, GAME_STATE_PROPS);
      state.game = this.game;
      return state;
    },
    gameText() {
      return { ptn: this.game.ptn, game: this.game };
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
            state: game.state
          });
          this.$router.replace("/");
        }
      } else if (this.$store.state.games && this.$store.state.games.length) {
        game = this.$store.state.games[0];
        game = Game.parse(game.ptn, {
          name: game.name,
          state: game.state
        });
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
        default:
          console.log(action);
      }
    },
    showNotifications() {
      if (
        !this.right &&
        this.$store.state.notifyNotes &&
        this.game.state.plyID in this.game.notes
      ) {
        this.game.notes[this.game.state.plyID]
          .concat()
          .reverse()
          .forEach(note => {
            this.notifyClosers.push(
              this.$q.notify({
                color: "accent",
                message: note.message,
                icon: "comment",
                position: "top-right",
                actions: [{ icon: "close", color: "secondary" }],
                classes: "note text-grey-10",
                timeout: 0
              })
            );
          });
      }
    },
    hideNotifications() {
      this.notifyClosers.forEach(close => close());
      this.notifyClosers = [];
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
      each(event.dataTransfer.files, file =>
        this.$store.dispatch("OPEN_FILE", file)
      );
    },
    nop(event) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  watch: {
    games() {
      this.updateGame();
    },
    gameState(newState, oldState) {
      if (oldState.game === newState.game) {
        this.$store.dispatch("SET_STATE", newState);
        if (oldState.plyID !== newState.plyID) {
          this.hideNotifications();
          this.showNotifications();
        }
      } else {
        this.hideNotifications();
        this.showNotifications();
      }
    },
    gameText(newText, oldText) {
      if (oldText.game === newText.game) {
        this.$store.dispatch("UPDATE_PTN", newText.ptn);
      }
    },
    gameName(newName, oldName) {
      if (oldName.game === newName.game) {
        this.$store.dispatch("SET_NAME", newName.name);
      }
    },
    right(visible) {
      if (visible) {
        this.hideNotifications();
      } else {
        this.showNotifications();
      }
    },
    "$store.state.notifyNotes"(visible) {
      if (visible) {
        this.showNotifications();
      } else {
        this.hideNotifications();
      }
    }
  },
  created() {
    if (!this.games.length) {
      this.$store.dispatch("ADD_GAME", {
        ptn: this.game.text(),
        name: this.game.name,
        state: this.game.state
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
    this.hideNotifications();
    this.showNotifications();
  },
  beforeDestroy() {
    window.removeEventListener("drop", this.openFiles);
    window.removeEventListener("dragover", this.nop);
    window.removeEventListener("dragleave", this.nop);
  }
};
</script>

<style lang="stylus">
footer
  .controls
    will-change height
    transition all $generic-hover-transition
    height 58px
    &:not(.visible)
      height 0

#left-drawer, #right-drawer
  .q-drawer
    background rgba($blue-grey-5, 0.75)
    .q-drawer__content
      overflow hidden

#right-drawer
  .q-tab-panel
    padding 0
</style>
