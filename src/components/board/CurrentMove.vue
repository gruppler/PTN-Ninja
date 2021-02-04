<template>
  <div
    v-show="game.state.ply && !$store.state.ui.showPTN"
    class="board-move-container no-pointer-events"
  >
    <div class="board-move" :class="{ collapsed }">
      <q-btn
        @click="toggle"
        :icon="icon"
        class="collapse dimmed-btn all-pointer-events"
        :ripple="false"
        dense
        flat
      />
      <Move
        v-if="game.state.move"
        :class="{ 'all-pointer-events': !collapsed }"
        :move="game.state.move"
        separate-branch
        current-only
        standalone
      />
    </div>
  </div>
</template>

<script>
import Move from "../PTN/Move";

export default {
  name: "CurrentMove",
  components: { Move },
  computed: {
    collapsed: {
      get() {
        return !this.$store.state.ui.showMove;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["showMove", !value]);
      },
    },
    game() {
      return this.$game;
    },
    icon() {
      return this.collapsed ? "up" : "down";
    },
  },
  methods: {
    toggle() {
      this.collapsed = !this.collapsed;
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
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  flex-shrink: 0;

  .board-move {
    margin: 0 18px 18px 18px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
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
    transform: translateY(calc(100% - 16px));
  }
}
</style>
