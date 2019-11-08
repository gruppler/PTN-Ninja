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
          icon="chat"
          @click="right = !right"
          :color="right ? 'accent' : ''"
          stretch
          flat
        />
      </q-toolbar>
    </q-header>

    <q-page-container class="bg-primary">
      <q-page
        v-shortkey="hotkeys.ACTIONS"
        @shortkey="$store.dispatch($event.srcKey, game)"
        class="overflow-hidden"
      >
        <div class="column absolute-fit">
          <Board class="col-grow" :game="game" />
          <div class="text-center">
            <Move
              v-if="game.state.move"
              v-show="game.state.ply && $store.state.showMove"
              class="q-mb-md q-mx-md"
              :class="{ 'lt-md': $store.state.showPTN }"
              :key="game.state.move.id"
              :move="game.state.move"
              :game="game"
              currentOnly
              standalone
            />
          </div>
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
        <PTNTools :game="game" />
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
      <Notes class="fit" :game="game" />
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
import Board from "../components/Board";
import Move from "../components/Move";
import Notes from "../components/Notes";
import PTN from "../components/PTN";
import GameNotifications from "../components/GameNotifications";
import NoteNotifications from "../components/NoteNotifications";
import PlayControls from "../components/PlayControls";
import Scrubber from "../components/Scrubber";
import PTNTools from "../components/PTNTools";
import EvalButtons from "../components/EvalButtons";
import BoardToggles from "../components/BoardToggles";

import Game from "../PTN/Game";
import { HOTKEYS } from "../keymap";

import { Platform } from "quasar";

export default {
  components: {
    Board,
    Move,
    Notes,
    PTN,
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
    title() {
      return this.name || this.game.generateName();
    }
  },
  created() {
    this.$store.commit("SET_EMBED_GAME");
    Object.keys(this.state).forEach(key => {
      this.$store.commit("SET_UI", [key, this.state[key]]);
    });
  }
};
</script>

<style lang="stylus">
.q-drawer
  background rgba($blue-grey-5, 0.75)
</style>
