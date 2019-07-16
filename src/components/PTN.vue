<template>
  <q-scroll-area ref="scrollarea">
    <div class="ptn q-py-md" v-if="game">
      <Move
        v-for="(move, index) in game.state.moves"
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
import { scroll } from "quasar";

export default {
  name: "PTN",
  components: { Move },
  props: ["game"],
  methods: {
    scroll(duration = 0) {
      this.$nextTick(() => {
        if (
          this.$refs.moves &&
          this.game.state.move.index in this.$refs.moves
        ) {
          const el = this.$refs.moves[this.game.state.move.index].$el;
          const target = scroll.getScrollTarget(el);
          const offset =
            el.offsetTop - (target.offsetHeight + el.offsetHeight) / 2;
          scroll.setScrollPosition(target, offset, duration);
        }
      });
    }
  },
  watch: {
    "game.state.move.id"() {
      this.scroll(150);
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
