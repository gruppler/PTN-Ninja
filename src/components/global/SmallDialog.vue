<template>
  <q-dialog
    ref="dialog"
    :content-class="['small-dialog', 'non-selectable', $attrs['content-class']]"
    :value="model"
    :maximized="maximized"
    @before-show="resetMove"
    @hide="hide"
    v-on="$listeners"
    v-bind="$attrs"
  >
    <div
      ref="content"
      class="dialog-content column no-wrap bg-ui"
      :class="{ 'dialog-moving': isMoving }"
      :style="moveStyle"
    >
      <header
        class="bg-accent"
        :class="{ 'dialog-handle': isMovable }"
        @pointerdown="moveHandle"
      >
        <slot name="header" />
      </header>

      <slot />

      <footer class="bg-accent">
        <slot name="footer" />
      </footer>
    </div>
  </q-dialog>
</template>

<script>
import movableDialog from "./movableDialog";
import maximizableDialog from "./maximizableDialog";

export default {
  name: "small-dialog",
  mixins: [movableDialog, maximizableDialog],
  props: {
    value: Boolean,
    goBack: Boolean,
    noMaximize: Boolean,
  },
  computed: {
    model() {
      return this.value;
    },
    autoMaximized() {
      return (
        !this.noMaximize &&
        (this.$q.screen.width < this.$q.screen.height
          ? this.$q.screen.height <= this.$q.screen.sizes.sm
          : this.$q.screen.width <= this.$q.screen.sizes.xs)
      );
    },
  },
  methods: {
    moveTarget() {
      return this.$refs.content;
    },
    hide() {
      if (this.goBack) {
        this.$router.back();
      }
    },
  },
};
</script>

<style lang="scss">
.small-dialog {
  header,
  footer {
    position: sticky;
    z-index: 1;
  }
  header {
    top: 0;
    box-shadow: $shadow-3;
  }
  footer {
    bottom: -0.5px;
    box-shadow: $shadow-up-3;
  }
  .dialog-content,
  footer {
    color: $dark;
    background-color: #fff;
    body.body--dark & {
      color: #fff;
      background-color: $dark;
    }
  }
}
</style>
