<template>
  <div class="play-controls absolute-fit justify-center">
    <div class="row no-wrap justify-around items-center full-height">
      <q-btn
        @click="deletePly"
        @shortkey="deletePly"
        v-shortkey="{
          delete: hotkeys.deletePly,
          backspace: hotkeys.backspacePly,
        }"
        stretch
        flat
        :color="fg"
        :ripple="false"
        :disable="!position.ply || plyInProgress"
        icon="backspace"
      >
        <hint v-if="position.ply && !plyInProgress">
          {{ $t("Delete Ply") }}
        </hint>
      </q-btn>
      <q-btn
        @click="first"
        @shortkey="first"
        v-shortkey="hotkeys.first"
        stretch
        flat
        :color="fg"
        :ripple="false"
        :disable="isFirst || plyInProgress"
        icon="first"
      >
        <hint v-if="!isFirst && !plyInProgress">
          {{ $t("Beginning") }}
        </hint>
      </q-btn>
      <q-btn
        @click="prev"
        @click.right.prevent="prev(true)"
        @shortkey="prev"
        v-shortkey="{
          whole: hotkeys.prev,
          half: hotkeys.prevHalf,
        }"
        stretch
        flat
        :color="fg"
        :ripple="false"
        :disable="isFirst || plyInProgress"
        icon="backward"
      >
        <hint v-if="!isFirst && !plyInProgress">
          {{ $t("Backward") }}
        </hint>
      </q-btn>
      <q-btn
        v-if="showPlayButton"
        @click="playpause"
        @shortkey="playpause"
        v-shortkey="hotkeys.playpause"
        round
        :ripple="false"
        color="primary"
        :text-color="primaryFG"
        :disable="!position.ply || plyInProgress"
        :icon="isPlaying ? 'pause' : 'play'"
      >
        <hint v-if="position.ply && !plyInProgress">
          {{ $t("Play/Pause") }}
        </hint>
      </q-btn>
      <q-btn
        @click="next"
        @click.right.prevent="next(true)"
        @shortkey="next"
        v-shortkey="{
          whole: hotkeys.next,
          half: hotkeys.nextHalf,
        }"
        stretch
        flat
        :color="fg"
        :ripple="false"
        :disable="isLast || plyInProgress"
        icon="forward"
      >
        <hint v-if="!isLast && !plyInProgress">
          {{ $t("Forward") }}
        </hint>
      </q-btn>
      <q-btn
        @click="last"
        @shortkey="last"
        v-shortkey="hotkeys.last"
        stretch
        flat
        :color="fg"
        :ripple="false"
        :disable="isLast || plyInProgress"
        icon="last"
      >
        <hint v-if="!isLast && !plyInProgress">
          {{ $t("End") }}
        </hint>
      </q-btn>
      <q-btn
        v-shortkey="{ ...options, ...branchControls }"
        @shortkey="branchKey"
        stretch
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
          selected-played
        />
        <hint v-if="branches.length >= 2 && !plyInProgress">
          {{ $tc("Branches", branches.length) }}
        </hint>
      </q-btn>
    </div>
  </div>
</template>

<script>
import BranchMenu from "./BranchMenu";

import { omit, pick, throttle, zipObject } from "lodash";
import { HOTKEYS } from "../../keymap";

const BRANCH_KEYS = [
  "branchMenu",
  "prevBranch",
  "nextBranch",
  "firstBranch",
  "lastBranch",
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
    position() {
      return this.$store.state.game.position;
    },
    branches() {
      return this.$store.state.game.ptn.branchMenu;
    },
    fg() {
      return this.$store.state.ui.theme.isDark ? "textLight" : "textDark";
    },
    primaryFG() {
      return this.$store.state.ui.theme.primaryDark ? "textLight" : "textDark";
    },
    isFirst() {
      return !this.position.prevPly && !this.position.plyIsDone;
    },
    isLast() {
      return (
        (!this.position.nextPly && this.position.plyIsDone) ||
        !this.position.ply
      );
    },
    plyInProgress() {
      return this.$store.state.game.selected.pieces.length !== 0;
    },
    hasBranches() {
      return !!(this.position.ply && this.position.ply.branches.length > 1);
    },
    branchIndex() {
      return this.$store.getters["game/currentBranchIndex"];
    },
    options() {
      const keys = Object.keys(this.branches);
      return zipObject(
        keys,
        keys.map((key) => [key])
      );
    },
    showPlayButton() {
      return this.$store.state.ui.showPlayButton;
    },
  },
  methods: {
    deletePly() {
      if (this.position.ply && !this.plyInProgress) {
        this.$store.dispatch("game/DELETE_PLY", this.position.plyID);
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
          this.$store.dispatch("game/PREV", {
            half: event === true || event.srcKey === "half",
          });
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
        if (this.$store.state.game.error) {
          this.pause();
          return false;
        }
        if (!this.isLast) {
          this.$store.dispatch("game/NEXT", {
            half:
              this.isPlaying ||
              event === true ||
              (event && event.srcKey === "half"),
          });
          this.isPlaying = this.isPlaying;
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
      this.$store.dispatch("game/GO_TO_PLY", { plyID: ply.id, isDone: true });
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
        case "firstBranch":
        case "lastBranch":
          this[srcKey]();
          break;
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
