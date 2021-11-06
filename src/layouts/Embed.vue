<template>
  <q-layout v-if="gameExists" class="non-selectable" view="lHh LpR lFr">
    <q-header elevated class="bg-ui">
      <q-toolbar class="q-pa-none">
        <q-btn
          icon="moves"
          @click="showPTN = !showPTN"
          :color="showPTN ? 'primary' : ''"
          stretch
          flat
        />
        <q-toolbar-title id="title" class="ellipsis-2-lines">
          {{ title }}
        </q-toolbar-title>
        <q-btn icon="open_in_new" @click.prevent="openLink" stretch flat />
        <q-btn
          :icon="notifyNotes ? 'notes' : 'notes_off'"
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
      @shortkey="uiShortkey"
    >
      <q-page
        v-shortkey="hotkeys.ACTIONS"
        @shortkey="shortkeyAction"
        class="overflow-hidden"
      >
        <div
          class="column absolute-fit"
          v-shortkey="hotkeys.MISC"
          @shortkey="miscShortkey"
        >
          <Board ref="board" class="col-grow" :hide-names="!showNames" />
        </div>
        <q-page-sticky position="top-right" :offset="[6, 6]">
          <BoardToggles />
        </q-page-sticky>
        <q-page-sticky position="bottom" :offset="[0, 0]">
          <CurrentMove />
        </q-page-sticky>
      </q-page>
    </q-page-container>

    <q-drawer
      v-model="showPTN"
      side="left"
      :breakpoint="showText ? doubleWidth : singleWidth"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <div class="absolute-fit column">
        <PTNTools ref="tools">
          <ShareButton ref="shareButton" flat stretch no-menu />
        </PTNTools>
        <div class="col-grow relative-position">
          <PTN class="absolute-fit" />
        </div>
        <q-toolbar class="footer-toolbar bg-ui q-pa-none">
          <UndoButtons spread stretch flat unelevated />
          <EvalButtons class="full-width" spread stretch flat unelevated />
        </q-toolbar>
      </div>
      <div class="gt-xs absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-drawer
      v-model="showText"
      side="right"
      :breakpoint="showPTN ? doubleWidth : singleWidth"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <Notes ref="notes" class="fit" />
    </q-drawer>

    <q-footer>
      <Scrubber />
      <q-toolbar v-show="$store.state.ui.showControls" class="q-pa-sm bg-ui">
        <PlayControls />
      </q-toolbar>
    </q-footer>

    <router-view no-route-dismiss />

    <ErrorNotifications :errors="errors" />
    <GameNotifications />
    <NoteNotifications />
  </q-layout>
  <q-dialog v-else :value="true"> No Game </q-dialog>
</template>

<script>
// Essentials:
import Board from "../components/board/Board";
import CurrentMove from "../components/board/CurrentMove";
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
import UndoButtons from "../components/controls/UndoButtons";
import EvalButtons from "../components/controls/EvalButtons";
import BoardToggles from "../components/controls/BoardToggles";
import ShareButton from "../components/controls/ShareButton";

import Game from "../Game";
import { HOTKEYS } from "../keymap";

import { Platform } from "quasar";
import { defaults, forEach, isEqual } from "lodash";

