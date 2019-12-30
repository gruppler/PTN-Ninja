<template>
  <div
    class="board-toggles q-gutter-sm"
    :class="{ row: isPortrait, column: !isPortrait }"
  >
    <FullscreenToggle
      v-if="$q.fullscreen.isCapable"
      @input="$q.fullscreen.toggle()"
      :value="$q.fullscreen.isActive"
    />
    <q-btn
      @click="board3D = !board3D"
      :icon="board3D ? 'apps' : '3d_rotation'"
      :title="$t((board3D ? '2' : '3') + 'D Board')"
      class="dimmed-btn"
      color="white"
      flat
      dense
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
