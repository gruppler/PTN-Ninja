<template>
  <span class="result ptn" v-if="result">
    <span
      class="color1"
      :class="'result-' + (result.isTie ? 'tie' : result.player1)"
      >{{ result.player1 }}</span
    >
    <span
      class="color2"
      :class="'result-' + (result.isTie ? 'tie' : result.player2)"
      >{{ result.player2 }}</span
    >
  </span>
</template>

<script>
export default {
  name: "Result",
  props: ["result"]
};
</script>

<style lang="stylus">
.result
  font-family 'Source Code Pro'
  white-space nowrap
  font-weight bold
  height 24px
  margin 4px
  vertical-align middle
  .color1, .color2
    padding 2px 6px
  .color1
    background-color $gray-light
    border-radius 4px 0 0 4px
    &.result-R
      color $green-dark
    &.result-F
      color $blue-dark
    &.result-0
      color $red-dark
    &.result-tie, &.result-1
      color $gray-dark
  .color2
    background-color $gray-dark
    border-radius 0 4px 4px 0
    &.result-R
      color $green-light
    &.result-F
      color $blue-light
    &.result-0
      color $red-light
    &.result-tie, &.result-1
      color $gray-light
</style>
