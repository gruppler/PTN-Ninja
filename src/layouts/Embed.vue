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
        >
          <hint>{{ $t(showPTN ? "Hide PTN" : "Show PTN") }}</hint>
        </q-btn>
        <q-toolbar-title id="title" class="ellipsis-2-lines">
          {{ title }}
        </q-toolbar-title>
        <q-btn icon="info" @click.prevent="info" stretch flat>
          <hint>{{ $t("View Game Info") }}</hint>
        </q-btn>
        <q-btn icon="open_in_new" @click.prevent="openLink" stretch flat>
          <hint>{{ $t("app_title") }}</hint>
        </q-btn>
        <q-btn
          :icon="notifyNotes ? 'notes' : 'notes_off'"
          @click.left="showText = !showText"
          @click.right.prevent="notifyNotes = !notifyNotes"
          :color="showText ? 'primary' : ''"
          stretch
          flat
        >
          <hint>{{ $t(showText ? "Hide Notes" : "Show Notes") }}</hint>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-page-container
      class="bg-bg"
      v-shortkey="hotkeys.UI"
      @shortkey="uiShortkey"
    >
      <q-page
        v-shortkey="hotkeys.DIALOGS"
        @shortkey="dialogShortkey"
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
          <BoardToggles v-if="!isDialogShowing" />
        </q-page-sticky>
        <q-page-sticky position="bottom" :offset="[0, 0]">
          <CurrentMove />
        </q-page-sticky>
      </q-page>
    </q-page-container>

    <q-drawer
      id="left-drawer"
      v-model="showPTN"
      side="left"
      :breakpoint="showText ? doubleWidth : singleWidth"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <div class="absolute-fit column">
        <PTN-Tools ref="tools">
          <ShareButton flat stretch no-menu />
        </PTN-Tools>
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
      id="right-drawer"
      v-model="showText"
      side="right"
      :breakpoint="showPTN ? doubleWidth : singleWidth"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <Notes ref="notes" class="fit" />
    </q-drawer>

    <q-footer class="bg-ui">
      <Scrubber />
      <q-toolbar v-show="$store.state.ui.showControls" class="footer-toolbar">
        <PlayControls ref="playControls" />
      </q-toolbar>
    </q-footer>

    <router-view ref="dialog" go-back no-route-dismiss />

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
  name: "EmbedLayout",
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
      title: "",
      defaults: { ...this.$store.state.ui.embedConfig.ui },
      doubleWidth: 1025,
      singleWidth: this.$q.screen.sizes.sm,
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
    url() {
      return this.$store.getters["ui/url"](this.$game, { state: true });
    },
    isDialogShowing() {
      return !["local", "game"].includes(this.$route.name);
    },
  },
  methods: {
    getGame() {
      if (!this.ptn) {
        this.$store.dispatch(
          "game/SET_GAME",
          new Game({ tags: { size: this.$store.state.ui.size } })
        );
        return;
      }
      let game;
      try {
        game = new Game({
          ptn: this.ptn,
          name: this.name,
          board: this.board,
          state: this.state,
        });
      } catch (error) {
        const name = game ? game.name : "";
        if (game && name) {
          game.name = name;
        }
        console.error(error);
        this.errors.push(this.$t(`error["${error.message}"]`));
      }
      this.$store.dispatch("game/SET_GAME", game);
      this.$router.replace("/");
    },
    info() {
      this.$router.push({ name: "info-view" });
    },
    openLink() {
      window.open(
        this.$store.getters["ui/url"](this.$game, {
          name: this.title,
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
    uiShortkey({ srcKey }) {
      this.$store.dispatch("ui/TOGGLE_UI", srcKey);
    },
    dialogShortkey({ srcKey }) {
      switch (srcKey) {
        case "gameInfo":
          if (this.$route.name !== "info-view") {
            this.$router.push({ name: "info-view" });
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
        case "qrCode":
          if (this.$route.name !== "qr") {
            this.$router.push({ name: "qr" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
      }
    },
    miscShortkey({ srcKey }) {
      switch (srcKey) {
        case "focusText":
          this.showText = true;
          this.$refs[
            this.hasChat && this.textTab === "chat" ? "chat" : "notes"
          ].$refs.input.focus();
          break;
        case "game/UNDO":
        case "game/REDO":
          this.$store.dispatch(srcKey);
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
    this.title = this.name || this.$game.generateName();
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

@media (max-width: $breakpoint-xs-max) {
  #title {
    font-size: 1.2em;
    white-space: normal;
    line-height: 1.25em;
  }
}
</style>
