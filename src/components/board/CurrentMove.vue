<template>
  <div
    v-show="game.state.ply && $store.state.showMove && !$store.state.showPTN"
    class="board-move-container no-pointer-events"
  >
    <div class="board-move row no-wrap q-mb-md q-mx-md" :class="{ collapsed }">
      <Move
        v-if="game.state.move"
        :class="{ 'all-pointer-events': !collapsed }"
        :move="game.state.move"
        :game="game"
        separate-branch
        current-only
        standalone
      />
      <q-btn
        @click="collapsed = !collapsed"
        :icon="collapsed ? 'forward' : 'backward'"
        class="collapse dimmed-btn all-pointer-events"
        :ripple="false"
        dense
        flat
      />
    </div>
  </div>
</template>

<script>
import Move from "../PTN/Move";

export default {
  name: "CurrentMove",
  components: { Move },
  props: ["game"],
  data() {
    return {
      collapsed: false,
    };
  },
};
</script>

<style lang="scss">
.board-move-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  align-items: flex-start;

  .board-move {
    transition: transform $generic-hover-transition;
    .move {
      transition: opacity $generic-hover-transition;
    }
  }

  .board-move.collapsed {
    .move {
      opacity: 0;
      pointer-events: none;
    }
    transform: translateX(calc(16px - 100%));
  }
}
</style>
