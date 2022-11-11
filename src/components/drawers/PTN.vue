<template>
  <recess>
    <q-scroll-area
      id="ptn-scroll-area"
      class="full-ptn absolute-fit non-selectable"
    >
      <q-virtual-scroll
        v-if="gameExists"
        ref="scroll"
        class="bg-transparent"
        :items="moves"
        scroll-target="#ptn-scroll-area > .scroll"
        :virtual-scroll-item-size="35"
        :virtual-scroll-slice-ratio-before="0.5"
        :virtual-scroll-slice-ratio-after="0.5"
      >
        <template v-slot="{ item }">
          <Move
            class="q-px-md"
            :ref="item.id"
            :move="item"
            :key="item.id"
            separate-branch
            show-eval
          />
        </template>
      </q-virtual-scroll>
    </q-scroll-area>
    <q-resize-observer @resize="scroll" />
  </recess>
</template>

<script>
import Move from "../PTN/Move";

import { throttle } from "lodash";

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
        ? Object.freeze(this.ptn.sortedMoves)
        : Object.freeze(this.ptn.branchMoves);
    },
  },
  methods: {
    scroll: throttle(function () {
      const editingBranch = this.$store.state.ui.editingBranch
        ? this.ptn.branches[this.$store.state.ui.editingBranch] || null
        : null;
      const index = editingBranch
        ? editingBranch.move.id
        : this.position.move.id;
      if (index >= 0) {
        this.$refs.scroll.scrollTo(index, "center-force");
      }
    }, 100),
  },
  watch: {
    "position.tps"() {
      this.$nextTick(() => this.scroll());
    },
    "$store.state.ui.showAllBranches"() {
      this.$nextTick(() => this.scroll());
    },
  },
};
</script>

<style lang="scss">
.full-ptn {
  .ptn.ply.other {
    opacity: 0.5;
  }
}
</style>
