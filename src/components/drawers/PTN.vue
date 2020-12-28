<template>
  <recess>
    <q-scroll-area ref="scroll" class="full-ptn absolute-fit non-selectable">
      <div v-if="game">
        <Move
          class="q-px-md"
          v-for="move in moves"
          :ref="move.id"
          :move="move"
          :game="game"
          :key="move.id"
          separate-branch
        />
      </div>
    </q-scroll-area>
    <q-resize-observer @resize="scroll" />
  </recess>
</template>

<script>
import Move from "../PTN/Move";

export default {
  name: "PTN",
  components: { Move },
  props: ["game"],
  computed: {
    moves() {
      return this.$store.state.ui.showAllBranches
        ? this.game.movesSorted
        : this.game.state.moves;
    },
  },
  methods: {
    scroll(animate = false) {
      const editingBranch = this.$store.state.ui.editingBranch
        ? this.game.branches[this.$store.state.ui.editingBranch] || null
        : null;
      const move = editingBranch
        ? this.$refs[editingBranch.move.id][0]
        : this.game.state.ply && this.game.state.move.id in this.$refs
        ? this.$refs[this.game.state.move.id][0]
        : null;
      if (move) {
        this.$refs.scroll.setScrollPosition(
          move.$el.offsetTop -
            (this.$refs.scroll.$el.offsetHeight - move.$el.offsetHeight) / 2,
          animate && this.$store.state.ui.showPTN ? 200 : 0
        );
      }
    },
  },
  watch: {
    game() {
      this.scroll(true);
    },
    "game.state.plyID"() {
      this.scroll(true);
    },
    "$store.state.ui.showAllBranches"() {
      this.scroll(true);
    },
  },
  mounted() {
    this.scroll();
  },
};
</script>

<style lang="scss">
$padding: 16px;
.full-ptn {
  .move:first-child {
    margin-top: $padding;
  }
  .move:last-child {
    margin-bottom: $padding;
  }
}
</style>
