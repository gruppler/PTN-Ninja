<template>
  <q-menu
    ref="menu"
    :value="value"
    @input="$emit('input', $event)"
    content-class="bg-panel"
    auto-close
  >
    <q-list class="branch-menu bg-panel" dense>
      <q-item
        v-for="(ply, i) in branches"
        :key="i"
        @click="select(ply)"
        clickable
      >
        <q-item-section side>
          <q-badge
            class="option-number text-subtitle2 q-pa-sm"
            :class="{ selected: game.state.plies.includes(ply) }"
            :label="i"
          />
        </q-item-section>
        <q-item-label class="row no-wrap">
          <Linenum v-if="linenum" :linenum="ply.linenum" :game="game" no-edit />
          <Ply :plyID="ply.id" :game="game" no-branches no-click />
        </q-item-label>
      </q-item>
    </q-list>
  </q-menu>
</template>

<script>
export default {
  name: "BranchMenu",
  components: {
    Linenum: () => import("../PTN/Linenum"),
    Ply: () => import("../PTN/Ply"),
  },
  props: {
    value: Boolean,
    game: Object,
    branches: Array,
    linenum: Boolean,
  },
  data() {
    return {
      isClosing: false,
    };
  },
  methods: {
    select(ply) {
      this.isClosing = true;
      this.$emit("select", ply);
    },
  },
  watch: {
    branches() {
      if (!this.isClosing) {
        this.$nextTick(this.$refs.menu.updatePosition);
      }
    },
    value(isVisible) {
      if (isVisible) {
        this.isClosing = false;
      }
    },
  },
};
</script>

<style lang="scss">
.branch-menu .option-number {
  line-height: 1em;
  border-radius: $generic-border-radius;
  color: $textDark;
  color: var(--q-color-textDark);
  background-color: $dim;
  body.panelDark & {
    background-color: $highlight;
  }
  body.panelDark:not(.panelMedium) & {
    color: $textLight;
    color: var(--q-color-textLight);
  }
  &.selected {
    background-color: $primary;
    background-color: var(--q-color-primary);
    color: var(--q-color-textDark);
    body.primaryDark & {
      color: $textLight;
      color: var(--q-color-textLight);
    }
  }
}
</style>