export default {
  components: {
    Board,
    CurrentMove,
    PTN,
    Notes,
    ErrorNotifications,
    GameNotifications,
    NoteNotifications,
    PlayControls,
    Scrubber,
    PTNTools,
    UndoButtons,
    EvalButtons,
    BoardToggles,
    ShareButton,
  },
  props: ["ptn", "name", "state"],
  data() {
    return {
      Platform,
      errors: [],
      hotkeys: HOTKEYS,
      defaults: { ...this.$store.state.ui.embedConfig.ui },
      doubleWidth: 1025,
      singleWidth: this.$q.screen.sizes.sm,
      nameOverride: null,
      showNames: true,
    };
  },
  computed: {
    gameExists() {
      return Boolean(this.$game);
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
    notifyNotes: {
      get() {
        return this.$store.state.ui.notifyNotes;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["notifyNotes", value]);
      },
    },
    title() {
      return this.nameOverride !== null ? this.nameOverride : this.name;
    },
    url() {
      return this.$store.getters["ui/url"](this.$game, { state: true });
    },
  },
  methods: {
    getGame() {
      let game;
      try {
        game = new Game({ ptn: this.ptn, name: this.name, board: this.board });
      } catch (error) {
        const name = game ? game.name : "";
        if (game && name) {
          game.name = name;
        }
        console.error(error);
        this.errors.push(this.$t(`error["${error.message}"]`));
      }
      this.$store.dispatch("game/SET_GAME", game);
    },
    openLink() {
      window.open(
        this.$store.getters["ui/url"](this.$game, {
          origin: true,
          state: true,
        }),
        "_blank"
      );
    },
    undo() {
      return $store.dispatch("game/UNDO");
    },
    redo() {
      return $store.dispatch("game/REDO");
    },
    shortkeyAction(event) {
      this.$store.dispatch(event.srcKey);
    },
    uiShortkey({ srcKey }) {
      this.$store.dispatch("ui/TOGGLE_UI", srcKey);
    },
    miscShortkey({ srcKey }) {
      switch (srcKey) {
        case "editPTN":
          this.$refs.tools.editDialog = true;
          break;
        case "focusText":
          this.showText = true;
          this.$refs.notes.$refs.input.focus();
          break;
        case "qrCode":
          if (this.$refs.shareButton.qrDialog) {
            this.$refs.shareButton.qrDialog = false;
          } else {
            this.$refs.shareButton.qrCode();
          }
          break;
        case "share":
          this.$refs.shareButton.share();
          break;
      }
    },
  },
  beforeCreate() {
    if (location.hash.length) {
      const url = location.hash.substr(1);
      location.hash = "";
      this.$router.replace(url);
      location.reload();
    }
  },
  created() {
    this.$store.commit("ui/SET_EMBED_GAME");
    forEach(this.state, (value, key) => {
      if (!isEqual(value, this.$store.state[key])) {
        this.$store.commit("ui/SET_UI", [key, value]);
      }
    });
    this.$store.dispatch("ui/SET_THEME", this.$store.state.ui.theme);
    this.getGame();

    // Embed API
    const handleMessage = ({ data }) => {
      switch (data.action) {
        case "SET_NAME":
          this.nameOverride = data.value;
          break;
        case "SET_UI":
          Object.keys(data.value).forEach((key) => {
            this.$store.dispatch("ui/SET_UI", [key, data.value[key]]);
          });
          break;
        case "TOGGLE_UI":
          this.$store.dispatch("ui/TOGGLE_UI", data.action);
          break;
        case "SHOW_NAMES":
          this.showNames = data.value;
          break;
        case "SET_GAME":
        case "SELECT_SQUARE":
        case "SELECT_PIECE":
        case "DELETE_PLY":
        case "DELETE_BRANCH":
        case "SET_TARGET":
        case "GO_TO_PLY":
        case "RENAME_BRANCH":
        case "TOGGLE_EVALUATION":
        case "EDIT_NOTE":
        case "ADD_NOTE":
        case "REMOVE_NOTE":
          this.$store.dispatch("game/" + data.action, data.value);
          break;
        case "FIRST":
        case "LAST":
        case "PREV":
        case "NEXT":
        case "UNDO":
        case "REDO":
        case "TRIM_BRANCHES":
        case "TRIM_TO_BOARD":
        case "TRIM_TO_PLY":
        case "CANCEL_MOVE":
          this.$store.dispatch("game/" + data.action);
          break;
        case "NOTIFY":
        case "NOTIFY_ERROR":
        case "NOTIFY_SUCCESS":
        case "NOTIFY_WARNING":
        case "NOTIFY_HINT":
          this.$store.dispatch("ui/" + data.action, data.value);
          break;
        case "RESET_TRANSFORM":
        case "ROTATE_180":
        case "ROTATE_LEFT":
        case "ROTATE_RIGHT":
        case "FLIP_HORIZONTAL":
        case "FLIP_VERTICAL":
          this.$store.dispatch("ui/" + data.action);
          break;
        default:
          if (data.action) {
            throw "Invalid message: " + data.action;
          }
      }
    };
    if (process.env.DEV) {
      window.removeEventListener("message", handleMessage);
    }
    window.addEventListener("message", handleMessage);
  },
  watch: {
    ptn() {
      this.$game = this.getGame();
    },
    state: {
      handler(state, oldState) {
        let fullState = {};
        forEach(defaults(fullState, state, this.defaults), (value, key) => {
          this.$store.commit("ui/SET_UI", [key, value]);
        });
        this.$game.board.targetBranch =
          "targetBranch" in state ? state.targetBranch || "" : "";
        if ("plyIndex" in state && !("plyIndex" in oldState)) {
          const ply = this.$game.board.plies[state.plyIndex];
          if (ply) {
            this.$store.dispatch("game/GO_TO_PLY", {
              ply: ply.id,
              isDone: state.plyIsDone,
            });
          }
        } else if ("plyIndex" in oldState && !("plyIndex" in state)) {
          this.$store.dispatch("game/GO_TO_PLY", { ply: 0, isDone: false });
        }
      },
      deep: true,
    },
  },
};
</script>

<style lang="scss">
.q-drawer {
  background: $panel;
  background: var(--q-color-panel);
}

@media (max-width: $breakpoint-xs-max) {
  #title {
    font-size: 1.2em;
    white-space: normal;
    line-height: 1.25em;
  }
}
</style>
