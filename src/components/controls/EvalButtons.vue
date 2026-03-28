<template>
  <q-btn-group class="evaluation-buttons" v-bind="$attrs">
    <q-btn
      :label="takTinueLabel"
      :class="{ active: isTak || isTinue, double: isTinue }"
      :disable="disable"
      @click.left="toggle('tak')"
      @click.right.prevent="toggle('tinue')"
      @shortkey="toggle($event.srcKey === 'double' ? 'tinue' : 'tak')"
      v-shortkey="{
        single: hotkeys.tak,
        double: hotkeys.tinue,
      }"
      dense
    />
    <q-btn
      :label="isDoubleQ ? '??' : '?'"
      :class="{ active: isQ, double: isDoubleQ }"
      :disable="disable"
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
      :disable="disable"
      @click.left="toggle('!')"
      @click.right.prevent="toggle('!', true)"
      @shortkey="toggle('!', $event.srcKey === 'double')"
      v-shortkey="{
        single: hotkeys.bang,
        double: hotkeys.bangDouble,
      }"
      dense
    />
    <q-btn icon="clear" :disable="!hasEvalMarks" @click="removeEvalMarks" dense>
      <hint v-if="hasEvalMarks">{{ $t("analysis.removeEvalMarks") }}</hint>
    </q-btn>
    <q-separator vertical />
    <q-btn
      @touchstart="vibrate"
      @click="deletePly"
      @shortkey="deletePly"
      v-shortkey="{
        delete: controlHotkeys.deletePly,
        backspace: controlHotkeys.backspacePly,
      }"
      :disable="deletePlyDisabled"
      icon="backspace"
    >
      <hint v-if="ply && !plyInProgress">
        {{ $t("Delete Ply") }}
      </hint>
    </q-btn>
  </q-btn-group>
</template>

<script>
import { HOTKEYS } from "../../keymap";

export default {
  name: "EvalButtons",
  data() {
    return {
      hotkeys: HOTKEYS.EVAL,
      controlHotkeys: HOTKEYS.CONTROLS,
    };
  },
  computed: {
    player() {
      return this.$store.state.game.config.player;
    },
    ply() {
      return this.$store.state.game
        ? this.$store.state.game.position.ply
        : null;
    },
    plyID() {
      return this.$store.state.game
        ? this.$store.state.game.position.plyID
        : null;
    },
    isBoardDisabled() {
      return this.$store.state.ui.disableBoard;
    },
    plyInProgress() {
      return this.$store.state.game.selected.pieces.length !== 0;
    },
    disable() {
      return !this.ply || (this.player && this.player !== this.ply.player);
    },
    deletePlyDisabled() {
      return (
        !this.ply ||
        this.plyInProgress ||
        this.isBoardDisabled ||
        (this.player && this.ply.player !== this.player)
      );
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
    takTinueLabel() {
      return this.isTinue ? '"' : "'";
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
    hasEvalMarks() {
      const game = this.$store.state.game;
      const allPlies = game && game.ptn && game.ptn.allPlies;
      if (!allPlies) return false;
      for (let i = 0; i < allPlies.length; i++) {
        const ply = allPlies[i];
        if (
          ply &&
          ply.evaluation &&
          (ply.evaluation.tak ||
            ply.evaluation.tinue ||
            ply.evaluation["?"] ||
            ply.evaluation["!"])
        ) {
          return true;
        }
      }
      return false;
    },
  },
  methods: {
    toggle(type, double = false) {
      this.$store.dispatch("game/TOGGLE_EVALUATION", { type, double });
    },
    removeEvalMarks() {
      if (!this.hasEvalMarks) return;
      this.$store.dispatch("game/REMOVE_EVAL_MARKS");
      this.notifyUndo({
        icon: "eval",
        message: this.$t("success.evalMarksRemoved"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
    deletePly() {
      if (!this.ply || this.plyInProgress || this.isBoardDisabled) {
        return;
      }
      this.$store.dispatch("game/DELETE_PLY", this.plyID);
    },
    vibrate() {
      if (this.$store.state.ui.hapticNavControls && navigator.vibrate) {
        navigator.vibrate(2);
      }
    },
  },
};
</script>

<style lang="scss">
.evaluation-buttons {
  .q-btn.active {
    background-color: $orange-light;
    color: var(--q-color-textDark);
    &.double {
      background-color: $red-light;
    }
  }
}
</style>
