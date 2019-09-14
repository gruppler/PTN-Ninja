<template>
  <q-btn
    class="tinue"
    :label="$t('Tinue')"
    :class="{ active: game.state.isTinue }"
    @click="toggle"
    v-bind="$attrs"
  />
</template>

<script>
export default {
  name: "TinueButton",
  props: ["game"],
  methods: {
    toggle() {
      if (this.game) {
        if (this.game.state.isTinue) {
          //
        } else {
          //
        }
      }
    }
  }
};
</script>

<style lang="stylus">
.q-btn.tinue.active
  background-color $accent
  color $gray-dark
</style>
