<template>
  <q-dialog
    @input="$emit('input', $event)"
    :value="value"
    :maximized="maximized"
    v-on="$listeners"
    v-bind="$attrs"
  >
    <q-layout
      view="hhh lpr fff"
      class="bg-secondary"
      :style="{ height }"
      container
    >
      <q-header class="bg-secondary" elevated>
        <slot name="header" />
      </q-header>

      <q-footer class="bg-secondary" elevated>
        <slot name="footer" />
      </q-footer>

      <q-page-container class="fit">
        <slot />
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script>
const HEIGHT = 700;

export default {
  name: "LargeDialog",
  props: ["value", "min-height"],
  computed: {
    maximized() {
      return this.$q.screen.lt.sm;
    },
    height() {
      return this.maximized ? "100%" : (this.minHeight || HEIGHT) + "px";
    }
  }
};
</script>
