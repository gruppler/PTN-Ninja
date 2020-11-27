<template>
  <div
    class="board-toggles q-gutter-md"
    :class="{ row: isPortrait, column: !isPortrait }"
  >
    <FullscreenToggle
      v-if="$q.fullscreen.isCapable"
      @input="$q.fullscreen.toggle()"
      :value="$q.fullscreen.isActive"
    />
    <q-icon
      @click="board3D = !board3D"
      :name="board3D ? '2d' : '3d'"
      :title="$t((board3D ? '2' : '3') + 'D Board')"
      class="q-field__focusable-action"
      size="sm"
    />
  </div>
</template>

<script>
import FullscreenToggle from "./FullscreenToggle";

export default {
  name: "BoardToggles",
  components: { FullscreenToggle },
  computed: {
    board3D: {
      get() {
        return this.$store.state.board3D;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["board3D", value]);
      }
    },
    isPortrait() {
      return this.$store.state.isPortrait;
    }
  }
};
</script>
