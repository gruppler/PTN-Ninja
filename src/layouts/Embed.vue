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
        <q-toolbar-title>{{ title }}</q-toolbar-title>
        <q-btn
          icon="open_in_new"
          :to="url"
          @click.prevent="openLink"
          stretch
          flat
        />
        <q-btn
          :icon="notifyNotes ? 'speaker_notes' : 'speaker_notes_off'"
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
          <SmoothReflow
            @click.right.self.prevent="$refs.board.resetBoardRotation"
            class="board-move-container"
          >
            <Move
              v-if="game.state.move"
              v-show="game.state.ply && $store.state.showMove"
              class="q-mb-md q-mx-md"
              :class="{ 'lt-md': $store.state.showPTN }"
              :move="game.state.move"
              :game="game"
              separate-branch
              current-only
              standalone
            />
          </SmoothReflow>
        </div>
        <q-page-sticky position="top-left" :offset="[18, 18]">
          <BoardToggles />
        </q-page-sticky>
      </q-page>
    </q-page-container>

    <q-drawer
      v-model="left"
      side="left"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <div class="absolute-fit column">
        <PTNTools ref="tools" :game="game" />
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
      <div class="gt-md absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-drawer
      v-model="right"
      side="right"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <Notes ref="notes" class="fit" :game="game" />
    </q-drawer>

    <q-footer reveal>
      <Scrubber :game="game" v-if="$store.state.showScrubber" />
      <q-toolbar
        v-show="$store.state.showControls"
        class="q-pa-sm bg-secondary text-white"
      >
        <PlayControls :game="game" />
      </q-toolbar>
    </q-footer>

    <NoteNotifications :game="game" />
    <GameNotifications :game="game" />
  </q-layout>
</template>

<script>
// Essentials:
import Board from "../components/board/Board";
import Move from "../components/PTN/Move";
import PTN from "../components/drawers/PTN";
import Notes from "../components/drawers/Notes";

// Notifications:
import GameNotifications from "../components/notify/GameNotifications";
import NoteNotifications from "../components/notify/NoteNotifications";

// Controls:
import PlayControls from "../components/controls/PlayControls";
import Scrubber from "../components/controls/Scrubber";
import PTNTools from "../components/controls/PTNTools";
import EvalButtons from "../components/controls/EvalButtons";
import BoardToggles from "../components/controls/BoardToggles";

import Game from "../PTN/Game";
import { HOTKEYS } from "../keymap";

import { Platform } from "quasar";
import { defaults, pick } from "lodash";

export default {
  components: {
    Board,
    Move,
    PTN,
    Notes,
    GameNotifications,
    NoteNotifications,
    PlayControls,
    Scrubber,
    PTNTools,
    EvalButtons,
    BoardToggles
  },
  props: ["ptn", "name", "state"],
  data() {
    return {
      Platform,
      game: new Game(this.ptn, { name: this.name, state: this.state }),
      hotkeys: HOTKEYS,
      defaults: pick(
        this.$store.state.defaults,
        this.$store.state.embedUIOptions
      )
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
    notifyNotes: {
      get() {
        return this.$store.state.notifyNotes;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["notifyNotes", value]);
      }
    },
    title() {
      return this.name || this.game.generateName();
    },
    url() {
      return this.$store.getters.url(this.game, { state: true });
    }
  },
  methods: {
    openLink() {
      window.open(location.origin + "/?#/" + this.url, "_blank");
    },
    uiShortkey({ srcKey }) {
      if (!(srcKey in this.state)) {
        this.$store.dispatch("TOGGLE_UI", srcKey);
      }
    },
    miscShortkey({ srcKey }) {
      switch (srcKey) {
        case "editPTN":
          this.$refs.tools.edit = true;
          break;
        case "focusText":
          this.right = true;
          this.$refs.notes.$refs.input.focus();
          break;
      }
    }
  },
  created() {
    this.$q.dark.set(true);
    this.$store.commit("SET_EMBED_GAME");
    Object.keys(this.state).forEach(key => {
      this.$store.commit("SET_UI", [key, this.state[key]]);
    });
  },
  watch: {
    state: {
      handler(state, oldState) {
        let fullState = {};
        Object.keys(defaults(fullState, state, this.defaults)).forEach(key => {
          this.$store.commit("SET_UI", [key, fullState[key]]);
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
      deep: true
    }
  }
};
</script>

<style lang="stylus">
.q-drawer
  background rgba($blue-grey-5, 0.75)
</style>
