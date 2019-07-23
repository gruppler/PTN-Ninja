<template>
  <q-menu
    content-class="bg-primary"
    align="bottom right"
    self="top left"
    auto-close
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
          <strong
            class="option-number q-pa-sm"
            :class="{ selected: ply.isInBranch(game.state.targetBranch) }"
          >
            {{ i }}
          </strong>
        </q-item-section>
        <q-item-label>
          <Ply :ply="ply" :game="game" :noBranches="true" :noClick="true" />
        </q-item-label>
      </q-item>
    </q-list>
  </q-menu>
</template>

<script>
export default {
  name: "BranchMenu",
  components: {
    Ply: () => import("./Ply")
  },
  props: ["game", "branches"],
  methods: {
    select(ply) {
      this.$emit("input", ply);
    }
  }
};
</script>

<style lang="stylus">
.branch-menu .option-number
  line-height 1em
  border-radius $generic-border-radius
  color #fff
  &.selected
    background-color $accent
    color $grey-10
</style>
