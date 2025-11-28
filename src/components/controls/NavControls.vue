<template>
  <div class="play-controls absolute-fit justify-center">
    <div
      class="row no-wrap items-center full-height"
      :class="compact ? 'full-width' : 'justify-center'"
    >
      <q-btn
        @touchstart="vibrate"
        @click="deletePly"
        @shortkey="deletePly"
        v-shortkey="{
          delete: hotkeys.deletePly,
          backspace: hotkeys.backspacePly,
        }"
        stretch
        flat
        :class="{ col: compact }"
        :color="fg"
        v-ripple="false"
        :disable="
          !position.ply ||
          plyInProgress ||
          isBoardDisabled ||
          (player && position.ply.player !== player)
        "
        icon="backspace"
      >
        <hint v-if="position.ply && !plyInProgress">
          {{ $t("Delete Ply") }}
        </hint>
      </q-btn>
      <q-btn
        @touchstart="vibrate"
        @click="first"
        @shortkey="first"
        v-shortkey="hotkeys.first"
        stretch
        flat
        :class="{ col: compact }"
        :color="fg"
        v-ripple="false"
        :disable="isFirst || plyInProgress"
        icon="first"
      >
        <hint v-if="!isFirst && !plyInProgress">
          {{ $t("Beginning") }}
        </hint>
      </q-btn>
      <q-btn
        @touchstart="vibrate"
        @click="prev"
        @click.right.prevent="prev(1, true)"
        @shortkey="prev"
        v-shortkey="{
          whole: hotkeys.prev,
          half: hotkeys.prevHalf,
        }"
        stretch
        flat
        :class="{ col: compact }"
        :color="fg"
        v-ripple="false"
        :disable="isFirst || plyInProgress"
        icon="backward"
      >
        <hint v-if="!isFirst && !plyInProgress">
          {{ $t("Backward") }}
        </hint>
      </q-btn>
      <q-btn
        v-if="showPlayButton"
        @touchstart="vibrate"
        @click="playpause"
        @shortkey="playpause"
        v-shortkey="hotkeys.playpause"
        round
        v-ripple="false"
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
        @touchstart="vibrate"
        @click="next"
        @click.right.prevent="next(1, true)"
        @shortkey="next"
        v-shortkey="{
          whole: hotkeys.next,
          half: hotkeys.nextHalf,
        }"
        stretch
        flat
        :class="{ col: compact }"
        :color="fg"
        v-ripple="false"
        :disable="isLast || plyInProgress"
        icon="forward"
      >
        <hint v-if="!isLast && !plyInProgress">
          {{ $t("Forward") }}
        </hint>
      </q-btn>
      <q-btn
        @touchstart="vibrate"
        @click="last"
        @shortkey="last"
        v-shortkey="hotkeys.last"
        stretch
        flat
        :class="{ col: compact }"
        :color="fg"
        v-ripple="false"
        :disable="isLast || plyInProgress"
        icon="last"
      >
        <hint v-if="!isLast && !plyInProgress">
          {{ $t("End") }}
        </hint>
      </q-btn>
      <BranchMenuButton
        v-if="!hideBranchMenu"
        ref="branchMenuButton"
        :class="{ col: compact }"
        :color="fg"
      />
    </div>
    <!-- Branch hotkeys handler (always active) -->
    <div
      v-shortkey="{ ...options, ...branchControls }"
      @shortkey="branchKey"
      class="hidden"
    />
  </div>
</template>

<script>
import BranchMenuButton from "./BranchMenuButton";

import { countedThrottle } from "../../utilities";
import { omit, pick, zipObject } from "lodash";
import { HOTKEYS } from "../../keymap";

const BRANCH_KEYS = [
  "branchMenu",
  "prevBranch",
  "nextBranch",
  "firstBranch",
  "lastBranch",
];

export default {
  name: "NavControls",
  components: { BranchMenuButton },
  props: {
    compact: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      isPlaying: false,
      timer: null,
      timestamp: null,
      hotkeys: omit(HOTKEYS.CONTROLS, BRANCH_KEYS),
      branchControls: pick(HOTKEYS.CONTROLS, BRANCH_KEYS),
    };
  },
  computed: {
    player() {
      return this.$store.state.game.config.player;
    },
    position() {
      return this.$store.state.game.position;
    },
    branches() {
      return this.$store.state.game.ptn.branchMenu;
    },
    isBoardDisabled() {
      return this.$store.state.ui.disableBoard;
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
    options() {
      const keys = Object.keys(this.branches);
      return zipObject(
        keys,
        keys.map((key) => [key])
      );
    },
    showPlayButton() {
      return !this.compact && this.$store.state.ui.showPlayButton;
    },
    isOngoingOnlineGame() {
      return (
        this.$store.state.game.config &&
        this.$store.state.game.config.isOnline &&
        !this.$store.state.game.config.hasEnded
      );
    },
    isPlayer() {
      return this.$store.getters["online/isPlayer"];
    },
    scratchboardEnabled() {
      return (
        this.$store.state.game.config &&
        this.$store.state.game.config.scratchboard
      );
    },
    hideBranchMenu() {
      return this.isOngoingOnlineGame && this.isPlayer;
    },
  },
  methods: {
    deletePly() {
      if (this.position.ply && !this.plyInProgress && !this.isBoardDisabled) {
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
    prev(times = 1, event) {
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
          times,
        });
      }
    },
    next(times = 1, event) {
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
          times,
        });
        this.isPlaying = this.isPlaying;
        if (this.isLast && this.isPlaying) {
          this.pause();
        }
      }
    },
    last() {
      if (!this.isLast) {
        this.$store.dispatch("game/LAST");
        if (this.isPlaying) {
          this.pause();
        }
      }
    },
    branchKey(event) {
      if (this.$refs.branchMenuButton) {
        this.$refs.branchMenuButton.branchKey(event);
      }
    },
    vibrate() {
      if (this.$store.state.ui.hapticNavControls && navigator.vibrate) {
        navigator.vibrate(2);
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
    this.prev = countedThrottle(this.prev.bind(this), 250);
    this.next = countedThrottle(this.next.bind(this), 250);
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
