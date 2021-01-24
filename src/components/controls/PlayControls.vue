<template>
  <div class="play-controls full-width justify-center">
    <div class="row no-wrap justify-around items-center">
      <q-btn
        @click="deletePly"
        @shortkey="deletePly"
        v-shortkey="{
          delete: hotkeys.deletePly,
          backspace: hotkeys.backspacePly,
        }"
        round
        flat
        :color="fg"
        :ripple="false"
        :disable="!game.state.ply || plyInProgress"
        icon="backspace"
      />
      <q-btn
        @click="first"
        @shortkey="first"
        v-shortkey="hotkeys.first"
        round
        flat
        :color="fg"
        :ripple="false"
        :disable="isFirst || plyInProgress"
        icon="first"
      />
      <q-btn
        @click="prev"
        @click.right.prevent="prev(true)"
        @shortkey="prev"
        v-shortkey="{
          whole: hotkeys.prev,
          half: hotkeys.prevHalf,
        }"
        round
        flat
        :color="fg"
        :ripple="false"
        :disable="isFirst || plyInProgress"
        icon="backward"
      />
      <q-btn
        @click="playpause"
        @shortkey="playpause"
        v-shortkey="hotkeys.playpause"
        round
        :ripple="false"
        color="primary"
        :text-color="primaryFG"
        :disable="!game.state.ply || plyInProgress"
        :icon="isPlaying ? 'pause' : 'play'"
      />
      <q-btn
        @click="next"
        @click.right.prevent="next(true)"
        @shortkey="next"
        v-shortkey="{
          whole: hotkeys.next,
          half: hotkeys.nextHalf,
        }"
        round
        flat
        :color="fg"
        :ripple="false"
        :disable="isLast || plyInProgress"
        icon="forward"
      />
      <q-btn
        @click="last"
        @shortkey="last"
        v-shortkey="hotkeys.last"
        round
        flat
        :color="fg"
        :ripple="false"
        :disable="isLast || plyInProgress"
        icon="last"
      />
      <q-btn
        v-shortkey="{ ...options, ...branchControls }"
        @shortkey="branchKey"
        round
        flat
        :ripple="false"
        :disable="branches.length < 2 || plyInProgress"
        :color="hasBranches ? 'primary' : fg"
      >
        <q-icon name="branch" class="rotate-180" />
        <BranchMenu
          v-if="$store.state.ui.showControls"
          ref="branchMenu"
          v-model="branchMenu"
          @select="selectBranch"
          :branches="branches"
          linenum
        />
      </q-btn>
    </div>
  </div>
</template>

<script>
import BranchMenu from "./BranchMenu";

import { flatten, omit, pick, throttle, uniq, zipObject } from "lodash";
import { HOTKEYS } from "../../keymap";

const BRANCH_KEYS = [
  "branchMenu",
  "prevBranch",
  "nextBranch",
  "prevBranchEnd",
  "nextBranchEnd",
  "firstBranch",
  "lastBranch",
  "firstBranchEnd",
  "lastBranchEnd",
];

