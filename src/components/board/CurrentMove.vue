<template>
  <div v-show="position.ply" class="board-move-container no-pointer-events">
    <div class="board-move" :class="{ collapsed }">
      <Move
        v-if="position.move"
        :class="{ 'all-pointer-events': !collapsed }"
        :move="position.move"
        separate-branch
        current-only
        standalone
      />
      <q-btn
        @click="toggle"
        :icon="icon"
        class="collapse dimmed-btn all-pointer-events"
        v-ripple="false"
        :color="btnColor"
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
  computed: {
    collapsed: {
      get() {
        return !this.$store.state.ui.showMove;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["showMove", !value]);
      },
    },
    position() {
      return this.$store.state.game.position;
    },
    icon() {
      return this.collapsed ? "forward" : "backward";
    },
    btnColor() {
      return this.$store.state.ui.theme.secondaryDark
        ? "textLight"
        : "textDark";
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
    position: relative;
    margin: 0 18px 18px 18px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    .move {
      transition: transform $generic-hover-transition,
        opacity $generic-hover-transition;
    }
    .collapse {
      left: 0;
      transition: left $generic-hover-transition;
    }
  }

  .board-move.collapsed {
    .move {
      transform: translateX(calc(-100% - 18px));
      opacity: 0;
      pointer-events: none;
    }
    .collapse {
      left: -18px;
    }
  }
}
</style>
