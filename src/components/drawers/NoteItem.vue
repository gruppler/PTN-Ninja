<template>
  <div
    class="note-item q-py-xs q-px-md"
    :class="{
      current,
      'q-pt-md': plyID < 0,
    }"
    :key="plyID"
    :ref="plyID"
  >
    <div
      v-if="$store.state.ui.showEval && evaluation !== null"
      class="evaluation"
      :class="{ p1: evaluation > 0, p2: evaluation < 0 }"
      :style="{ width: Math.abs(evaluation) + '%' }"
    />
    <div v-if="ply && plyID >= 0" class="ply-container">
      <Move :move="move" :player="player" separate-branch no-decoration />
    </div>
    <Note
      v-for="(comment, index) in notes"
      :key="`message-${plyID}-${index}`"
      :plyID="plyID"
      :index="index"
      :comment="comment"
      @edit="$emit('edit', $event)"
      @remove="$emit('remove', $event)"
    />
  </div>
</template>

<script>
import Note from "./Note";
import Move from "../PTN/Move";

export default {
  name: "NoteItem",
  components: { Note, Move },
  props: {
    plyID: Number,
    notes: Array,
  },
  data() {
    return {
      message: "",
      editing: null,
    };
  },
  computed: {
    game() {
      return this.$store.state.game;
    },
    ply() {
      return this.game.ptn.allPlies[this.plyID];
    },
    move() {
      return this.ply ? this.game.ptn.allMoves[this.ply.move] : null;
    },
    player() {
      return this.ply ? this.ply.player : null;
    },
    current() {
      return (
        this.game.position.plyID === this.plyID ||
        (this.plyID < 0 &&
          (!this.game.position.ply ||
            (!this.game.position.ply.index && !this.game.position.plyIsDone)))
      );
    },
    evaluation() {
      return this.$store.state.game.comments.evaluations[this.plyID];
    },
  },
  methods: {
    remove({ plyID, index }) {
      this.$store.dispatch("game/REMOVE_NOTE", { plyID, index });
    },
  },
};
</script>

<style lang="scss">
.note-item {
  position: relative;

  &.current {
    background-color: $dim;
    body.panelDark & {
      background-color: $highlight;
    }
  }

  .evaluation {
    &.p1,
    &.p2 {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
    }
  }

  .q-message:not(:last-child) {
    margin-bottom: 3px;
    .q-message-text {
      border-radius: $generic-border-radius;
      min-height: 2em;
      &:before {
        display: none;
      }
    }
  }
  .ply-container {
    padding-bottom: 0.5em;
  }
}
</style>
