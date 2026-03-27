<template>
  <q-btn-group class="branch-delete-buttons" v-bind="$attrs">
    <q-btn
      v-shortkey="{ ...options, ...branchControls }"
      @shortkey="branchKey"
      stretch
      flat
      v-ripple="false"
      :disable="branches.length < 2 || plyInProgress"
      :color="fg"
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
  </q-btn-group>
</template>

<script>
import BranchMenu from "./BranchMenu";

import { pick, zipObject } from "lodash";
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
  name: "BranchDeleteButtons",
  components: { BranchMenu },
  data() {
    return {
      branchMenu: false,
      hotkeys: HOTKEYS.CONTROLS,
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
    plyInProgress() {
      return this.$store.state.game.selected.pieces.length !== 0;
    },
    branchIndex() {
      return this.$refs.branchMenu ? this.$refs.branchMenu.selected : 0;
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
    deletePly() {
      if (this.position.ply && !this.plyInProgress && !this.isBoardDisabled) {
        this.$store.dispatch("game/DELETE_PLY", this.position.plyID);
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
      this.$store.dispatch("game/PARENT_BRANCH");
    },
    lastChildBranch() {
      this.$store.dispatch("game/LAST_CHILD_BRANCH");
    },
    parentMainBranch() {
      this.$store.dispatch("game/PARENT_MAIN_BRANCH");
    },
    prevBranch() {
      if (this.branchMenu && this.branches.length && this.branchIndex > 0) {
        const targetPly = this.branches[this.branchIndex - 1];
        this.selectBranch(targetPly);
        return;
      }
      this.$store.dispatch("game/PREV_BRANCH");
    },
    nextBranch() {
      if (
        this.branchMenu &&
        this.branches.length &&
        this.branchIndex < this.branches.length - 1
      ) {
        const targetPly = this.branches[this.branchIndex + 1];
        this.selectBranch(targetPly);
        return;
      }
      this.$store.dispatch("game/NEXT_BRANCH");
    },
    vibrate() {
      if (this.$store.state.ui.hapticNavControls && navigator.vibrate) {
        navigator.vibrate(2);
      }
    },
  },
};
</script>
