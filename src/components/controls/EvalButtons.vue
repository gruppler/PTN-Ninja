<template>
  <q-btn-group class="evaluation-buttons" v-bind="$attrs">
    <q-btn
      :label="$t('Tak')"
      :class="{ active: isTak }"
      :disable="isDisabled"
      @click="toggle('tak')"
      @shortkey="toggle('tak')"
      v-shortkey="hotkeys.tak"
    />
    <q-btn
      :label="$t('Tinue')"
      :class="{ active: isTinue }"
      :disable="isDisabled"
      @click="toggle('tinue')"
      @shortkey="toggle('tinue')"
      v-shortkey="hotkeys.tinue"
    />
    <q-btn
      :label="isDoubleQ ? '??' : '?'"
      :class="{ active: isQ, double: isDoubleQ }"
      :disable="isDisabled"
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
      :disable="isDisabled"
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
  props: {
    disable: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      hotkeys: HOTKEYS.EVAL,
    };
  },
  computed: {
    ply() {
      return this.$store.state.game
        ? this.$store.state.game.position.ply
        : null;
    },
    isDisabled() {
      const player = this.$store.state.game.config.player;
      return !this.ply || (player && player !== this.ply.player);
    },
    evaluation() {
      return this.ply ? this.ply.evaluation : null;
    },
    isTak() {
      return this.evaluation && this.evaluation.tak;
    },
    isTinue() {
      return this.evaluation && this.evaluation.tinue;
    },
    isQ() {
      return this.evaluation && this.evaluation["?"];
    },
    isBang() {
      return this.evaluation && this.evaluation["!"];
    },
    isDoubleQ() {
      return this.evaluation && this.evaluation.isDouble["?"];
    },
    isDoubleBang() {
      return this.evaluation && this.evaluation.isDouble["!"];
    },
  },
  methods: {
    toggle(type, double = false) {
      this.$store.dispatch("game/TOGGLE_EVALUATION", { type, double });
    },
  },
};
</script>

<style lang="scss">
.evaluation-buttons {
  .q-btn {
    min-width: 3em;
    &.active {
      background-color: $orange-light;
      color: var(--q-color-textDark);
      &.double {
        background-color: $red-light;
      }
    }
  }
}
</style>
