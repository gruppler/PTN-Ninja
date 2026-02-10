<template>
  <component
    :is="recess ? 'recess' : 'div'"
    class="col-grow relative-position column no-wrap"
  >
    <q-scroll-area
      id="ptn-scroll-area"
      class="full-ptn col-grow non-selectable"
    >
      <q-virtual-scroll
        v-if="gameExists"
        ref="scroll"
        class="bg-transparent"
        :items="moves"
        scroll-target="#ptn-scroll-area > .scroll"
        :virtual-scroll-item-size="35.64"
        :virtual-scroll-slice-ratio-before="0.5"
        :virtual-scroll-slice-ratio-after="0.5"
      >
        <template v-slot="{ item }">
          <q-separator
            v-if="item && item.type === 'branch-separator'"
            :dark="$store.state.ui.theme.panelDark"
            class="fullwidth-padded-md"
          />
          <Move
            v-else
            :ref="item.id"
            :key="item.id"
            :move="item.move || item"
            :depth="item.depth"
            :split-ply="item.splitPly"
            :inline-branches="inlineBranches"
            fixed-linenumber-width
            separate-branch
            no-menu-btn
            branch-bar
            show-eval
          />
        </template>
      </q-virtual-scroll>
    </q-scroll-area>
    <q-toolbar
      class="bg-ui q-pa-none"
      :class="{ 'footer-toolbar': !showPTNTools }"
    >
      <q-btn-group class="full-width" spread stretch flat unelevated>
        <q-btn
          @click="parentMainBranch"
          icon="parent_main"
          flat
          spread
          stretch
          :disable="!position.ply || !position.ply.branch"
        >
          <hint>{{ $t("Parent Main Branch") }}</hint>
        </q-btn>
        <q-btn
          @click="parentBranch"
          icon="branch_parent"
          flat
          spread
          stretch
          :disable="!position.ply || !position.ply.branch"
        >
          <hint>{{ $t("Parent Branch") }}</hint>
        </q-btn>
        <q-btn
          @click="prevBranch"
          icon="branch_prev"
          flat
          spread
          stretch
          :disable="!canPrevBranch"
        >
          <hint>{{ $t("Previous Branch") }}</hint>
        </q-btn>
        <q-btn
          @click="nextBranch"
          icon="branch_next"
          flat
          spread
          stretch
          :disable="!canNextBranch"
        >
          <hint>{{ $t("Next Branch") }}</hint>
        </q-btn>
        <template v-if="inlineBranches">
          <q-separator vertical />
          <q-btn
            v-if="inlineBranches"
            @click="expandAllBranches"
            icon="more"
            flat
            spread
            stretch
          >
            <hint>{{ $t("Expand All") }}</hint>
          </q-btn>
          <q-btn @click="collapseAllBranches" icon="less" flat spread stretch>
            <hint>{{ $t("Collapse All") }}</hint>
          </q-btn>
        </template>
      </q-btn-group>
    </q-toolbar>
    <template v-if="showPTNTools">
      <q-separator />

      <q-toolbar class="footer-toolbar bg-ui q-pa-none">
        <UndoButtons
          v-if="
            !$store.state.ui.disableUndo && !$store.state.ui.disableNavigation
          "
          :class="{ 'full-width': $store.state.ui.disablePTNTools }"
          spread
          stretch
          flat
          unelevated
        />
        <EvalButtons
          v-if="!$store.state.ui.disablePTNTools"
          class="full-width"
          spread
          stretch
          flat
          unelevated
        />
      </q-toolbar>
    </template>
    <q-resize-observer @resize="scroll" />
  </component>
</template>

<script>
import Move from "../PTN/Move";
import InlineMovesBuilder from "../../Game/PTN/InlineMovesBuilder";
import UndoButtons from "../controls/UndoButtons";
import EvalButtons from "../controls/EvalButtons";

import { throttle } from "lodash";

