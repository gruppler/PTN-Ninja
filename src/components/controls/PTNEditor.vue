<template>
  <form class="fit" spellcheck="false">
    <q-input
      type="textarea"
      v-model="ptn"
      color="accent"
      class="ptn-editor fit"
      no-error-icon
    />
  </form>
</template>

<script>
// import Game from "../../PTN/Game";

export default {
  name: "PTNEditor",
  props: ["game"],
  data() {
    return {
      ptn: ""
    };
  },
  methods: {
    save() {
      this.$emit("save", this.game.headerText() + this.ptn);
    },
    init() {
      this.ptn = this.game ? this.game.moveText(true, true) : "";
    }
  },
  mounted() {
    this.init();
  }
};
</script>

<style lang="stylus">
.ptn-editor
  font-family 'Source Code Pro'
  font-weight bold

  &.q-textarea
    .q-field__native
      resize none
      padding 16px
    .q-field__control
      height 100%
      padding 0
</style>
