<template>
  <div>
    <div class="absolute-fit scroll">
      <div class="ptn q-py-md" v-if="game">
        <Move
          class="q-px-md"
          v-for="move in moves"
          :ref="move.id"
          :move="move"
          :game="game"
          :key="move.linenum.text()"
        />
      </div>
    </div>
    <div class="absolute-fit inset-shadow no-pointer-events" />
    <q-resize-observer @resize="scroll" />
  </div>
</template>

<script>
import Move from "./Move";

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
      const move =
        this.game.state.ply && this.game.state.move.id in this.$refs
          ? this.$refs[this.game.state.move.id][0]
          : null;
      if (move) {
        move.$el.scrollIntoView({
          block: "center"
        });
      }
    }
  },
  watch: {
    game() {
      this.$nextTick(this.scroll);
    },
    "game.state.plyID"() {
      this.scroll();
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
.ptn
  color $blue-grey-10
  > *
    font-size 18px
    vertical-align middle
</style>
