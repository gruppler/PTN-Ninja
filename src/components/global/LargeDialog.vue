<template>
  <q-dialog
    :content-class="classes"
    :value="model"
    :maximized="maximized"
    @before-show="beforeShow"
    @show="watchFit"
    @hide="hide"
    v-on="$listeners"
    v-bind="$attrs"
  >
    <q-layout
      ref="content"
      view="hHh lpr fFf"
      class="bg-ui"
      :class="{ 'dialog-moving': isMoving }"
      :style="[layoutStyle, moveStyle]"
      container
    >
      <q-header
        class="bg-accent"
        :class="{ 'dialog-handle': isMovable }"
        :reveal="$q.screen.height <= 400"
        @pointerdown.native="moveHandle"
        elevated
      >
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
import movableDialog from "./movableDialog";
import maximizableDialog from "./maximizableDialog";

const HEIGHT = 700;

export default {
  name: "large-dialog",
  mixins: [movableDialog, maximizableDialog],
  props: {
    value: Boolean,
    goBack: Boolean,
    fullscreen: Boolean,
    minHeight: Number,
    width: [Number, String],
    noMaximize: Boolean,
    contentClass: [String, Array, Object],
    // As tall as its header, content and footer, instead of a fixed height,
    // up to the screen's height
    fitContent: Boolean,
  },
  data() {
    return {
      // What fitContent measured, in pixels
      fitHeight: null,
    };
  },
  computed: {
    // The height when not maximized
    normalHeight() {
      return (this.fitContent && this.fitHeight) || this.minHeight || HEIGHT;
    },
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
    autoMaximized() {
      if (this.fullscreen) {
        return true;
      }
      if (this.noMaximize) {
        return false;
      }

      return (
        this.$q.screen.lt.sm ||
        (this.$q.screen.width <= this.$q.screen.sizes.md &&
          this.$q.screen.height <= this.$q.screen.sizes.sm)
      );
    },
    height() {
      return this.maximized ? "100%" : this.normalHeight + "px";
    },
    widthStyle() {
      if (this.maximized || !this.resolvedWidth) {
        return null;
      }

      return this.resolvedWidth;
    },
    contentHeight() {
      if (this.maximized) {
        return this.$q.screen.height - 116;
      }
      return this.normalHeight - 116;
    },
    layoutStyle() {
      const style = {
        height: this.height,
        "--dialog-content-height": this.contentHeight + "px",
      };

      if (this.widthStyle) {
        style.width = this.widthStyle;
        style.maxWidth = "99vw";
      } else if (this.maximized && this.resolvedWidth) {
        // Maximized, a dialog wider than the usual cap stays as wide
        style["--maximized-width"] = `max(800px, ${this.resolvedWidth})`;
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
  beforeDestroy() {
    this.unwatchFit();
  },
  methods: {
    beforeShow() {
      this.resetMove();
      // As soon as the content is rendered, so it opens at its height
      this.$nextTick(this.watchFit);
    },
    // Measure the header, footer and content whenever any of them changes
    // size. The page container is as tall as the dialog, so its children are
    // measured instead, with the room it leaves for the header and footer.
    watchFit() {
      if (
        !this.fitContent ||
        this.fitObserver ||
        typeof ResizeObserver === "undefined"
      ) {
        return;
      }
      const layout = this.$refs.content && this.$refs.content.$el;
      const page = layout && layout.querySelector(".q-page-container");
      if (!page) {
        return;
      }
      const measure = () => {
        const style = getComputedStyle(page);
        const content = [...page.children].reduce((sum, child) => {
          const childStyle = getComputedStyle(child);
          // Not getBoundingClientRect, which the opening transition scales
          return (
            sum +
            child.offsetHeight +
            (parseFloat(childStyle.marginTop) || 0) +
            (parseFloat(childStyle.marginBottom) || 0)
          );
        }, 0);
        const height = Math.ceil(
          content +
            (parseFloat(style.paddingTop) || 0) +
            (parseFloat(style.paddingBottom) || 0)
        );
        if (height > 0 && height !== this.fitHeight) {
          this.fitHeight = height;
        }
      };
      this.fitObserver = new ResizeObserver(measure);
      // The header and footer set the page container's padding
      [page, ...page.children].forEach((el) => this.fitObserver.observe(el));
      layout
        .querySelectorAll(".q-header, .q-footer")
        .forEach((el) => this.fitObserver.observe(el));
      measure();
    },
    unwatchFit() {
      if (this.fitObserver) {
        this.fitObserver.disconnect();
        this.fitObserver = null;
      }
    },
    moveTarget() {
      return this.$refs.content && this.$refs.content.$el;
    },
    hide() {
      this.unwatchFit();
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
