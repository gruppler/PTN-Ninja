<template>
  <q-layout class="non-selectable" view="lHr LpR lFr">
    <q-header elevated class="bg-secondary text-white">
      <q-toolbar>
        <q-btn
          icon="notes"
          @click="left = !left"
          :color="left ? 'accent' : ''"
          flat
          dense
        />
        <q-toolbar-title>{{ title }}</q-toolbar-title>
        <q-btn
          icon="chat"
          @click="right = !right"
          :color="right ? 'accent' : ''"
          flat
          dense
        />
      </q-toolbar>
    </q-header>

    <q-page-container class="bg-primary">
      <q-page ref="page" class="flex flex-center">
        <Board :game="game" :space="size" />
        <q-page-sticky position="bottom-right" :offset="[18, 18]">
          <FullscreenToggle color="white" />
        </q-page-sticky>
        <q-resize-observer @resize="resize" debounce="0" />
      </q-page>
    </q-page-container>

    <q-drawer v-model="left" side="left" persistent>
      <div class="absolute-fit column">
        <q-toolbar class="bg-secondary text-white"></q-toolbar>
        <div class="col-grow relative-position">
          <PTN class="absolute-fit" :game="game" />
        </div>
        <q-toolbar class="footer-toolbar bg-secondary text-white"></q-toolbar>
      </div>
      <div class="gt-md absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-drawer v-model="right" side="right" persistent>
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
  </q-layout>
</template>

<script>
import Board from "../components/Board";
import Notes from "../components/Notes";
import PTN from "../components/PTN";
import PlayControls from "../components/PlayControls";
import Scrubber from "../components/Scrubber";
import FullscreenToggle from "../components/FullscreenToggle";

import Game from "../PTN/Game";
import { pick } from "lodash";
import { GAME_STATE_PROPS } from "../constants";

export default {
  components: {
    Board,
    Notes,
    PTN,
    PlayControls,
    Scrubber,
    FullscreenToggle
  },
  props: ["ptn", "name", "state"],
  data() {
    return {
      game: Game.parse(this.ptn, { name: this.name, state: this.state }),
      size: null,
      notifyClosers: []
    };
  },
  computed: {
    gameState() {
      return pick(this.game.state, GAME_STATE_PROPS);
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
    title() {
      return this.name || this.game.generateName();
    }
  },
  methods: {
    resize(size) {
      this.size = size;
      this.size.height = parseInt(this.$refs.page.style.minHeight, 10);
    },
    showNotifications() {
      if (this.right) {
        console.log(this.right);
        return;
      }
      const ply = this.game.state.ply;

      if (
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

      if (ply && ply.result) {
        let result = ply.result;
        let color = result.winner === 1 ? "grey-10" : "grey-2";
        this.notifyClosers.push(
          this.$q.notify({
            color: result.winner === 1 ? "blue-grey-2" : "blue-grey-10",
            message: this.$t("result." + result.type, {
              player: this.game.tags["player" + result.winner].value
            }),
            icon: result.winner === 1 ? "person" : "person_outline",
            position: "top-right",
            actions: [{ icon: "close", color }],
            classes: "note text-" + color,
            timeout: 0
          })
        );
      }
    },
    hideNotifications() {
      this.notifyClosers.forEach(close => close());
      this.notifyClosers = [];
    }
  },
  watch: {
    gameState(newState, oldState) {
      if (oldState.plyID !== newState.plyID) {
        this.hideNotifications();
        this.showNotifications();
      }
    },
    right(visible) {
      if (visible) {
        this.hideNotifications();
      } else {
        this.showNotifications();
      }
    }
  },
  created() {
    this.$store.commit("SET_EMBED_GAME");
    Object.keys(this.state).forEach(key => {
      this.$store.commit("SET_UI", [key, this.state[key]]);
    });
  },
  mounted() {
    this.hideNotifications();
    this.showNotifications();
  }
};
</script>

<style lang="stylus">
.q-drawer
  background rgba($blue-grey-5, 0.75)
</style>
