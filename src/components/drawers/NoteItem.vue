<template>
  <div
    class="note-item q-py-xs"
    :class="{
      current,
      'q-pt-md': plyID < 0,
    }"
    :key="plyID"
    :ref="plyID"
  >
    <div v-if="ply && plyID >= 0" class="ply-container">
      <Move
        :move="move"
        :player="player"
        separate-branch
        no-decoration
        class="q-px-md"
      />
    </div>

    <Note
      v-for="(comment, index) in notes"
      :key="`message-${plyID}-${index}`"
      :plyID="plyID"
      :index="index"
      :comment="comment"
      @edit="$emit('edit', $event)"
      @remove="$emit('remove', $event)"
      class="q-px-md"
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

  + .note-item {
    border-top: 1px solid $separator-color;

    body.panelDark & {
      border-top-color: $separator-dark-color;
    }
  }

  &.current {
    background-color: $dim;
    body.panelDark & {
      background-color: $highlight;
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
