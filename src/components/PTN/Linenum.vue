<template>
  <div
    class="ptn linenum"
    :class="{
      'justify-end': !fullWidth,
      'q-px-sm': fullWidth,
      fullWidth,
      noBranch,
      selected: isSelected,
    }"
  >
    <div
      v-if="branch && (showBranch || onlyBranch)"
      class="branch row no-wrap"
      :class="{
        only: onlyBranch,
        noBranch,
      }"
      @click.left="selectBranch(ply)"
    >
      <span class="branch-text" v-html="branch" />
      <q-menu
        v-if="!noEdit"
        transition-show="none"
        transition-hide="none"
        context-menu
        auto-close
      >
        <BranchContextMenu :branch="linenum.branch" />
      </q-menu>
      <div class="branch-actions row no-wrap items-center">
        <q-btn
          v-if="onlyBranch && !noContextMenuBtn"
          ref="menu"
          icon="menu_vertical"
          size="md"
          dense
          flat
          @click.stop
        >
          <q-menu transition-show="none" transition-hide="none" auto-close>
            <BranchContextMenu :branch="linenum.branch" />
          </q-menu>
        </q-btn>

        <q-btn
          v-if="onlyBranch && !noMenuBtn"
          @click.stop
          icon="arrow_drop_down"
          size="md"
          flat
          dense
        >
          <BranchMenu
            @select="selectBranch"
            :branches="branches"
            v-model="menu"
          />
        </q-btn>

        <q-btn
          v-if="fullWidth && branchUI && branchPointPly && isInlineMode"
          @click.stop="collapseBranch"
          icon="close"
          size="md"
          dense
          flat
        />
      </div>
    </div>
    <span class="number" v-if="!onlyBranch"
      >{{ this.linenum.number }}.&nbsp;</span
    >

    <slot />
  </div>
</template>

<script>
import BranchMenu from "../controls/BranchMenu";
import BranchContextMenu from "../controls/BranchContextMenu";

import { isNumber } from "lodash";

export default {
  name: "Linenum",
  components: { BranchMenu, BranchContextMenu },
  inject: {
    branchUI: { default: null },
  },
  props: {
    linenum: Object,
    noEdit: Boolean,
    noBranch: Boolean,
    noMenuBtn: Boolean,
    noContextMenuBtn: Boolean,
    onlyBranch: Boolean,
    fullWidth: Boolean,
    activePly: Object,
    unselected: Boolean,
  },
  data() {
    return {
      menu: false,
      dialogRename: false,
      newBranch: "",
    };
  },
  computed: {
    branch() {
      const text = document.createElement("textarea");
      text.innerHTML = this.linenum.branch;
      const branch = text.value;
      return branch.split("/").join('/<span class="space"> </span>');
    },
    plies() {
      return this.$store.state.game.ptn.allPlies;
    },
    ply() {
      return (
        this.activePly ||
        this.$store.state.game.ptn.branches[this.linenum.branch]
      );
    },
    branches() {
      return this.ply.branches.map((ply) =>
        isNumber(ply) ? this.plies[ply] : ply
      );
    },
    showBranch() {
      return !this.noBranch && this.linenum.branch;
    },
    isSelected() {
      return (
        !this.unselected &&
        this.$store.state.game.ptn.branchPlies.some((p) => p.id === this.ply.id)
      );
    },
    isInlineMode() {
      return (
        this.$store.state.ui.showAllBranches &&
        this.$store.state.ui.inlineBranches
      );
    },
    branchPointPly() {
      if (!this.ply || !this.ply.branches || this.ply.branches.length <= 1) {
        return null;
      }
      const first = this.ply.branches[0];
      const parentId = isNumber(first) ? first : first && first.id;
      return parentId != null && this.plies && this.plies[parentId]
        ? this.plies[parentId]
        : null;
    },
  },
  methods: {
    selectBranch(ply) {
      this.$store.dispatch("game/SET_TARGET", ply);
    },
    collapseBranch() {
      if (!this.branchUI || !this.branchUI.toggle || !this.branchPointPly) {
        return;
      }
      this.branchUI.toggle(this.branchPointPly);
    },
  },
};
</script>

<style lang="scss">
.linenum {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  vertical-align: middle;
  color: var(--q-color-textDark);
  body.panelDark & {
    color: var(--q-color-textLight);
  }
  &.fullWidth {
    display: flex;
    justify-content: flex-start;
    width: 100%;
    flex: 1 1 auto;
    .branch {
      border-radius: 0;
    }
  }
  &.fullWidth,
  .branch {
    background-color: var(--q-color-bg);
    color: var(--q-color-textDark);
    body.secondaryDark & {
      color: var(--q-color-textLight);
    }

    .q-btn + .q-btn {
      margin-left: 4px;
    }
  }
  &.noBranch {
    justify-content: flex-start;
  }
  &.selected .branch,
  &.fullWidth.selected {
    background-color: var(--q-color-primary);
    color: var(--q-color-textDark) !important;
    body.primaryDark & {
      color: var(--q-color-textLight) !important;
    }
  }
  &:not(.fullWidth) {
    .branch.only {
      margin-bottom: 0.25em;
    }
  }
  .branch {
    flex: 1 1 auto;
    font-weight: bold;
    font-size: 0.9em;
    line-height: 1.3em;
    padding: 4px;
    margin: 0;
    cursor: pointer;
    border-radius: $generic-border-radius;
    &:not(.only) > span {
      white-space: nowrap;
      overflow: hidden;
    }
    &.only {
      > span {
        word-break: break-word;
      }
    }

    .branch-text {
      flex: 1 1 auto;
      min-width: 0;
    }

    .branch-actions {
      flex: 0 0 auto;
    }

    .space {
      width: 0;
      display: inline-block;
    }
    .q-btn {
      margin: -0.5em -0.26em -0.5em 0;
    }

    + .number {
      margin-left: 0.5em;
    }
  }
  .number {
    font-size: 0.9em;
    line-height: 2.2em;
  }
}
</style>
