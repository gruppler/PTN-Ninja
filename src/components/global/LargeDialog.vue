<template>
  <q-dialog
    :content-class="classes"
    :content-style="contentStyle"
    :value="model"
    :maximized="maximized"
    @hide="hide"
    v-on="$listeners"
    v-bind="$attrs"
  >
    <q-layout view="hHh lpr fFf" class="bg-ui" :style="layoutStyle" container>
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
import { isArray, isObject } from "lodash";

const HEIGHT = 700;

export default {
  name: "large-dialog",
  props: {
    value: Boolean,
    goBack: Boolean,
    fullscreen: Boolean,
    minHeight: Number,
    width: [Number, String],
    noMaximize: Boolean,
    contentClass: [String, Array, Object],
  },
  computed: {
    model() {
      return this.value;
    },
    resolvedWidth() {
      if (this.width === null || this.width === undefined) {
        return null;
      }

      if (typeof this.width === "number") {
        return `${this.width}px`;
      }

      const width = String(this.width).trim();
      return width || null;
    },
    hasExplicitWidth() {
      return !!this.resolvedWidth;
    },
    maximized() {
      if (this.fullscreen) {
        return true;
      }
      if (this.noMaximize) {
        return false;
      }
      if (this.hasExplicitWidth) {
        return this.$q.screen.lt.sm;
      }

      return (
        this.$q.screen.lt.sm ||
        (this.$q.screen.width <= this.$q.screen.sizes.md &&
          this.$q.screen.height <= this.$q.screen.sizes.sm)
      );
    },
    height() {
      return this.maximized ? "100%" : (this.minHeight || HEIGHT) + "px";
    },
    widthStyle() {
      if (this.maximized || !this.resolvedWidth) {
        return null;
      }

      return this.resolvedWidth;
    },
    contentStyle() {
      const style = {};
      if (this.widthStyle) {
        style.width = this.widthStyle;
        style.maxWidth = "99vw";
      }
      return Object.keys(style).length ? style : null;
    },
    layoutStyle() {
      const style = {
        height: this.height,
      };

      if (this.widthStyle) {
        style.width = this.widthStyle;
        style.maxWidth = "99vw";
      }

      return style;
    },
    classes() {
      let classes = ["large-dialog", "non-selectable"];
      if (this.maximized) {
        classes.push("maximized");
      }
      if (this.contentClass) {
        if (isObject(this.contentClass)) {
          let classObject = { ...this.contentClass };
          classes.forEach((className) => {
            classObject[className] = true;
          });
          classes = classObject;
        } else if (isArray(this.contentClass)) {
          classes.push(...this.contentClass);
        } else {
          classes.push(this.contentClass);
        }
      }
      return classes;
    },
  },
  methods: {
    hide() {
      if (this.goBack) {
        this.$router.back();
      }
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
