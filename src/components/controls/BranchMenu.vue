<template>
  <q-menu
    ref="menu"
    :value="value"
    @input="$emit('input', $event)"
    transition-show="scale"
    transition-hide="scale"
    content-class="bg-primary"
    auto-close
    cover
  >
    <q-list class="branch-menu" dense>
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
    Ply: () => import("../PTN/Ply")
  },
  props: {
    value: Boolean,
    game: Object,
    branches: Array,
    linenum: Boolean
  },
  methods: {
    select(ply) {
      this.$emit("select", ply);
    }
  },
  watch: {
    branches() {
      this.$nextTick(this.$refs.menu.updatePosition);
    }
  }
};
</script>

<style lang="stylus">
.branch-menu .option-number
  line-height 1em
  border-radius $generic-border-radius
  background-color $blue-grey-8
  color #fff
  &.selected
    background-color $accent
    color $grey-10
</style>
