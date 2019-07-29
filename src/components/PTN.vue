<template>
  <q-scroll-area>
    <div class="ptn q-py-md" v-if="game">
      <Move
        v-for="(move, index) in moves"
        ref="moves"
        :move="move"
        :game="game"
        :key="index"
      />
    </div>
  </q-scroll-area>
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
    scroll(smooth) {
      if (
        this.$refs.moves &&
        this.game.state.move &&
        this.game.state.move.index in this.$refs.moves
      ) {
        this.$refs.moves[this.game.state.move.index].$el.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "center"
        });
      }
    }
  },
  watch: {
    game() {
      this.scroll();
    },
    "game.state.ply.id"() {
      this.scroll(true);
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
