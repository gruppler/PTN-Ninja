<template>
  <form class="fit" spellcheck="false">
    <q-input
      ref="input"
      type="textarea"
      v-model="ptn"
      color="accent"
      class="ptn-editor fit"
      :rules="rules"
      @keydown.ctrl.enter.prevent="save"
      hide-bottom-space
      no-error-icon
    />
  </form>
</template>

<script>
import Game from "../../PTN/Game";

import { unescape } from "lodash";

export default {
  name: "PTNEditor",
  props: ["game"],
  data() {
    return {
      ptn: "",
      rules: [
        (moves) => {
          const result = Game.validate(this.header + moves);
          return result === true ? true : this.$t(`error["${result}"]`);
        },
      ],
    };
  },
  computed: {
    header() {
      return this.game.headerText();
    },
    error() {
      return this.$refs.input.computedErrorMessage;
    },
  },
  methods: {
    save() {
      this.$emit("save", this.header + this.ptn);
    },
    init() {
      this.ptn = this.game ? this.game.moveText(true, true) : "";
    },
  },
  mounted() {
    this.init();
  },
};
</script>

<style lang="stylus">
.ptn-editor
  font-family 'Source Code Pro'
  font-weight bold
  background-color $highlight

  &.q-textarea
    .q-field__native
      resize none
      padding 16px
    .q-field__control
      height 100%
      padding 0

  .q-field__bottom
    display none
</style>
