<template>
  <q-layout class="non-selectable" view="lHh LpR lFr">
    <q-header elevated class="bg-ui">
      <q-toolbar class="q-pa-none">
        <q-btn
          icon="moves"
          @click="left = !left"
          :color="left ? 'primary' : ''"
          stretch
          flat
        />
        <q-toolbar-title id="title" class="ellipsis-2-lines">
          {{ title }}
        </q-toolbar-title>
        <q-btn icon="open_in_new" @click.prevent="openLink" stretch flat />
        <q-btn
          :icon="notifyNotes ? 'notes' : 'notes_off'"
          @click.left="right = !right"
          @click.right.prevent="notifyNotes = !notifyNotes"
          :color="right ? 'primary' : ''"
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
        @shortkey="$store.dispatch($event.srcKey, game)"
        class="overflow-hidden"
      >
        <div
          class="column absolute-fit"
          v-shortkey="hotkeys.MISC"
          @shortkey="miscShortkey"
        >
          <Board ref="board" class="col-grow" :game="game" />
        </div>
        <q-page-sticky position="top-left" :offset="[6, 6]">
          <BoardToggles />
        </q-page-sticky>
        <q-page-sticky position="bottom-left" :offset="[0, 0]">
          <CurrentMove />
        </q-page-sticky>
      </q-page>
    </q-page-container>

    <q-drawer
      v-model="left"
      side="left"
      :breakpoint="right ? doubleWidth : singleWidth"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <div class="absolute-fit column">
        <PTNTools ref="tools" :game="game">
          <ShareButton ref="shareButton" :game="game" flat stretch no-menu />
        </PTNTools>
        <div class="col-grow relative-position">
          <PTN class="absolute-fit" :game="game" />
        </div>
        <q-toolbar class="footer-toolbar bg-ui q-pa-none">
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
      <div class="gt-xs absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-drawer
      v-model="right"
      side="right"
      :breakpoint="left ? doubleWidth : singleWidth"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <Notes ref="notes" class="fit" :game="game" />
    </q-drawer>

    <q-footer>
      <Scrubber :game="game" />
      <q-toolbar v-show="$store.state.showControls" class="q-pa-sm bg-ui">
        <PlayControls :game="game" />
      </q-toolbar>
    </q-footer>

    <ErrorNotifications :errors="errors" />
    <GameNotifications :game="game" />
    <NoteNotifications :game="game" />
  </q-layout>
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
import EvalButtons from "../components/controls/EvalButtons";
import BoardToggles from "../components/controls/BoardToggles";
import ShareButton from "../components/controls/ShareButton";

import Game from "../PTN/Game";
import { HOTKEYS } from "../keymap";

import { Platform } from "quasar";
import { defaults, forEach } from "lodash";

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
    EvalButtons,
    BoardToggles,
    ShareButton,
  },
  props: ["ptn", "name", "state"],
  data() {
    return {
      Platform,
      game: this.getGame(),
      errors: [],
      hotkeys: HOTKEYS,
      defaults: { ...this.$store.state.embedConfig.ui },
      doubleWidth: 1025,
      singleWidth: this.$q.screen.sizes.sm,
    };
  },
  computed: {
    left: {
      get() {
        return this.$store.state.showPTN;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["showPTN", value]);
      },
    },
    right: {
      get() {
        return this.$store.state.showText;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["showText", value]);
      },
    },
    notifyNotes: {
      get() {
        return this.$store.state.notifyNotes;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["notifyNotes", value]);
      },
    },
    title() {
      return this.name || this.game.generateName();
    },
    url() {
      return this.$store.getters.url(this.game, { state: true });
    },
  },
  methods: {
    getGame() {
      let game;
      try {
        game = new Game(this.ptn, { name: this.name, state: this.state });
      } catch (error) {
        const name = game ? game.name : "";
        if (game && name) {
          game.name = name;
        }
        console.error(error);
        this.errors.push(this.$t(`error["${error.message}"]`));
      }
      return game;
    },
    openLink() {
      window.open(
        this.$store.getters.url(this.game, { origin: true, state: true }),
        "_blank"
      );
    },
    uiShortkey({ srcKey }) {
      this.$store.dispatch("TOGGLE_UI", srcKey);
    },
    miscShortkey({ srcKey }) {
      switch (srcKey) {
        case "editPTN":
          this.$refs.tools.editDialog = true;
          break;
        case "focusText":
          this.right = true;
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
    this.$store.commit("SET_EMBED_GAME");
    forEach(this.state, (value, key) => {
      this.$store.commit("SET_UI", [key, value]);
    });
    this.$store.dispatch("SET_THEME", this.$store.state.theme);
  },
  watch: {
    ptn() {
      this.game = this.getGame();
    },
    state: {
      handler(state, oldState) {
        let fullState = {};
        forEach(defaults(fullState, state, this.defaults), (value, key) => {
          this.$store.commit("SET_UI", [key, value]);
        });
        this.game.state.targetBranch =
          "targetBranch" in state ? state.targetBranch || "" : "";
        if ("plyIndex" in state && !("plyIndex" in oldState)) {
          const ply = this.game.state.plies[state.plyIndex];
          if (ply) {
            this.game.goToPly(ply.id, state.plyIsDone);
          }
        } else if ("plyIndex" in oldState && !("plyIndex" in state)) {
          this.game.goToPly(0, false);
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