export default {
  name: "PTN",
  components: { Move, UndoButtons, EvalButtons },
  props: {
    recess: Boolean,
  },
  data() {
    return {
      seenTargetBranches: [],
      collapsedToCurrentBranch: false,
    };
  },
  created() {
    const targetBranch = this.position && this.position.targetBranch;
    if (targetBranch) {
      this.seenTargetBranches = [targetBranch];
    }
  },
  provide() {
    return {
      branchUI: {
        isExpanded: (ply) => this.isBranchExpanded(ply),
        toggle: (ply) => this.toggleBranchExpanded(ply),
      },
    };
  },
  computed: {
    gameExists() {
      return Boolean(this.ptn);
    },
    position() {
      return this.$store.state.game.position;
    },
    ptn() {
      return this.$store.state.game.ptn;
    },
    inlineBranches() {
      return (
        this.$store.state.ui.inlineBranches &&
        this.$store.state.ui.showAllBranches
      );
    },
    branchOverrides() {
      return this.$store.state.game.ptnUI &&
        this.$store.state.game.ptnUI.branchPointOverrides
        ? this.$store.state.game.ptnUI.branchPointOverrides
        : {};
    },
    moves() {
      if (this.$store.state.ui.showAllBranches) {
        if (this.$store.state.ui.inlineBranches) {
          return Object.freeze(this.buildInlineMoves());
        }

        const getMoveDepth = (move) => {
          if (!move) {
            return 0;
          }
          let ply = null;
          if (move.ply1 && !move.ply1.isNop) {
            ply = move.ply1;
          } else if (move.ply2 && !move.ply2.isNop) {
            ply = move.ply2;
          } else {
            ply = move.firstPly;
          }
          return ply && ply.depth != null ? ply.depth : 0;
        };

        return Object.freeze(
          this.ptn.sortedMoves.map((move) => ({
            ...move,
            move,
            depth: getMoveDepth(move),
            id: move.id,
          }))
        );
      }
      return Object.freeze(this.ptn.branchMoves);
    },
    showPTNTools() {
      return (
        !this.$store.state.ui.embed ||
        (!this.$store.state.ui.disableUndo &&
          !this.$store.state.ui.disableNavigation) ||
        !this.$store.state.ui.disablePTNTools
      );
    },
    canPrevBranch() {
      const ply = this.position && this.position.ply;
      if (!ply) return false;
      // At the first ply of a non-main branch: can go to parent/sibling
      return Boolean(ply.branches.length && ply.branches[0] !== ply.id);
    },
    canNextBranch() {
      const ply = this.position && this.position.ply;
      if (!ply) return false;
      // Enabled when not the last in the branches array
      const last = ply.branches[ply.branches.length - 1];
      return Boolean(ply.branches.length && last !== ply.id);
    },
  },
  methods: {
    selectBranch(ply) {
      this.$store.dispatch("game/SET_TARGET", ply);
      this.$store.dispatch("game/GO_TO_PLY", { plyID: ply.id, isDone: true });
    },
    parentBranch() {
      this.$store.dispatch("game/PARENT_BRANCH");
    },
    prevBranch() {
      this.$store.dispatch("game/PREV_BRANCH");
    },
    nextBranch() {
      this.$store.dispatch("game/NEXT_BRANCH");
    },
    parentMainBranch() {
      this.$store.dispatch("game/PARENT_MAIN_BRANCH");
    },
    isBranchPrefixOfTarget(branch, targetBranch) {
      if (!branch || !targetBranch) {
        return false;
      }
      return targetBranch === branch || targetBranch.startsWith(branch + "/");
    },
    getBranchParent(branch) {
      if (!branch || !branch.includes("/")) {
        return "";
      }
      return branch.split("/").slice(0, -1).join("/");
    },
    isBranchPrefixOfAnyTarget(branch, targetBranches) {
      if (!branch || !targetBranches || !targetBranches.length) {
        return false;
      }
      return targetBranches.some((targetBranch) =>
        this.isBranchPrefixOfTarget(branch, targetBranch)
      );
    },
    getBranchPointPlies() {
      if (!this.ptn || !this.ptn.allPlies) {
        return [];
      }
      return Object.values(this.ptn.allPlies).filter(
        (ply) =>
          ply &&
          ply.branches &&
          ply.branches.length > 1 &&
          ply.branches[0] === ply.id
      );
    },
    scrollToTop() {
      this.$refs.scroll.scrollTo(0);
    },
    scrollToBottom() {
      this.$refs.scroll.scrollTo(this.moves.length - 1);
    },
    jumpToCurrent() {
      this.$nextTick(() => this.scroll());
    },
    expandAllBranches() {
      this.collapsedToCurrentBranch = false;

      const branchPoints = this.getBranchPointPlies();
      const overrides = {};
      branchPoints.forEach((ply) => {
        overrides[ply.id] = true;
      });

      this.$store.dispatch("game/SET_BRANCH_POINT_OVERRIDES", overrides);
    },
    collapseAllBranches() {
      this.collapsedToCurrentBranch = false;

      const branchPoints = this.getBranchPointPlies();
      const targetBranch = (this.position && this.position.targetBranch) || "";
      const targetParent = this.getBranchParent(targetBranch);
      const overrides = {};
      branchPoints.forEach((ply) => {
        const branchPlies = ply.branches
          .slice(1)
          .map((id) => this.ptn.allPlies[id])
          .filter(Boolean);

        const isOnPath = branchPlies.some((branchPly) =>
          this.isBranchPrefixOfTarget(branchPly.branch, targetBranch)
        );
        const hasSibling =
          Boolean(targetParent) &&
          branchPlies.some(
            (branchPly) =>
              this.getBranchParent(branchPly.branch) === targetParent
          );

        if (!isOnPath && !hasSibling) {
          overrides[ply.id] = false;
        }
      });

      this.$store.dispatch("game/SET_BRANCH_POINT_OVERRIDES", overrides);
    },
    getDefaultExpandedBranches(ply) {
      const targetBranch = this.position.targetBranch || "";
      const targets = targetBranch ? [targetBranch] : [];
      const allowSiblingExpansion =
        targetBranch.includes("/") && !this.collapsedToCurrentBranch;

      if (
        !targets.length ||
        !ply ||
        !ply.branches ||
        ply.branches.length <= 1
      ) {
        return [];
      }

      const branches = ply.branches
        .slice(1)
        .map((id) => this.ptn.allPlies[id])
        .filter(Boolean);

      // Expand branches that are in the path to target OR siblings of the current branch
      return branches.filter((branchPly) => {
        // Always expand if it's in the path to target
        if (this.isBranchPrefixOfAnyTarget(branchPly.branch, targets)) {
          return true;
        }

        // Also expand siblings of the current branch
        // A sibling has the same parent branch as the target
        if (!allowSiblingExpansion) {
          return false;
        }
        for (const target of targets) {
          const targetParent = this.getBranchParent(target);
          const branchParent = this.getBranchParent(branchPly.branch);
          if (targetParent === branchParent) {
            return true;
          }
        }

        return false;
      });
    },
    getBranchesToShow(ply) {
      const override = this.branchOverrides[ply.id];
      if (override === false) {
        return [];
      }

      const branches = ply.branches
        .slice(1)
        .map((id) => this.ptn.allPlies[id])
        .filter(Boolean);

      if (override === true) {
        return branches;
      }

      return this.getDefaultExpandedBranches(ply);
    },
    isBranchExpanded(ply) {
      if (!ply || !ply.branches || ply.branches.length <= 1) {
        return false;
      }

      const override = this.branchOverrides[ply.id];
      if (override === true) {
        return true;
      }
      if (override === false) {
        return false;
      }

      return this.getDefaultExpandedBranches(ply).length > 0;
    },
    toggleBranchExpanded(ply) {
      if (!ply || !ply.id) {
        return;
      }

      const defaultExpanded = this.getDefaultExpandedBranches(ply).length > 0;
      const override = this.branchOverrides[ply.id];
      const effectiveExpanded =
        override === undefined ? defaultExpanded : Boolean(override);

      const nextExpanded = !effectiveExpanded;

      if (!nextExpanded) {
        const targetBranch = this.position && this.position.targetBranch;
        const branchPlies = ply.branches
          .slice(1)
          .map((id) => this.ptn.allPlies[id])
          .filter(Boolean);

        if (
          targetBranch &&
          branchPlies.some((branchPly) =>
            this.isBranchPrefixOfTarget(branchPly.branch, targetBranch)
          )
        ) {
          this.$store.dispatch("game/SET_TARGET", ply);
        }
      }

      if (nextExpanded === defaultExpanded) {
        const { [ply.id]: _removed, ...rest } = this.branchOverrides;
        this.$store.dispatch("game/SET_BRANCH_POINT_OVERRIDES", rest);
      } else {
        this.$store.dispatch("game/SET_BRANCH_POINT_OVERRIDES", {
          ...this.branchOverrides,
          [ply.id]: nextExpanded,
        });
      }
    },
    buildInlineMoves() {
      const builder = new InlineMovesBuilder({
        allMoves: this.ptn.allMoves,
        allPlies: this.ptn.allPlies,
        getBranchesToShow: (ply) => this.getBranchesToShow(ply),
      });
      return builder.build();
    },
    scroll: throttle(function () {
      const editingBranch = this.$store.state.ui.editingBranch
        ? this.ptn.branches[this.$store.state.ui.editingBranch] || null
        : null;

      const move = editingBranch ? editingBranch.move : this.position.move;
      if (!move) {
        return;
      }

      const index = this.moves.findIndex(
        (item) => (item.move || item).id === move.id
      );

      if (index >= 0) {
        this.$refs.scroll.scrollTo(index, "center-force");
      }
    }, 100),
  },
  watch: {
    "position.tps"() {
      this.$nextTick(() => this.scroll());
    },
    "$store.state.ui.expandBranchRequest"(request) {
      if (!request || !request.plyID || !this.ptn || !this.ptn.allPlies) {
        return;
      }
      if (!this.inlineBranches) {
        return;
      }

      const ply = this.ptn.allPlies[request.plyID];
      if (ply && this.branchOverrides[ply.id] !== true) {
        this.$store.dispatch("game/SET_BRANCH_POINT_OVERRIDES", {
          ...this.branchOverrides,
          [ply.id]: true,
        });
      }

      this.$store.commit("ui/SET_EXPAND_BRANCH_REQUEST", null);
    },
    "$store.state.ui.collapseBranchRequest"(request) {
      if (!request || !request.plyID || !this.ptn || !this.ptn.allPlies) {
        return;
      }
      if (!this.inlineBranches) {
        return;
      }

      const ply =
        this.ptn && this.ptn.allPlies ? this.ptn.allPlies[request.plyID] : null;
      if (ply) {
        if (this.isBranchExpanded(ply)) {
          this.toggleBranchExpanded(ply);
        } else {
          this.$store.commit("ui/SET_COLLAPSE_BRANCH_REQUEST", null);
          return;
        }
      }
      this.$store.commit("ui/SET_COLLAPSE_BRANCH_REQUEST", null);
    },
    "position.targetBranch"() {
      const targetBranch = this.position.targetBranch;
      if (targetBranch && !this.seenTargetBranches.includes(targetBranch)) {
        this.seenTargetBranches = [...this.seenTargetBranches, targetBranch];
      }

      this.$nextTick(() => this.scroll());
    },
    "$store.state.ui.showAllBranches"() {
      // Wait for moves computed to update, then for DOM to render
      this.$nextTick(() => {
        this.$nextTick(() => this.scroll());
      });
    },
    "$store.state.ui.inlineBranches"() {
      // Wait for moves computed to update, then for DOM to render
      this.$nextTick(() => {
        this.$nextTick(() => this.scroll());
      });
    },
  },
};
</script>

<style lang="scss">
.full-ptn {
  .ptn.ply.other {
    opacity: 0.5;
  }
}

.ply-preview-tooltip {
  position: absolute;
  z-index: 9999;
  pointer-events: none;
  background-color: rgba(#000, 0.8);
  border-radius: 4px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>
