<template>
  <recess>
    <q-scroll-area ref="scroll" class="full-ptn absolute-fit non-selectable">
      <div v-if="gameExists">
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
    gameExists() {
      return Boolean(this.$game);
    },
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
        const $scroll = this.$refs.scroll;
        const movesHeight = $scroll.$el.firstChild.scrollHeight;
        const scrollHeight = $scroll.$el.offsetHeight;
        const scrollTop = Math.max(
          0,
          Math.min(
            movesHeight - scrollHeight,
            move.$el.offsetTop - (scrollHeight - move.$el.offsetHeight) / 2
          )
        );
        if (scrollTop !== $scroll.scrollPosition) {
          $scroll.setScrollPosition(
            scrollTop,
            animate && this.$store.state.ui.showPTN ? 300 : 0
          );
        }
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
