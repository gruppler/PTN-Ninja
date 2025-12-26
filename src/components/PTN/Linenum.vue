<template>
  <span class="ptn linenum justify-end">
    <span
      v-if="branch && (showBranch || onlyBranch)"
      class="branch row no-wrap justify-end"
      :class="{ selected: isSelected, only: onlyBranch }"
      @click.left="selectBranch(ply)"
    >
      <span v-html="branch" />
      <q-menu
        v-if="!noEdit"
        transition-show="none"
        transition-hide="none"
        context-menu
        auto-close
      >
        <BranchContextMenu :branch="linenum.branch" />
      </q-menu>
      <q-btn
        v-if="onlyBranch && !noMenu"
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
    </span>
    <span class="number" v-if="!onlyBranch"
      >{{ this.linenum.number }}.&nbsp;</span
    >
  </span>
</template>

<script>
import BranchMenu from "../controls/BranchMenu";
import BranchContextMenu from "../controls/BranchContextMenu";

import { isNumber } from "lodash";

export default {
  name: "Linenum",
  components: { BranchMenu, BranchContextMenu },
  props: {
    linenum: Object,
    noEdit: Boolean,
    noBranch: Boolean,
    noMenu: Boolean,
    onlyBranch: Boolean,
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
  },
  methods: {
    selectBranch(ply) {
      this.$store.dispatch("game/SET_TARGET", ply);
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
  .branch {
    font-weight: bold;
    font-size: 0.9em;
    line-height: 1.3em;
    padding: 4px;
    margin: 0;
    cursor: pointer;
    border-radius: $generic-border-radius;
    background-color: var(--q-color-bg);
    color: var(--q-color-textDark);
    body.secondaryDark & {
      color: var(--q-color-textLight);
    }
    &:not(.only) > span {
      white-space: nowrap;
      overflow: hidden;
    }
    &.selected {
      background-color: var(--q-color-primary);
      color: var(--q-color-textDark) !important;
      body.primaryDark & {
        color: var(--q-color-textLight) !important;
      }
    }
    &.only {
      margin-top: 0.25em;
      margin-bottom: 0.25em;
      > span {
        word-break: break-word;
      }
    }
    .space {
      width: 0;
      display: inline-block;
    }
    .q-btn {
      margin: -0.5em -0.26em;
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
