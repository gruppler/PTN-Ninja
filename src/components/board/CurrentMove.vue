<template>
  <div
    v-show="game.state.ply && $store.state.showMove"
    class="board-move-container no-pointer-events"
  >
    <div class="board-move row no-wrap q-mb-md q-mx-md" :class="{ collapsed }">
      <Move
        v-if="game.state.move"
        :class="{
          'lt-sm': $store.state.showPTN,
          'all-pointer-events': !collapsed,
        }"
        :move="game.state.move"
        separate-branch
        current-only
        standalone
      />
      <q-btn
        @click="collapsed = !collapsed"
        :icon="collapsed ? 'forward' : 'backward'"
        class="collapse dimmed-btn all-pointer-events"
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
  data() {
    return {
      collapsed: false,
    };
  },
  computed: {
    game() {
      return this.$store.state.game.current;
    },
  },
};
</script>

<style lang="scss">
.board-move-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  .board-move {
    transition: transform $generic-hover-transition;
    .move {
      transition: opacity $generic-hover-transition;
    }
  }
  .collapse {
    display: none;
  }
  @media (max-width: $breakpoint-sm-max) {
    align-items: flex-start;
    margin-right: 84px;
    .board-move.collapsed {
      .move {
        opacity: 0;
        pointer-events: none;
      }
      transform: translateX(calc(2em - 100%));
    }
    .collapse {
      display: block;
    }
  }
}
</style>
