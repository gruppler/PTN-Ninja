<template>
  <q-dialog
    @input="$emit('input', $event)"
    :value="value"
    :maximized="maximized"
    v-bind="$attrs"
  >
    <q-layout
      view="hhh lpr fff"
      class="bg-secondary"
      :style="{ width, height }"
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
const WIDTH = 500;
const HEIGHT = 565;

export default {
  name: "LargeDialog",
  props: ["value"],
  data() {
    return {
      width: WIDTH + "px"
    };
  },
  computed: {
    maximized() {
      return window.innerWidth < WIDTH;
    },
    height() {
      return this.maximized ? "100%" : HEIGHT + "px";
    }
  }
};
</script>
