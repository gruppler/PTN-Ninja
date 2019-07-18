<template>
  <q-layout class="non-selectable" view="hHh LpR fFf">
    <q-header elevated class="bg-secondary text-white">
      <q-toolbar>
        <q-btn flat round icon="notes" @click="left = !left" />
        <q-toolbar-title>{{ title }}</q-toolbar-title>
        <q-btn flat round icon="chat" @click="right = !right" />
      </q-toolbar>
    </q-header>

    <q-page-container class="bg-primary">
      <q-page class="flex flex-center">
        <Board :game="game" :space="size" />
        <q-resize-observer @resize="resize" />
      </q-page>
    </q-page-container>

    <q-drawer v-model="left" side="left" persistent bordered>
      <PTN class="fit" :game="game" />
    </q-drawer>

    <q-drawer v-model="right" side="right" persistent bordered>
      <Notes class="fit" :game="game" />
    </q-drawer>

    <q-footer reveal>
      <q-linear-progress v-if="showProgress" :value="progress" color="accent" />
      <q-toolbar v-if="showControls" class="q-pa-sm bg-secondary text-white">
        <PlayControls />
      </q-toolbar>
    </q-footer>
  </q-layout>
</template>

<script>
import Board from "../components/Board";
import Notes from "../components/Notes";
import PTN from "../components/PTN";
import PlayControls from "../components/PlayControls";

import Game from "../components/PTN/Game";

export default {
  components: {
    Board,
    Notes,
    PTN,
    PlayControls
  },
  props: ["ptn", "name", "state"],
  data() {
    return {
      size: null
    };
  },
  computed: {
    left() {
      return this.state.showPTN;
    },
    right() {
      return this.state.showText;
    },
    showControls() {
      return this.state.showControls;
    },
    showProgress() {
      return this.$store.state.showProgress;
    },
    progress() {
      return (
        (this.game.state.ply.index + 1 * this.game.state.plyIsDone) /
        this.game.state.plies.length
      );
    },
    game() {
      return Game.parse(this.ptn, { name: this.name, state: this.state });
    },
    title() {
      return this.name || this.game.generateName();
    }
  },
  methods: {
    resize(size) {
      this.size = size;
    }
  },
  mounted() {
    this.$store.commit("SET_EMBED_GAME", this.game);
  }
};
</script>

<style lang="stylus">
.q-drawer
  background rgba($blue-grey-5, 0.75)
</style>