export default {
  name: "PlayControls",
  components: { BranchMenu },
  data() {
    return {
      isPlaying: false,
      timer: null,
      timestamp: null,
      next: null,
      prev: null,
      branchMenu: false,
      hotkeys: omit(HOTKEYS.CONTROLS, BRANCH_KEYS),
      branchControls: pick(HOTKEYS.CONTROLS, BRANCH_KEYS),
    };
  },
  computed: {
    game() {
      return this.$store.state.game.current;
    },
    fg() {
      return this.$store.state.ui.theme.isDark ? "textLight" : "textDark";
    },
    primaryFG() {
      return this.$store.state.ui.theme.primaryDark ? "textLight" : "textDark";
    },
    isFirst() {
      return !this.game.state.prevPly && !this.game.state.plyIsDone;
    },
    isLast() {
      return (
        (!this.game.state.nextPly && this.game.state.plyIsDone) ||
        !this.game.state.ply
      );
    },
    plyInProgress() {
      return this.game.state.selected.pieces.length !== 0;
    },
    hasBranches() {
      return !!(this.game.state.ply && this.game.state.ply.branches.length > 1);
    },
    branches() {
      return uniq(
        flatten(Object.values(this.game.branches).map((ply) => ply.branches))
      );
    },
    branchIndex() {
      return this.$refs.branchMenu.selected;
    },
    options() {
      return zipObject(
        Object.keys(this.branches),
        Object.keys(this.branches).map((key) => [key])
      );
    },
  },
  methods: {
    deletePly() {
      if (this.game.state.ply && !this.plyInProgress) {
        this.$store.dispatch("game/DELETE_PLY", this.game.state.plyID);
      }
    },
    play() {
      if (!this.isLast) {
        this.isPlaying = true;
        this.next(true);
      }
    },
    pause() {
      if (this.isPlaying) {
        clearTimeout(this.timer);
        this.isPlaying = false;
      }
    },
    playpause() {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    },
    first() {
      if (!this.isFirst) {
        this.$store.dispatch("game/FIRST");
      }
    },
    _prev(event) {
      requestAnimationFrame(() => {
        if (this.isPlaying) {
          clearTimeout(this.timer);
          this.timer = setTimeout(
            this.next,
            6e4 / this.$store.state.ui.playSpeed
          );
          this.timestamp = new Date().getTime();
        }
        if (!this.isFirst) {
          this.$store.dispatch(
            "game/PREV",
            event === true || event.srcKey === "half"
          );
        }
      });
    },
    _next(event) {
      requestAnimationFrame(() => {
        if (this.isPlaying) {
          clearTimeout(this.timer);
          this.timer = setTimeout(
            this.next,
            6e4 / this.$store.state.ui.playSpeed
          );
          this.timestamp = new Date().getTime();
        }
        if (!this.isLast) {
          this.isPlaying =
            this.$store.dispatch(
              "game/NEXT",
              this.isPlaying || event === true || event.srcKey === "half"
            ) && this.isPlaying;
          if (this.isLast && this.isPlaying) {
            this.pause();
          }
        }
      });
    },
    last() {
      if (!this.isLast) {
        this.$store.dispatch("game/LAST");
        if (this.isPlaying) {
          this.pause();
        }
      }
    },
    selectBranch(ply) {
      this.$store.dispatch("game/SET_TARGET", ply);
      this.$store.dispatch("game/GO_TO_PLY", { ply: ply.id, isDone: true });
    },
    branchKey({ srcKey }) {
      switch (srcKey) {
        case "branchMenu":
          if (this.branches.length) {
            this.branchMenu = !this.branchMenu;
          }
          break;
        case "prevBranch":
        case "nextBranch":
        case "prevBranchEnd":
        case "nextBranchEnd":
        case "firstBranch":
        case "lastBranch":
        case "firstBranchEnd":
        case "lastBranchEnd":
          this[srcKey]();
          break;
        default:
          this.selectBranch(this.branches[srcKey]);
      }
    },
    prevBranch() {
      if (this.branches.length && this.branchIndex > 0) {
        this.selectBranch(this.branches[this.branchIndex - 1]);
      }
    },
    nextBranch() {
      if (this.branches.length && this.branchIndex < this.branches.length - 1) {
        this.selectBranch(this.branches[this.branchIndex + 1]);
      }
    },
    prevBranchEnd() {
      this.prevBranch();
      this.last();
    },
    nextBranchEnd() {
      this.nextBranch();
      this.last();
    },
    firstBranch() {
      if (this.branches.length) {
        this.selectBranch(this.branches[0]);
      }
    },
    lastBranch() {
      if (this.branches.length) {
        this.selectBranch(this.branches[this.branches.length - 1]);
      }
    },
    firstBranchEnd() {
      this.firstBranch();
      this.last();
    },
    lastBranchEnd() {
      this.lastBranch();
      this.last();
    },
  },
  watch: {
    // Make playback speed respond immediately to speed changes
    "$store.state.ui.playSpeed"(speed) {
      let now = new Date().getTime();
      let nextFrame = this.timestamp + 6e4 / speed;

      if (this.isPlaying) {
        if (nextFrame < now) {
          this.next();
        } else {
          clearTimeout(this.timer);
          setTimeout(this.next, nextFrame - now);
        }
      }
    },
  },
  created() {
    this.next = throttle(this._next, 250);
    this.prev = throttle(this._prev, 250);
  },
};
</script>

<style lang="scss">
.play-controls {
  .q-btn.disabled {
    opacity: 0.3 !important;
  }

  .row {
    max-width: 500px;
    margin: 0 auto;
  }
}
</style>
