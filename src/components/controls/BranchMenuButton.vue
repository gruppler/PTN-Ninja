<template>
  <q-btn
    @touchstart="vibrate"
    stretch
    flat
    v-ripple="false"
    :disable="branches.length < 2 || plyInProgress"
    :color="isRoot ? color : 'primary'"
  >
    <q-icon name="branch" class="rotate-180" />
    <BranchMenu
      ref="branchMenu"
      v-model="menuOpen"
      @select="selectBranch"
      :branches="branches"
      selected-played
    />
    <hint v-if="branches.length >= 2 && !plyInProgress">
      {{ $tc("Branches", branches.length) }}
    </hint>
  </q-btn>
</template>

<script>
import BranchMenu from "./BranchMenu";
import { pick, zipObject } from "lodash";
import { HOTKEYS } from "../../keymap";

const BRANCH_KEYS = [
  "branchMenu",
  "prevBranch",
  "nextBranch",
  "firstBranch",
  "lastBranch",
];

export default {
  name: "BranchMenuButton",
  components: { BranchMenu },
  props: {
    color: {
      type: String,
      default: undefined,
    },
  },
  data() {
    return {
      menuOpen: false,
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
    branchIndex() {
      return this.$store.getters["game/currentBranchIndex"];
    },
    plyInProgress() {
      return this.$store.state.game.selected.pieces.length !== 0;
    },
    isRoot() {
      return !this.position.ply || !this.position.ply.branch;
    },
    options() {
      const keys = Object.keys(this.branches);
      return zipObject(
        keys,
        keys.map((key) => [key])
      );
    },
  },
  methods: {
    vibrate() {
      if (this.$store.state.ui.hapticNavControls && navigator.vibrate) {
        navigator.vibrate(2);
      }
    },
    branchKey({ srcKey }) {
      switch (srcKey) {
        case "branchMenu":
          if (this.branches.length) {
            this.menuOpen = !this.menuOpen;
          }
          break;
        case "prevBranch":
        case "nextBranch":
        case "firstBranch":
        case "lastBranch":
          this[srcKey]();
          break;
        default:
          // Number key - select branch by index
          if (this.branches[srcKey]) {
            this.selectBranch(this.branches[srcKey]);
          }
      }
    },
    selectBranch(ply) {
      this.$store.dispatch("game/SET_TARGET", ply);
      this.$store.dispatch("game/GO_TO_PLY", { plyID: ply.id, isDone: true });
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
};
</script>
