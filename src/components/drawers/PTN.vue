<template>
  <recess>
    <q-scroll-area ref="scroll" class="full-ptn absolute-fit non-selectable">
      <div v-if="$game">
        <Move
          class="q-px-md"
          v-for="move in moves"
          :ref="move.id"
          :move="move"
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

import { debounce } from "lodash";

export default {
  name: "PTN",
  components: { Move },
  computed: {
    position() {
      return this.$store.state.game.position;
    },
    ptn() {
      return this.$store.state.game.ptn;
    },
    moves() {
      return this.$store.state.ui.showAllBranches
        ? this.ptn.allMoves
        : this.ptn.branchMoves;
    },
  },
  methods: {
    scroll: debounce(function (animate = false) {
      const editingBranch = this.$store.state.ui.editingBranch
        ? this.ptn.branches[this.$store.state.ui.editingBranch] || null
        : null;
      const move = editingBranch
        ? this.$refs[editingBranch.move][0]
        : this.position.ply && this.position.move.id in this.$refs
        ? this.$refs[this.position.move.id][0]
        : null;
      if (move) {
        this.$refs.scroll.setScrollPosition(
          move.$el.offsetTop -
            (this.$refs.scroll.$el.offsetHeight - move.$el.offsetHeight) / 2,
          animate && this.$store.state.ui.showPTN ? 300 : 0
        );
      }
    }, 100),
  },
  watch: {
    "position.plyID"() {
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
