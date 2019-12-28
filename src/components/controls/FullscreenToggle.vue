<template>
  <q-btn
    v-bind="$attrs"
    v-on="$listeners"
    :icon="value ? 'fullscreen_exit' : 'fullscreen'"
    :title="$t('Fullscreen')"
    class="dimmed-btn"
    color="white"
    flat
    dense
  />
</template>

<script>
export default {
  name: "FullscreenToggle",
  props: ["value"]
};
</script>
