<template>
  <q-layout class="non-selectable" view="hHh LpR fFf">
    <q-header elevated class="bg-secondary text-white">
      <q-toolbar>
        <q-btn icon="notes" @click="left = !left" flat dense />
        <QToolbarTitle>
          <GameSelector :games="games" @input="updateGame" @edit="edit" />
        </QToolbarTitle>
        <q-btn icon="chat" @click="right = !right" flat dense />
      </q-toolbar>
    </q-header>

    <q-page-container class="bg-primary">
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
          <q-tab name="chat">{{ $t("Chat") }}</q-tab>
          <q-tab name="notes">{{ $t("Notes") }}</q-tab>
        </q-tabs>
        <q-tab-panels class="col-grow bg-transparent" :value="textTab" animated>
          <q-tab-panel name="chat">
            <Chat class="fit" :game="game" />
          </q-tab-panel>
          <q-tab-panel name="notes">
            <Notes class="fit" :game="game" />
          </q-tab-panel>
        </q-tab-panels>
      </div>
    </q-drawer>

    <q-footer reveal>
      <q-linear-progress
        :class="{ visible: showProgress }"
        :value="progress"
        color="accent"
      />
      <div class="controls" :class="{ visible: showControls }">
        <q-toolbar class="q-pa-sm bg-secondary text-white">
          <PlayControls :game="game" />
        </q-toolbar>
      </div>
    </q-footer>

    <q-dialog v-model="dialogNewGame">
      <NewGame />
    </q-dialog>

    <EditGame v-model="dialogEditGame" :game="game" />

    <q-dialog v-model="dialogUISettings">
      <UISettings />
    </q-dialog>
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
import NewGame from "../components/NewGame";
import EditGame from "../components/EditGame";
import UISettings from "../components/UISettings";

import Game from "../components/PTN/Game";
import { each, pick } from "lodash";
import { GAME_STATE_PROPS } from "../constants";

export default {
  components: {
    Board,
    Notes,
    Chat,
    GameSelector,
    Menu,
    PTN,
    PlayControls,
    NewGame,
    EditGame,
    UISettings
  },
  props: ["ptn", "state", "name"],
  data() {
    return {
      game: this.getGame(),
      dialogNewGame: false,
      dialogUISettings: false,
      dialogEditGame: false,
      size: null
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
    showControls() {
      return this.$store.state.showControls;
    },
    showProgress() {
      return this.$store.state.showProgress;
    },
    progress() {
      return this.game.state.plies && this.game.state.plies.length
        ? (this.game.state.ply.index + 1 * this.game.state.plyIsDone) /
            this.game.state.plies.length
        : 0;
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
          this.dialogNewGame = true;
          break;
        case "settings":
          this.dialogUISettings = true;
          break;
        default:
          console.log(action);
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
      }
    },
    gameText(newText, oldText) {
      if (oldText.game === newText.game) {
        this.$store.dispatch("UPDATE_PTN", newText.ptn);
      }
    }
  },
  created() {
    Game.importLang(this.$t);
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
  .controls, .q-linear-progress
    will-change height
    transition all $generic-hover-transition
    &:not(.visible)
      height 0
  .controls
    height 58px


#left-drawer, #right-drawer
  .q-drawer
    background rgba($blue-grey-5, 0.75)
    .q-drawer__content
      overflow hidden

#right-drawer
  .q-tab-panel
    padding 0
</style>
