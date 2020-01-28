<template>
  <recess>
    <div class="full-ptn absolute-fit scroll non-selectable">
      <div v-if="game">
        <Move
          class="q-px-md"
          v-for="move in moves"
          :ref="move.id"
          :move="move"
          :game="game"
          :key="move.branch + '/' + move.linenum.text()"
          separate-branch
        />
      </div>
    </div>
    <q-resize-observer @resize="resize" />
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
      return this.$store.state.showAllBranches
        ? this.game.movesSorted
        : this.game.state.moves;
    }
  },
  methods: {
    scroll() {
      const editingBranch = this.$store.state.editingBranch
        ? this.game.branches[this.$store.state.editingBranch] || null
        : null;
      const move = editingBranch
        ? this.$refs[editingBranch.move.id][0]
        : this.game.state.ply && this.game.state.move.id in this.$refs
        ? this.$refs[this.game.state.move.id][0]
        : null;
      if (move) {
        move.$el.scrollIntoView({
          block: "center",
          behavior: "smooth"
        });
      }
    },
    resize() {
      this.scroll();
    }
  },
  watch: {
    game() {
      this.$nextTick(this.scroll);
    },
    "game.state.plyID"() {
      this.$nextTick(this.scroll);
    },
    "$store.state.showAllBranches"() {
      this.$nextTick(this.scroll);
    }
  },
  mounted() {
    this.scroll();
  }
};
</script>

<style lang="stylus">
$padding = 16px
.full-ptn
  .move:first-child
    margin-top $padding
  .move:last-child
    margin-bottom $padding
</style>
