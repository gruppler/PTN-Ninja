<template>
  <div class="full-width justify-center">
    <div class="row no-wrap justify-around items-center">
      <q-btn round flat :disable="!!game.state.nextPly" icon="backspace" />
      <q-btn
        @click="first"
        @shortkey="first"
        v-shortkey.once="['ctrl' + 'arrowleft']"
        round
        flat
        :disable="isFirst"
        icon="first_page"
      />
      <q-btn
        @click="prev"
        @shortkey="prev"
        v-shortkey.once="{
          whole: ['arrowleft'],
          half: ['shift' + 'arrowleft']
        }"
        round
        flat
        :disable="isFirst"
        icon="keyboard_arrow_left"
      />
      <q-btn
        @click="playpause"
        @shortkey="playpause"
        v-shortkey.once="['space']"
        round
        color="accent"
        text-color="grey-10"
        :icon="isPlaying ? 'pause' : 'play_arrow'"
      />
      <q-btn
        @click="next"
        @shortkey="next"
        v-shortkey.once="{
          whole: ['arrowright'],
          half: ['shift' + 'arrowright']
        }"
        round
        flat
        :disable="isLast"
        icon="keyboard_arrow_right"
      />
      <q-btn
        @click="last"
        @shortkey="last"
        v-shortkey.once="['ctrl', 'arrowright']"
        round
        flat
        :disable="isLast"
        icon="last_page"
      />
      <q-btn
        v-shortkey.once="options"
        @shortkey="selectOption"
        round
        flat
        :disable="!game.state.targetBranch && !hasBranches"
        :color="hasBranches ? 'accent' : ''"
        icon="call_split"
      >
        <BranchMenu
          @input="selectBranch"
          v-if="hasBranches"
          :game="game"
          :branches="game.state.ply.branches"
        />
        <BranchMenu
          @input="selectBranch"
          v-else-if="game.state.targetBranch"
          :game="game"
          :branches="game.branches[game.state.targetBranch].branches"
        />
      </q-btn>
    </div>
  </div>
</template>

<script>
import BranchMenu from "./BranchMenu";

import { zipObject } from "lodash";

export default {
  name: "PlayControls",
  components: { BranchMenu },
  props: ["game"],
  data() {
    return {
      isPlaying: false,
      timer: null,
      timestamp: null
    };
  },
  computed: {
    isFirst() {
      return !this.game.state.prevPly && !this.game.state.plyIsDone;
    },
    isLast() {
      return !this.game.state.nextPly && this.game.state.plyIsDone;
    },
    hasBranches() {
      return this.game.state.ply && !!this.game.state.ply.branches.length;
    },
    branches() {
      return this.hasBranches
        ? this.game.state.ply.branches
        : this.game.branches[this.game.state.targetBranch].branches;
    },
    options() {
      return zipObject(
        Object.keys(this.branches),
        Object.keys(this.branches).map(key => [key])
      );
    }
  },
  methods: {
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
    prev(event) {
      if (!this.isFirst) {
        this.game.prev(event.shiftKey || event.srcKey === "half");
      }
    },
    next(event) {
      requestAnimationFrame(() => {
        if (this.isPlaying) {
          clearTimeout(this.timer);
          this.timer = setTimeout(this.next, 6e4 / this.$store.state.playSpeed);
          this.timestamp = new Date().getTime();
        }
        if (!this.isLast) {
          this.isPlaying =
            this.game.next(
              this.isPlaying || event.shiftKey || event.srcKey === "half"
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
    selectOption(event) {
      this.selectBranch(this.branches[event.srcKey]);
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
