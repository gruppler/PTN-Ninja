<template>
  <q-btn
    class="fullscreen-toggle"
    v-if="$q.fullscreen.isCapable"
    @click="$q.fullscreen.toggle()"
    :icon="$q.fullscreen.isActive ? 'fullscreen_exit' : 'fullscreen'"
    flat
    dense
    v-bind="$attrs"
  />
</template>

<script>
export default {
  name: "FullscreenToggle"
};
</script>

<style lang="stylus">
.fullscreen-toggle
  opacity .25
  &:hover
    opacity 1
</style>
