<template>
  <q-btn-group class="undo-buttons" v-bind="$attrs">
    <q-btn
      @click="$store.dispatch('game/UNDO')"
      icon="undo"
      :disabled="!canUndo"
    >
      <hint v-if="canUndo">{{ $t("Undo") }}</hint>
    </q-btn>
    <q-btn
      @click="$store.dispatch('game/REDO')"
      icon="redo"
      :disabled="!canRedo"
    >
      <hint v-if="canRedo">{{ $t("Redo") }}</hint>
    </q-btn>
  </q-btn-group>
</template>

<script>
import { HOTKEYS } from "../../keymap";

export default {
  name: "UndoButtons",
  data() {
    return {
      hotkeys: HOTKEYS.EVAL,
    };
  },
  computed: {
    canUndo() {
      return this.$store.state.game.historyIndex > 0;
    },
    canRedo() {
      return (
        this.$store.state.game.historyIndex <
        this.$store.state.game.history.length
      );
    },
  },
};
</script>
