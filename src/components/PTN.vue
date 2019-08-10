<template>
  <div>
    <q-scroll-area class="fit">
      <div class="ptn q-py-md" v-if="game">
        <Move
          class="q-px-md"
          v-for="(move, index) in moves"
          :ref="move.id"
          :move="move"
          :game="game"
          :key="index"
        />
      </div>
    </q-scroll-area>
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
        ? this.game.moves
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
    "game.state.ply.id"() {
      this.scroll();
    }
  },
  mounted() {
    this.scroll();
  }
};
</script>

<style lang="stylus">
.ptn
  font-family 'Source Code Pro'
  color $blue-grey-10
  > *
    font-size 18px
    vertical-align middle
</style>
