<template>
  <q-btn
    class="tak"
    :label="$t('Tak')"
    :class="{ active: game.state.isTak }"
    @click="toggle"
    v-bind="$attrs"
  />
</template>

<script>
export default {
  name: "TakButton",
  props: ["game"],
  methods: {
    toggle() {
      if (this.game) {
        if (this.game.state.isTak) {
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
.q-btn.tak.active
  background-color $accent
  color $gray-dark
</style>
