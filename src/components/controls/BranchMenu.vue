<template>
  <q-menu
    ref="menu"
    content-class="q-branch-menu"
    :value="value"
    @input="$emit('input', $event)"
    transition-show="none"
    transition-hide="none"
    auto-close
    cover
  >
    <q-list class="branch-menu" dense>
      <q-item
        v-for="(ply, i) in branches"
        :key="i"
        ref="items"
        @click="select(ply)"
        clickable
      >
        <q-item-label class="row no-wrap overflow-hidden items-center">
          <span class="fade">
            <q-badge
              class="option-number text-subtitle2 q-pa-sm"
              :class="{ selected: selected === i }"
              :label="i"
            />
          </span>
          <Linenum
            :linenum="ply.linenum"
            :active-ply="ply"
            class="col-shrink"
          />
          <Ply :plyID="ply.id" no-branches no-click />
        </q-item-label>
      </q-item>
    </q-list>
  </q-menu>
</template>

<script>
import { findLastIndex } from "lodash";

export default {
  name: "BranchMenu",
  components: {
    Linenum: () => import("../PTN/Linenum"),
    Ply: () => import("../PTN/Ply"),
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
    selected() {
      const index = findLastIndex(
        this.branches,
        (ply) =>
          this.$store.state.game.ptn.branchPlies.find((p) => p.id === ply.id) &&
          (!this.selectedPlayed ||
            ply.id <= this.$store.state.game.position.plyID)
      );
      return index >= 0 ? index : 0;
    },
  },
  methods: {
    select(ply) {
      this.isClosing = true;
      this.$emit("select", ply);
    },
    scroll() {
      if (this.$refs.items) {
        const item = this.$refs.items[this.selected];
        if (item) {
          item.$el.scrollIntoView({ block: "nearest" });
        }
      }
    },
  },
  watch: {
    selected(index) {
      this.scroll();
    },
    branches() {
      if (!this.isClosing) {
        this.$nextTick(this.$refs.menu.updatePosition);
      }
    },
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
.branch-menu {
  background: $panelOpaque !important;
  background: var(--q-color-panelOpaque) !important;

  .option-number {
    line-height: 1em;
    border-radius: $generic-border-radius;
    background-color: $bg;
    background-color: var(--q-color-bg);
    color: $textDark;
    color: var(--q-color-textDark);
    body.secondaryDark & {
      color: $textLight;
      color: var(--q-color-textLight);
    }
    &.selected {
      background-color: $primary !important;
      background-color: var(--q-color-primary) !important;
      color: var(--q-color-textDark) !important;
      body.primaryDark & {
        color: $textLight !important;
        color: var(--q-color-textLight) !important;
      }
    }
  }

  .linenum {
    z-index: 1;
  }

  $fadeWidth: 1em;
  .fade {
    z-index: 2;
    position: relative;
    padding-right: $fadeWidth;
    background: linear-gradient(
      90deg,
      #{$panelOpaque} calc(100% - #{$fadeWidth}),
      #{$panelClear} 100%
    );
    background: linear-gradient(
      90deg,
      var(--q-color-panelOpaque) calc(100% - #{$fadeWidth}),
      var(--q-color-panelClear) 100%
    );
  }
  .q-hoverable:hover,
  .q-focusable:focus {
    .fade {
      background: linear-gradient(
        90deg,
        #{$panelOpaqueHover} calc(100% - #{$fadeWidth}),
        #{$panelClearHover} 100%
      );
      background: linear-gradient(
        90deg,
        var(--q-color-panelOpaqueHover) calc(100% - #{$fadeWidth}),
        var(--q-color-panelClearHover) 100%
      );
    }
    > .q-focus-helper {
      background: $panelOpaqueHover !important;
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
  .q-branch-menu.scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .q-branch-menu.scroll::-webkit-scrollbar-thumb {
    background: $panelOpaqueHover;
    background: var(--q-color-panelOpaqueHover);
  }
}
</style>
