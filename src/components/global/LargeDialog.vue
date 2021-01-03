<template>
  <q-dialog
    :content-class="classes"
    :value.sync="value"
    :maximized="maximized"
    @hide="hide"
    v-on="$listeners"
    v-bind="$attrs"
  >
    <q-layout view="hhh lpr fff" class="bg-ui" :style="{ height }" container>
      <q-header class="bg-accent" :reveal="$q.screen.height <= 400" elevated>
        <slot name="header" />
      </q-header>

      <q-footer class="bg-accent" elevated>
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
  name: "large-dialog",
  props: {
    value: Boolean,
    fullscreen: Boolean,
    "min-height": Number,
    "no-maximize": Boolean,
    "content-class": String,
  },
  computed: {
    maximized() {
      return (
        this.fullscreen ||
        (!this.noMaximize &&
          (this.$q.screen.lt.sm ||
            (this.$q.screen.width <= this.$q.screen.sizes.md &&
              this.$q.screen.height <= this.$q.screen.sizes.sm)))
      );
    },
    height() {
      return this.maximized ? "100%" : (this.minHeight || HEIGHT) + "px";
    },
    classes() {
      let classes = ["large-dialog", "non-selectable", this.contentClass];
      if (this.maximized) {
        classes.push("maximized");
      }
      return classes;
    },
  },
  methods: {
    hide() {
      this.$router.back();
    },
  },
};
</script>

<style lang="scss">
.large-dialog {
  .q-layout-container {
    transition: height $generic-hover-transition;
  }
}
</style>
