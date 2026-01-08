<template>
  <span
    class="ptn continuation"
    :class="{ selected: isSelected, other: !isInBranch }"
    v-if="ply"
    :data-ply-id="ply.id"
  >
    <q-chip
      @click="select(ply, isSelected ? !isDone : true)"
      :color="ply.color === 1 ? 'player1' : 'player2'"
      :outline="!isDone"
      :clickable="!noClick"
      v-ripple="false"
      :key="ply.id"
      square
      dense
      v-on="$listeners"
    >
      <span class="continuation-text">&hellip;</span>
      <q-btn
        v-if="!noBranches && showBranchButton"
        @click.stop="handleBranchButton"
        :icon="
          inlineBranches
            ? isCollapsed
              ? 'arrow_drop_down'
              : 'arrow_drop_up'
            : 'arrow_drop_down'
        "
        size="md"
        flat
        dense
      >
        <BranchMenu
          v-if="!inlineBranches && hasBranches"
          @select="selectBranch"
          :branches="branches"
          v-model="menu"
        />
      </q-btn>
    </q-chip>
  </span>
</template>

<script>
import BranchMenu from "../controls/BranchMenu";

import { isBoolean } from "lodash";

export default {
  name: "Continuation",
  components: { BranchMenu },
  inject: {
    branchUI: {
      default: null,
    },
  },
  props: {
    ply: Object,
    inlineBranches: Boolean,
    noBranches: Boolean,
    noClick: Boolean,
    done: {
      type: Boolean,
      default: null,
    },
    selected: {
      type: Boolean,
      default: null,
    },
  },
  data() {
    return {
      menu: false,
    };
  },
  computed: {
    theme() {
      return this.$store.state.ui.theme;
    },
    showAllBranches() {
      return this.$store.state.ui.showAllBranches;
    },
    position() {
      return this.$store.state.game.position;
    },
    ptn() {
      return this.$store.state.game.ptn;
    },
    branches() {
      return this.ply.branches.map((id) => this.ptn.allPlies[id]);
    },
    hasBranches() {
      return Boolean(
        this.ply && this.ply.branches && this.ply.branches.length > 1
      );
    },
    isBranchParent() {
      if (!this.hasBranches) {
        return false;
      }
      const first =
        this.branches && this.branches.length ? this.branches[0] : null;
      return Boolean(first && first.id === this.ply.id);
    },
    showBranchButton() {
      if (!this.hasBranches) {
        return false;
      }
      return this.inlineBranches ? this.isBranchParent : true;
    },
    useBranchMenu() {
      return !this.inlineBranches;
    },
    isCollapsed() {
      if (!this.inlineBranches) {
        return false;
      }
      if (!this.branchUI || !this.branchUI.isExpanded) {
        return true;
      }
      return !this.branchUI.isExpanded(this.ply);
    },
    isSelected() {
      return isBoolean(this.selected)
        ? this.selected
        : this.position.plyID === this.ply.id;
    },
    isInBranch() {
      return this.ptn.branchPlies.some((p) => p.id === this.ply.id);
    },
    isDone() {
      return isBoolean(this.done)
        ? this.done
        : this.position.plyID === this.ply.id
        ? this.position.plyIsDone
        : this.isInBranch && this.position.plyIndex > this.ply.index;
    },
  },
  methods: {
    select(ply, isDone = this.position.plyIsDone) {
      if (this.noClick || this.$store.state.ui.disableNavigation) {
        return;
      }
      this.$store.dispatch("game/GO_TO_PLY", { plyID: ply.id, isDone });
    },
    selectBranch(ply) {
      if (!this.$store.state.ui.disableNavigation) {
        this.$store.dispatch("game/SET_TARGET", ply);
      }
    },
    handleBranchButton() {
      if (this.inlineBranches) {
        this.toggleCollapse();
      }
    },
    toggleCollapse() {
      if (!this.branchUI || !this.branchUI.toggle) {
        return;
      }
      this.branchUI.toggle(this.ply);
    },
  },
};
</script>

<style lang="scss">
.ptn.continuation {
  display: inline-flex;
  vertical-align: middle;
  flex-direction: row;
  align-items: center;

  &.other {
    opacity: 0.5;
  }

  .q-chip {
    font-size: inherit;
  }

  &.selected .q-chip {
    box-shadow: 0 0 0 2px var(--q-color-primary);
    body.desktop &.q-chip--clickable:focus {
      box-shadow: $shadow-1, 0 0 0 2px var(--q-color-primary);
    }
  }

  .continuation-text {
    font-family: "Source Code Pro";
    font-weight: bold;
    letter-spacing: 0.1em;
  }

  .q-btn {
    margin-right: -0.7em;
  }
}
</style>
