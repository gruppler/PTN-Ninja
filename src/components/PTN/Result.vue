<template>
  <span class="result ptn" :class="{ done, clickable }" v-if="result">
    <span
      class="player1"
      :class="'result-' + (resultObject.isTie ? 'tie' : resultObject.player1)"
      >{{ resultObject.player1 }}</span
    >
    <span
      class="player2"
      :class="'result-' + (resultObject.isTie ? 'tie' : resultObject.player2)"
      >{{ resultObject.player2 }}</span
    >
  </span>
</template>

<script>
import Result from "../../PTN/Result";

export default {
  name: "Result",
  props: {
    result: [String, Object],
    done: {
      type: Boolean,
      default: true,
    },
    clickable: Boolean,
  },
  computed: {
    resultObject() {
      return this.result && this.result.constructor === Result
        ? this.result
        : Result.parse(this.result || "");
    },
  },
};
</script>

<style lang="stylus">
.result
  font-family 'Source Code Pro'
  white-space nowrap
  font-weight bold
  height 1.5em
  margin 4px
  display inline-block
  vertical-align middle

  body.desktop &.clickable
    cursor pointer
    &:hover
      .player1:after
        background-color rgba($gray-light, 0.1)
      .player2:after
        background-color rgba($gray-dark, 0.1)
      &.done
        .player1:after
          background-color rgba($gray-dark, 0.1)
        .player2:after
          background-color rgba($gray-light, 0.1)
    &:active
      .player1, .player2
        box-shadow: $shadow-1

  .player1, .player2
    padding 2px 6px
    position relative
    &:after
      content ""
      position absolute
      top 0
      bottom 0
      left 0
      right 0
      pointer-events none
      background-color rgba(0, 0, 0, 0)
      transition background-color $generic-hover-transition

  .player1
    border-radius 4px 0 0 4px
    border 1px solid $gray-light
    &.result-R
      color $green-med
    &.result-F
      color $blue-med
    &.result-0
      color $red-med
    &.result-tie, &.result-1
      color $gray-light
  .player2
    border-radius 0 4px 4px 0
    border 1px solid $gray-dark
    &.result-R
      color $green-med
    &.result-F
      color $blue-med
    &.result-0
      color $red-med
    &.result-tie, &.result-1
      color $gray-dark

  &.done
    .player1
      background-color $gray-light
      &.result-R
        color $green-dark
      &.result-F
        color $blue-dark
      &.result-0
        color $red-dark
      &.result-tie, &.result-1
        color $gray-dark
    .player2
      background-color $gray-dark
      &.result-R
        color $green-light
      &.result-F
        color $blue-light
      &.result-0
        color $red-light
      &.result-tie, &.result-1
        color $gray-light
</style>
