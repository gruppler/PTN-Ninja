<template>
  <q-menu
    :value="value"
    @input="$emit('input', $event)"
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
          <span
            class="option-number text-subtitle2 q-pa-sm"
            :class="{ selected: game.state.plies.includes(ply) }"
          >
            {{ i }}
          </span>
        </q-item-section>
        <q-item-label class="ellipsis">
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
  props: ["value", "game", "branches"],
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
  color #fff
  &.selected
    background-color $accent
    color $grey-10
</style>
