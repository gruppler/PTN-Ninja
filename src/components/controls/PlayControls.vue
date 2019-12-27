<template>
  <div class="full-width justify-center">
    <div class="row no-wrap justify-around items-center">
      <q-btn
        @click="deletePly"
        @shortkey="deletePly"
        v-shortkey="hotkeys.deletePly"
        round
        flat
        :disable="!game.state.ply || !!game.state.nextPly || plyInProgress"
        icon="backspace"
      />
      <q-btn
        @click="first"
        @shortkey="first"
        v-shortkey="hotkeys.first"
        round
        flat
        :disable="isFirst || plyInProgress"
        icon="first_page"
      />
      <q-btn
        @click="prev"
        @click.right.prevent="prev(true)"
        @shortkey="prev"
        v-shortkey="{
          whole: hotkeys.prev,
          half: hotkeys.prevHalf
        }"
        round
        flat
        :disable="isFirst || plyInProgress"
        icon="keyboard_arrow_left"
      />
      <q-btn
        @click="playpause"
        @shortkey="playpause"
        v-shortkey="hotkeys.playpause"
        round
        color="accent"
        text-color="grey-10"
        :disable="!game.state.ply || plyInProgress"
        :icon="isPlaying ? 'pause' : 'play_arrow'"
      />
      <q-btn
        @click="next"
        @click.right.prevent="next(true)"
        @shortkey="next"
        v-shortkey="{
          whole: hotkeys.next,
          half: hotkeys.nextHalf
        }"
        round
        flat
        :disable="isLast || plyInProgress"
        icon="keyboard_arrow_right"
      />
      <q-btn
        @click="last"
        @shortkey="last"
        v-shortkey="hotkeys.last"
        round
        flat
        :disable="isLast || plyInProgress"
        icon="last_page"
      />
      <q-btn
        v-shortkey="{ ...options, ...branchControls }"
        @shortkey="branchKey"
        round
        flat
        :disable="!branches.length || plyInProgress"
        :color="hasBranches ? 'accent' : ''"
      >
        <q-icon name="call_split" class="rotate-180" />
        <BranchMenu
          v-if="$store.state.showControls"
          v-model="branchMenu"
          @select="selectBranch"
          :game="game"
          :branches="branches"
          linenum
        />
      </q-btn>
    </div>
  </div>
</template>

<script>
import BranchMenu from "./BranchMenu";

import { throttle, zipObject } from "lodash";
import { HOTKEYS } from "../../keymap";

export default {
  name: "PlayControls",
  components: { BranchMenu },
  props: ["game"],
  data() {
    return {
      isPlaying: false,
      timer: null,
      timestamp: null,
      next: null,
      prev: null,
      branchMenu: false,
      hotkeys: HOTKEYS.CONTROLS,
      branchControls: {
        menu: HOTKEYS.CONTROLS.branch,
        prevBranch: HOTKEYS.CONTROLS.prevBranch,
        nextBranch: HOTKEYS.CONTROLS.nextBranch,
        prevBranchEnd: HOTKEYS.CONTROLS.prevBranchEnd,
        nextBranchEnd: HOTKEYS.CONTROLS.nextBranchEnd,
        firstBranch: HOTKEYS.CONTROLS.firstBranch,
        lastBranch: HOTKEYS.CONTROLS.lastBranch,
        firstBranchEnd: HOTKEYS.CONTROLS.firstBranchEnd,
        lastBranchEnd: HOTKEYS.CONTROLS.lastBranchEnd
      }
    };
  },
  computed: {
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
      return !!(this.game.state.ply && this.game.state.ply.branches.length);
    },
    branches() {
      if (this.hasBranches) {
        // Current ply's branches
        return this.game.state.ply.branches;
      } else if (this.game.state.plies) {
        // Most recent branch
        let index = this.game.state.ply ? this.game.state.ply.index : 0;
        let ply = this.game.state.plies
          .concat()
          .reverse()
          .find(
            ply => index > ply.index && Object.keys(ply.branches).length > 1
          );
        if (
          !ply &&
          this.game.state.targetBranch &&
          this.game.state.targetBranch in this.game.branches
        ) {
          // Selected branch siblings
          ply = this.game.branches[this.game.state.targetBranch];
        }
        return ply
          ? ply.branches
          : this.game
              .getBranchesSorted()
              .map(branch => this.game.branches[branch]);
      }
      return [];
    },
    branchIndex() {
      return this.branches.length
        ? this.branches.findIndex(branch =>
            this.game.state.plies.includes(branch)
          )
        : -1;
    },
    options() {
      return zipObject(
        Object.keys(this.branches),
        Object.keys(this.branches).map(key => [key])
      );
    }
  },
  methods: {
    deletePly() {
      if (
        this.game.state.ply &&
        !this.game.state.nextPly &&
        !this.plyInProgress
      ) {
        this.game.deletePly(this.game.state.plyID);
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
        this.game.first();
      }
    },
    _prev(event) {
      requestAnimationFrame(() => {
        if (this.isPlaying) {
          clearTimeout(this.timer);
          this.timer = setTimeout(this.next, 6e4 / this.$store.state.playSpeed);
          this.timestamp = new Date().getTime();
        }
        if (!this.isFirst) {
          this.game.prev(event === true || event.srcKey === "half");
        }
      });
    },
    _next(event) {
      requestAnimationFrame(() => {
        if (this.isPlaying) {
          clearTimeout(this.timer);
          this.timer = setTimeout(this.next, 6e4 / this.$store.state.playSpeed);
          this.timestamp = new Date().getTime();
        }
        if (!this.isLast) {
          this.isPlaying =
            this.game.next(
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
        this.game.last();
        if (this.isPlaying) {
          this.pause();
        }
      }
    },
    selectBranch(ply) {
      this.game.setTarget(ply);
    },
    branchKey({ srcKey }) {
      switch (srcKey) {
        case "menu":
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
        this.game.setTarget(this.branches[this.branchIndex - 1]);
      }
    },
    nextBranch() {
      if (this.branches.length && this.branchIndex < this.branches.length - 1) {
        this.game.setTarget(this.branches[this.branchIndex + 1]);
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
        this.game.setTarget(this.branches[0]);
      }
    },
    lastBranch() {
      if (this.branches.length) {
        this.game.setTarget(this.branches[this.branches.length - 1]);
      }
    },
    firstBranchEnd() {
      this.firstBranch();
      this.last();
    },
    lastBranchEnd() {
      this.lastBranch();
      this.last();
    }
  },
  watch: {
    // Make playback speed respond immediately to speed changes
    "$store.state.playSpeed"(speed) {
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
    }
  },
  created() {
    this.next = throttle(this._next, 250);
    this.prev = throttle(this._prev, 250);
  }
};
</script>

<style lang="stylus" scoped>
.q-btn.disabled {
  opacity: 0.3 !important;
}

.row
  max-width 500px
  margin 0 auto
</style>
