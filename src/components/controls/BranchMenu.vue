<template>
  <q-menu
    ref="menu"
    content-class="q-branch-menu"
    :value="value"
    @input="$emit('input', $event)"
    transition-show="none"
    transition-hide="none"
    auto-close
  >
    <q-virtual-scroll
      ref="virtualScroll"
      class="branch-menu bg-panel"
      :items="branches"
      :virtual-scroll-item-size="34"
      :virtual-scroll-sticky-size-start="0"
      :virtual-scroll-sticky-size-end="0"
      scroll-target=".q-branch-menu"
    >
      <template v-slot="{ item: ply, index: i }">
        <q-item
          :key="i"
          :class="{ 'branch-separator': showSeparator(i) }"
          @click="select(ply)"
          clickable
          dense
        >
          <q-item-label class="row no-wrap overflow-hidden items-center">
            <span class="fade">
              <div
                class="option-number text-subtitle2 q-pa-sm"
                :class="{ 'bg-primary': selected === i }"
              >
                {{ i }}
              </div>
            </span>
            <Linenum
              :linenum="ply.linenum"
              :active-ply="ply"
              class="branch-container col-shrink"
              no-edit
            />
            <Ply :ply="ply" no-branches no-click />
          </q-item-label>
          <q-menu
            transition-show="none"
            transition-hide="none"
            auto-close
            separate-close-popup
            context-menu
            touch-position
          >
            <BranchContextMenu :branch="ply.branch" />
          </q-menu>
        </q-item>
      </template>
    </q-virtual-scroll>
  </q-menu>
</template>

<script>
import BranchContextMenu from "../controls/BranchContextMenu";
import { findLastIndex } from "lodash";

export default {
  name: "BranchMenu",
  components: {
    Linenum: () => import("../PTN/Linenum"),
    Ply: () => import("../PTN/Ply"),
    BranchContextMenu,
  },
  props: {
    value: Boolean,
    branches: Array,
    "selected-played": Boolean,
  },
  data() {
    return {
      isClosing: false,
    };
  },
  computed: {
    branchPlyIDs() {
      const plies = this.$store.state.game.ptn.branchPlies;
      const ids = new Set();
      for (let i = 0; i < plies.length; i++) {
        ids.add(plies[i].id);
      }
      return ids;
    },
    selected() {
      const ids = this.branchPlyIDs;
      const plyID = this.$store.state.game.position.plyID;
      const index = findLastIndex(
        this.branches,
        (ply) => ids.has(ply.id) && (!this.selectedPlayed || ply.id <= plyID)
      );
      return index >= 0 ? index : 0;
    },
  },
  methods: {
    showSeparator(i) {
      if (!i) {
        return false;
      }
      return (
        !this.branches[i].branch ||
        this.branches[i].index !== this.branches[i - 1].index
      );
    },
    select(ply) {
      this.isClosing = true;
      this.$emit("select", ply);
    },
    scroll() {
      if (this.$refs.virtualScroll) {
        this.$refs.virtualScroll.scrollTo(this.selected);
      }
    },
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        this.isClosing = false;
        this.$nextTick(this.scroll);
      }
    },
  },
};
</script>

<style lang="scss">
.q-branch-menu.q-menu {
  max-height: 70vh;
  background: var(--q-color-panelOpaque) !important;
}

.branch-menu {
  background: var(--q-color-panelOpaque) !important;

  .q-virtual-scroll__content > .q-item {
    height: 34px;
    min-height: 34px;
    max-height: 34px;
    box-sizing: border-box;
  }

  .branch-separator {
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    body.panelDark & {
      border-top-color: rgba(255, 255, 255, 0.28);
    }
  }

  .option-number {
    font-size: 1rem;
    font-weight: bold;
    line-height: 1.3em;
    padding: 4px 0;
    width: 2em;
    flex-shrink: 0;
    text-align: center;
    border-radius: $generic-border-radius;
    background-color: var(--q-color-bg);
    color: var(--q-color-textDark);
    body.secondaryDark & {
      color: var(--q-color-textLight);
    }
    &.selected {
      background-color: var(--q-color-primary) !important;
      color: var(--q-color-textDark) !important;
      body.primaryDark & {
        color: var(--q-color-textLight) !important;
      }
    }
  }

  .linenum {
    z-index: 1;
  }

  .branch-container {
    max-width: 20em;
  }

  $fadeWidth: 1em;
  .fade {
    z-index: 2;
    position: relative;
    padding-right: $fadeWidth;
    background: linear-gradient(
      90deg,
      var(--q-color-panelOpaque) calc(100% - #{$fadeWidth}),
      var(--q-color-panelClear) 100%
    );
  }
  body.desktop & .q-hoverable:hover,
  body.desktop & .q-focusable:focus {
    .fade {
      background: linear-gradient(
        90deg,
        var(--q-color-panelOpaqueHover) calc(100% - #{$fadeWidth}),
        var(--q-color-panelClearHover) 100%
      );
    }
    > .q-focus-helper {
      background: var(--q-color-panelOpaqueHover) !important;
      opacity: 1 !important;
    }
  }
  .q-focus-helper {
    transition: none !important;

    &:before,
    &:after {
      display: none;
    }
  }
}

@media (pointer: fine) {
  .q-branch-menu.scroll::-webkit-scrollbar-track,
  .branch-menu::-webkit-scrollbar-track {
    background: var(--q-color-panelOpaque);
  }
  .q-branch-menu.scroll::-webkit-scrollbar-thumb,
  .branch-menu::-webkit-scrollbar-thumb {
    background: var(--q-color-panelOpaqueHover);
  }
}
</style>
