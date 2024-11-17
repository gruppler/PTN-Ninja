<template>
  <div v-show="position.ply" class="board-move-container no-pointer-events">
    <div class="board-move" :class="{ collapsed }">
      <q-btn
        @click="toggle"
        :icon="icon"
        class="collapse dimmed-btn all-pointer-events"
        :class="{ hidden: this.$store.state.ui.showPTN }"
        :ripple="false"
        :color="btnColor"
        dense
        flat
      />
      <Move
        v-if="position.move"
        :class="{ 'all-pointer-events': !collapsed }"
        :move="position.move"
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
        return !this.$store.state.ui.showMove || this.$store.state.ui.showPTN;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["showMove", !value]);
      },
    },
    position() {
      return this.$store.state.game.position;
    },
    icon() {
      return this.collapsed ? "up" : "down";
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
