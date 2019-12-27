<template>
  <q-btn-group class="eval-buttons" v-bind="$attrs">
    <q-btn
      :label="$t('Tak')"
      :class="{ active: isTak }"
      @click="toggle('tak')"
    />
    <q-btn
      :label="$t('Tinue')"
      :class="{ active: isTinue }"
      @click="toggle('tinue')"
    />
    <q-btn
      :label="isDoubleQ ? '??' : '?'"
      :class="{ active: isQ, double: isDoubleQ }"
      @click.left="toggle('?')"
      @click.right.prevent="toggle('?', true)"
      dense
    />
    <q-btn
      :label="isDoubleBang ? '!!' : '!'"
      :class="{ active: isBang, double: isDoubleBang }"
      @click.left="toggle('!')"
      @click.right.prevent="toggle('!', true)"
      dense
    />
  </q-btn-group>
</template>

<script>
export default {
  name: "EvalButtons",
  props: ["game"],
  computed: {
    ply() {
      return this.game ? this.game.state.ply : null;
    },
    eval() {
      return this.ply ? this.ply.evaluation : null;
    },
    isTak() {
      return this.eval && this.eval.tak;
    },
    isTinue() {
      return this.eval && this.eval.tinue;
    },
    isQ() {
      return this.eval && this.eval["?"];
    },
    isBang() {
      return this.eval && this.eval["!"];
    },
    isDoubleQ() {
      return this.eval && this.eval.isDouble("?");
    },
    isDoubleBang() {
      return this.eval && this.eval.isDouble("!");
    }
  },
  methods: {
    toggle(type, double = false) {
      if (this.game) {
        this.game.toggleEvaluation(type, double);
      }
    }
  }
};
</script>

<style lang="stylus">
.eval-buttons
  .q-btn.active
    background-color $orange-light
    color $gray-dark
    &.double
      background-color $red-light
</style>
