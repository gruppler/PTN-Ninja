<template>
  <q-menu
    :value="value"
    @input="$emit('input', $event)"
    transition-show="scale"
    transition-hide="scale"
    content-class="bg-primary"
    auto-close
    cover
    dark
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
          <Linenum
            v-if="linenum !== undefined"
            :linenum="ply.move.linenum"
            :game="game"
            noBranch
            class="ellipsis"
          />
          <Ply
            :plyID="ply.id"
            :game="game"
            noBranches
            noClick
            class="ellipsis"
          />
        </q-item-label>
      </q-item>
    </q-list>
  </q-menu>
</template>

<script>
export default {
  name: "BranchMenu",
  components: {
    Linenum: () => import("./Linenum"),
    Ply: () => import("./Ply")
  },
  props: ["value", "game", "branches", "linenum"],
  methods: {
    select(ply) {
      this.$emit("select", ply);
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
