<template>
  <recess>
    <q-scroll-area
      id="ptn-scroll-area"
      class="full-ptn absolute-fit non-selectable"
    >
      <q-virtual-scroll
        v-if="gameExists"
        ref="scroll"
        class="content absolute-fit"
        :items="moves"
        scroll-target="#ptn-scroll-area > .content"
        :virtual-scroll-item-size="36"
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
    }, 50),
  },
  watch: {
    "position.plyID"() {
      this.$nextTick(() => this.scroll());
    },
    "$store.state.ui.showAllBranches"() {
      this.$nextTick(() => this.scroll());
    },
  },
  updated() {
    this.$nextTick(() => this.scroll());
  },
};
</script>
