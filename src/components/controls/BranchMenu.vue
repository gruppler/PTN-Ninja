<template>
  <q-menu
    ref="menu"
    :value="value"
    @input="$emit('input', $event)"
    content-class="bg-panel"
    transition-show="none"
    transition-hide="none"
    auto-close
  >
    <q-list class="branch-menu bg-panel" dense>
      <q-item
        v-for="(ply, i) in branches"
        :key="i"
        ref="items"
        @click="select(ply)"
        clickable
      >
        <q-item-section side>
          <q-badge
            class="option-number text-subtitle2 q-pa-sm"
            :class="{ selected: selected === i }"
            :label="i"
          />
        </q-item-section>
        <q-item-label class="row no-wrap">
          <Linenum
            v-if="linenum"
            :linenum="ply.linenum"
            no-edit
            :active-ply="ply"
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
    linenum: Boolean,
  },
  data() {
    return {
      isClosing: false,
    };
  },
  computed: {
    game() {
      return this.$store.state.game.current;
    },
    selected() {
      const index = findLastIndex(
        this.branches,
        (ply) =>
          this.game.state.plies.includes(ply) && ply.id <= this.game.state.plyID
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

  .branch {
    flex-shrink: 1;
  }
}
</style>
