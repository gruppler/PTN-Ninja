<template>
  <q-btn-group class="eval-buttons" v-bind="$attrs">
    <q-btn
      :label="$t('Tak')"
      :class="{ active: isTak }"
      @click="toggle('tak')"
      @shortkey="toggle('tak')"
      v-shortkey="hotkeys.tak"
    />
    <q-btn
      :label="$t('Tinue')"
      :class="{ active: isTinue }"
      @click="toggle('tinue')"
      @shortkey="toggle('tinue')"
      v-shortkey="hotkeys.tinue"
    />
    <q-btn
      :label="isDoubleQ ? '??' : '?'"
      :class="{ active: isQ, double: isDoubleQ }"
      @click.left="toggle('?')"
      @click.right.prevent="toggle('?', true)"
      @shortkey="toggle('?', $event.srcKey === 'double')"
      v-shortkey="{
        single: hotkeys.question,
        double: hotkeys.questionDouble,
      }"
      dense
    />
    <q-btn
      :label="isDoubleBang ? '!!' : '!'"
      :class="{ active: isBang, double: isDoubleBang }"
      @click.left="toggle('!')"
      @click.right.prevent="toggle('!', true)"
      @shortkey="toggle('!', $event.srcKey === 'double')"
      v-shortkey="{
        single: hotkeys.bang,
        double: hotkeys.bangDouble,
      }"
      dense
    />
  </q-btn-group>
</template>

<script>
import { HOTKEYS } from "../../keymap";

export default {
  name: "EvalButtons",
  data() {
    return {
      hotkeys: HOTKEYS.EVAL,
    };
  },
  computed: {
    game() {
      return this.$store.state.game.current;
    },
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
    },
  },
  methods: {
    toggle(type, double = false) {
      if (this.game) {
        this.game.toggleEvaluation(type, double);
      }
    },
  },
};
</script>

<style lang="scss">
.eval-buttons {
  .q-btn.active {
    background-color: $orange-light;
    color: $textDark;
    color: var(--q-color-textDark);
    &.double {
      background-color: $red-light;
    }
  }
}
</style>
