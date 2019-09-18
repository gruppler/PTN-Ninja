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
      <q-page ref="page" class="flex flex-center">
        <Board :game="game" :space="size" />
        <q-page-sticky position="top-left" :offset="[18, 18]">
          <FullscreenToggle class="dimmed-btn" color="white" />
        </q-page-sticky>
        <q-resize-observer @resize="resize" debounce="0" />
      </q-page>
    </q-page-container>

    <q-drawer
      v-model="left"
      side="left"
      :no-swipe-open="!Platform.has.touch"
      :no-swipe-close="!Platform.has.touch"
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
              class="no-border-radius"
            />
          </q-btn-group>
        </q-toolbar>
        <div class="col-grow relative-position">
          <PTN class="absolute-fit" :game="game" />
        </div>
        <q-toolbar class="footer-toolbar bg-secondary text-white q-pa-none">
          <q-btn-group class="full-width" spread stretch flat unelevated>
            <q-btn icon="undo" :title="$t('Undo')" class="no-border-radius" />
            <q-btn icon="redo" :title="$t('Redo')" />
            <TakButton :game="game" />
            <TinueButton :game="game" class="no-border-radius" />
          </q-btn-group>
        </q-toolbar>
      </div>
      <div class="gt-md absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-drawer
      v-model="right"
      side="right"
      :no-swipe-open="!Platform.has.touch"
      :no-swipe-close="!Platform.has.touch"
      persistent
    >
      <Notes class="fit" :game="game" />
    </q-drawer>

    <q-footer reveal>
      <Scrubber :game="game" v-if="$store.state.showScrubber" />
      <div class="controls" v-if="$store.state.showControls">
        <q-toolbar class="q-pa-sm bg-secondary text-white">
          <PlayControls :game="game" />
        </q-toolbar>
      </div>
    </q-footer>

    <NoteNotifications :game="game" />
    <GameNotifications :game="game" />
  </q-layout>
</template>

<script>
import Board from "../components/Board";
import Notes from "../components/Notes";
import PTN from "../components/PTN";
import GameNotifications from "../components/GameNotifications";
import NoteNotifications from "../components/NoteNotifications";
import PlayControls from "../components/PlayControls";
import Scrubber from "../components/Scrubber";
import CopyButton from "../components/CopyButton";
import TakButton from "../components/TakButton";
import TinueButton from "../components/TinueButton";
import FullscreenToggle from "../components/FullscreenToggle";

import Game from "../PTN/Game";
import { pick } from "lodash";
import { MIN_GAME_STATE_PROPS } from "../constants";

import { Platform } from "quasar";

export default {
  components: {
    Board,
    Notes,
    PTN,
    GameNotifications,
    NoteNotifications,
    PlayControls,
    Scrubber,
    CopyButton,
    TakButton,
    TinueButton,
    FullscreenToggle
  },
  props: ["ptn", "name", "state"],
  data() {
    return {
      Platform,
      game: Game.parse(this.ptn, { name: this.name, state: this.state }),
      size: null,
      notifyClosers: []
    };
  },
  computed: {
    gameState() {
      return pick(this.game.state, MIN_GAME_STATE_PROPS);
    },
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
    showAllBranches: {
      get() {
        return this.$store.state.showAllBranches;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["showAllBranches", value]);
      }
    },
    title() {
      return this.name || this.game.generateName();
    }
  },
  methods: {
    resize(size) {
      this.size = size;
      this.size.height = parseInt(this.$refs.page.style.minHeight, 10);
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
