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
    <div
      v-if="$store.state.ui.showEval && evaluation !== null"
      class="evaluation"
      :class="{ p1: evaluation > 0, p2: evaluation < 0 }"
      :style="{ width: Math.abs(evaluation) + '%' }"
    />
    <div v-if="ply && plyID >= 0" class="ply-container q-px-md">
      <Move :move="move" :player="player" separate-branch no-decoration />
    </div>

    <div v-if="pvs && pvs.length">
      <q-item
        v-for="(pv, i) in pvs"
        :key="i"
        @mouseover="highlight(pv)"
        @mouseout="unhighlight"
        @click="insertPV(i)"
        clickable
      >
        <q-item-label class="small">
          <Ply v-for="(ply, j) in pv" :key="j" :ply="ply" no-click />
        </q-item-label>
      </q-item>
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
import Ply from "../PTN/Ply";
import PlyClass from "../../Game/PTN/Ply";

export default {
  name: "NoteItem",
  components: { Note, Move, Ply },
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
    pvs() {
      let pvs = this.$store.state.game.comments.pvs[this.plyID];
      if (pvs) {
        return pvs.map(this.formatPV);
      }
      return null;
    },
  },
  methods: {
    remove({ plyID, index }) {
      this.$store.dispatch("game/REMOVE_NOTE", { plyID, index });
    },
    nextPly(player, color) {
      if (player === 2 && color === 1) {
        return { player: 1, color: 1 };
      }
      return { player: player === 1 ? 2 : 1, color: color === 1 ? 2 : 1 };
    },
    formatPV(pv) {
      let player = this.ply.player;
      let color = this.ply.color;
      return pv.map((ply, i) => {
        if (i) {
          ({ player, color } = this.nextPly(player, color));
        }
        return new PlyClass(ply, { id: null, player, color });
      });
    },
    highlight(pv) {
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", pv[0].squares);
    },
    unhighlight() {
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", null);
    },
    insertPV(i) {
      if (!this.pvs || !this.pvs[i]) {
        return;
      }
      this.unhighlight();
      if (this.$store.state.game.position.plyID !== this.plyID) {
        this.$store.commit("game/GO_TO_PLY", {
          plyID: this.plyID,
          isDone: false,
        });
      } else if (this.$store.state.game.position.plyIsDone) {
        this.$store.commit("game/PREV", { half: true });
      }
      this.$store.dispatch(
        "game/INSERT_PLIES",
        this.pvs[i].map((ply) => ply.text)
      );
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
