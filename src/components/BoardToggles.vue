<template>
  <div class="board-toggles column q-gutter-y-sm">
    <q-btn
      v-if="$q.fullscreen.isCapable"
      @click="$q.fullscreen.toggle()"
      :icon="$q.fullscreen.isActive ? 'fullscreen_exit' : 'fullscreen'"
      class="dimmed-btn"
      color="white"
      flat
      dense
      v-bind="$attrs"
    />
    <q-btn
      @click="board3D = !board3D"
      :icon="board3D ? 'apps' : '3d_rotation'"
      class="dimmed-btn"
      color="white"
      flat
      dense
      v-bind="$attrs"
    />
  </div>
</template>

<script>
export default {
  name: "BoardToggles",
  computed: {
    board3D: {
      get() {
        return this.$store.state.board3D;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["board3D", value]);
      }
    }
  }
};
</script>

<style lang="stylus"></style>
