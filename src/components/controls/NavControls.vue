<template>
  <div class="play-controls absolute-fit justify-center">
    <div class="row no-wrap justify-around items-center full-height">
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
        :color="fg"
        v-ripple="false"
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
        v-ripple="false"
        :disable="branches.length < 2 || plyInProgress"
        :color="isRoot ? fg : 'primary'"
        icon="branch"
      >
        <BranchMenu
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

import { countedThrottle } from "../../utilities";
import { omit, pick, zipObject } from "lodash";
import { HOTKEYS } from "../../keymap";

const BRANCH_KEYS = [
  "branchMenu",
  "prevBranch",
  "nextBranch",
  "parentBranch",
  "lastChildBranch",
  "parentMainBranch",
];

export default {
  name: "NavControls",
  components: { BranchMenu },
  data() {
    return {
      isPlaying: false,
      timer: null,
      timestamp: null,
      branchMenu: false,
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
    isRoot() {
      return !this.position.ply || !this.position.ply.branch;
    },
    branchIndex() {
      return this.$refs.branchMenu.selected;
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
    getPTNPanel() {
      const layout = this.$root && this.$root.$refs && this.$root.$refs.layout;
      const direct = layout && layout.$refs && layout.$refs.ptn;
      if (direct) {
        return direct;
      }

      const visit = (vm) => {
        if (!vm) {
          return null;
        }
        if (vm.$options && vm.$options.name === "PTN") {
          return vm;
        }
        const children = vm.$children || [];
        for (let i = 0; i < children.length; i++) {
          const found = visit(children[i]);
          if (found) {
            return found;
          }
        }
        return null;
      };

      return visit(layout);
    },
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
    selectBranch(ply) {
      this.$store.dispatch("game/SET_TARGET", ply);
      this.$store.dispatch("game/GO_TO_PLY", { plyID: ply.id, isDone: true });
    },
    branchKey({ srcKey }) {
      if (srcKey === "branchMenu") {
        this.branchMenu = !this.branchMenu;
        return;
      }
      switch (srcKey) {
        case "prevBranch":
        case "nextBranch":
        case "parentBranch":
        case "lastChildBranch":
        case "parentMainBranch":
          this[srcKey]();
          break;
      }
    },
    parentBranch() {
      const ptn = this.$store.state.game && this.$store.state.game.ptn;
      const positionPly = this.position && this.position.ply;
      if (!ptn || !ptn.allPlies || !positionPly || !positionPly.branch) {
        return;
      }

      const branchRoot = ptn.branches && ptn.branches[positionPly.branch];
      const parentID =
        branchRoot && branchRoot.branches && branchRoot.branches.length
          ? branchRoot.branches[0]
          : null;
      const parentPly = parentID != null ? ptn.allPlies[parentID] : null;
      if (parentPly) {
        this.selectBranch(parentPly);
      }
    },
    lastChildBranch() {
      const ptn = this.$store.state.game && this.$store.state.game.ptn;
      const positionPly = this.position && this.position.ply;
      if (!ptn || !ptn.allPlies || !positionPly) {
        return;
      }

      const isParentPly =
        positionPly.branches &&
        positionPly.branches.length > 1 &&
        positionPly.branches[0] === positionPly.id;
      if (!isParentPly) {
        return;
      }

      const childID = positionPly.branches[positionPly.branches.length - 1];
      const childPly = childID != null ? ptn.allPlies[childID] : null;
      if (!childPly) {
        return;
      }

      const canExpand =
        this.$store.state.ui.showPTN &&
        this.$store.state.ui.inlineBranches &&
        this.$store.state.ui.showAllBranches;
      if (canExpand) {
        const currentOverrides =
          (this.$store.state.game.ptnUI &&
            this.$store.state.game.ptnUI.branchPointOverrides) ||
          {};
        if (currentOverrides[positionPly.id] !== true) {
          this.$store.dispatch("game/SET_BRANCH_POINT_OVERRIDES", {
            ...currentOverrides,
            [positionPly.id]: true,
          });
        }
      }

      this.selectBranch(childPly);
    },
    parentMainBranch() {
      const ptn = this.$store.state.game && this.$store.state.game.ptn;
      const positionPly = this.position && this.position.ply;
      if (!ptn || !ptn.allPlies || !positionPly || !positionPly.branch) {
        return;
      }

      let current = positionPly;
      while (current && current.branch) {
        const branchRoot = ptn.branches && ptn.branches[current.branch];
        const parentID =
          branchRoot && branchRoot.branches && branchRoot.branches.length
            ? branchRoot.branches[0]
            : null;
        const parentPly = parentID != null ? ptn.allPlies[parentID] : null;
        if (!parentPly) {
          return;
        }
        if (!parentPly.branch) {
          this.selectBranch(parentPly);
          return;
        }
        current = parentPly;
      }
    },
    prevBranch() {
      // When branch menu is open, use the full branch list navigation
      if (this.branchMenu && this.branches.length && this.branchIndex > 0) {
        const targetPly = this.branches[this.branchIndex - 1];
        this.selectBranch(targetPly);
        return;
      }

      const ptn = this.$store.state.game && this.$store.state.game.ptn;
      const positionPly = this.position && this.position.ply;
      if (!ptn || !ptn.allPlies || !positionPly) {
        return;
      }

      // Check if current ply is a branch point (has child branches)
      const isParentPly =
        positionPly.branches &&
        positionPly.branches.length > 1 &&
        positionPly.branches[0] === positionPly.id;

      if (isParentPly) {
        // On parent ply - collapse in inline mode only
        const canCollapse =
          this.$store.state.ui.showPTN &&
          this.$store.state.ui.inlineBranches &&
          this.$store.state.ui.showAllBranches;
        if (canCollapse) {
          this.$store.commit("ui/SET_COLLAPSE_BRANCH_REQUEST", {
            plyID: positionPly.id,
            nonce: Date.now(),
          });
          return;
        }
      }

      // Only navigate siblings/parent when at the first ply of the branch
      // Get branch root (first ply of current branch) to find siblings
      if (!positionPly.branch) {
        return; // Main line, no branch
      }

      const branchRoot = ptn.branches && ptn.branches[positionPly.branch];
      if (!branchRoot) {
        return; // Branch not found in branches map
      }

      if (positionPly.id !== branchRoot.id) {
        return; // Not at first ply of branch
      }

      const siblings = branchRoot.branches;
      const hasSiblings = siblings && siblings.length > 1;

      if (hasSiblings) {
        // Find current branch's index in siblings (branchRoot.id, not positionPly.id)
        const currentIndex = siblings.indexOf(branchRoot.id);
        if (currentIndex > 1) {
          // Navigate to previous sibling (skip index 0 which is the branch point)
          const prevSiblingPly = ptn.allPlies[siblings[currentIndex - 1]];
          if (prevSiblingPly) {
            this.selectBranch(prevSiblingPly);
            return;
          }
        } else if (currentIndex >= 0) {
          // At first sibling or on branch point - go to branch point (parent)
          const branchPointPly = ptn.allPlies[siblings[0]];
          if (branchPointPly) {
            this.selectBranch(branchPointPly);
            return;
          }
        }
      }

      // No siblings - compute parent branch from branch name and go to its branch point
      if (positionPly.branch) {
        const parentBranchName = positionPly.branch
          .split("/")
          .slice(0, -1)
          .join("/");
        const parentBranchRoot = ptn.branches && ptn.branches[parentBranchName];
        const parentSiblings = parentBranchRoot && parentBranchRoot.branches;
        if (parentSiblings && parentSiblings.length > 0) {
          const parentBranchPointPly = ptn.allPlies[parentSiblings[0]];
          if (parentBranchPointPly) {
            this.selectBranch(parentBranchPointPly);
            return;
          }
        }
      }
    },
    nextBranch() {
      // When branch menu is open, use the full branch list navigation
      if (
        this.branchMenu &&
        this.branches.length &&
        this.branchIndex < this.branches.length - 1
      ) {
        const targetPly = this.branches[this.branchIndex + 1];
        this.selectBranch(targetPly);
        return;
      }

      const ptn = this.$store.state.game && this.$store.state.game.ptn;
      const positionPly = this.position && this.position.ply;
      if (!ptn || !ptn.allPlies || !positionPly) {
        return;
      }

      // Check if current ply is a branch point (has child branches)
      const isParentPly =
        positionPly.branches &&
        positionPly.branches.length > 1 &&
        positionPly.branches[0] === positionPly.id;

      if (isParentPly) {
        // On parent ply - select first child branch
        const firstChildPly = ptn.allPlies[positionPly.branches[1]];
        if (firstChildPly) {
          const canExpand =
            this.$store.state.ui.showPTN &&
            this.$store.state.ui.inlineBranches &&
            this.$store.state.ui.showAllBranches;
          if (canExpand) {
            const currentOverrides =
              (this.$store.state.game.ptnUI &&
                this.$store.state.game.ptnUI.branchPointOverrides) ||
              {};
            if (currentOverrides[positionPly.id] !== true) {
              this.$store.dispatch("game/SET_BRANCH_POINT_OVERRIDES", {
                ...currentOverrides,
                [positionPly.id]: true,
              });
            }
          }
          this.selectBranch(firstChildPly);
          return;
        }
      }

      // Get branch root (first ply of current branch) to find siblings
      const branchRoot = ptn.branches && ptn.branches[positionPly.branch];

      // Only navigate siblings when at the first ply of the branch
      if (!branchRoot || positionPly.id !== branchRoot.id) {
        return;
      }

      const siblings = branchRoot.branches;
      const hasSiblings = siblings && siblings.length > 1;

      if (hasSiblings) {
        // Find current branch's index in siblings
        const currentIndex = siblings.indexOf(branchRoot.id);
        if (currentIndex >= 0 && currentIndex < siblings.length - 1) {
          // Navigate to next sibling
          const nextSiblingPly = ptn.allPlies[siblings[currentIndex + 1]];
          if (nextSiblingPly) {
            this.selectBranch(nextSiblingPly);
            return;
          }
        }
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
