<template>
  <q-btn-group class="evaluation-buttons" v-bind="$attrs">
    <!-- Compact mode: Tak button with context menu for other evals -->
    <template v-if="compact">
      <q-btn
        ref="takButton"
        :label="$t('Tak')"
        :class="{ active: isTak }"
        :disable="isDisabled"
        @click="toggle('tak')"
        @click.right.prevent="compact ? (showMenu = !showMenu) : null"
        @shortkey="toggle('tak')"
        v-shortkey="hotkeys.tak"
      >
        <q-menu
          v-if="compact"
          v-model="showMenu"
          content-class="evaluation-buttons"
          anchor="top left"
          self="bottom left"
          transition-show="none"
          transition-hide="none"
          square
        >
          <div class="column reverse">
            <q-btn
              :label="$t('Tinue')"
              :class="{ active: isTinue }"
              :disable="isDisabled"
              @click="toggle('tinue')"
              stretch
              flat
            />
            <q-btn
              :label="isDoubleQ ? '??' : '?'"
              :class="{ active: isQ, double: isDoubleQ }"
              :disable="isDisabled"
              @click="toggle('?')"
              @click.right.prevent="toggle('?', true)"
              stretch
              flat
            />
            <q-btn
              :label="isDoubleBang ? '!!' : '!'"
              :class="{ active: isBang, double: isDoubleBang }"
              :disable="isDisabled"
              @click="toggle('!')"
              @click.right.prevent="toggle('!', true)"
              stretch
              flat
            />
          </div>
        </q-menu>
      </q-btn>
    </template>

    <!-- Normal mode: All buttons visible -->
    <template v-else>
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
    </template>

    <!-- Hotkeys for compact mode (always active) -->
    <div v-if="compact" class="hidden">
      <div v-shortkey="hotkeys.tinue" @shortkey="toggle('tinue')" />
      <div
        v-shortkey="{
          single: hotkeys.question,
          double: hotkeys.questionDouble,
        }"
        @shortkey="toggle('?', $event.srcKey === 'double')"
      />
      <div
        v-shortkey="{
          single: hotkeys.bang,
          double: hotkeys.bangDouble,
        }"
        @shortkey="toggle('!', $event.srcKey === 'double')"
      />
    </div>
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
    compact: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      hotkeys: HOTKEYS.EVAL,
      showMenu: false,
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
      return Boolean(!this.ply || (player && player !== this.ply.player));
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
