<template>
  <q-btn
    :style="{
      background: $attrs.flat !== undefined ? '' : color,
      color: $attrs.flat !== undefined ? color : iconColor,
    }"
    :icon="icon"
    v-bind="$attrs"
  >
    <q-menu
      ref="popup"
      transition-show="none"
      transition-hide="none"
      v-on="popupListeners"
      v-bind="$attrs"
      @show="show"
    >
      <div class="color-picker bg-accent">
        <q-item
          v-if="label"
          class="label bg-accent"
          v-touch-pan.prevent.mouse="move"
          style="cursor: move"
        >
          <q-item-section class="fg-inherit" side>
            <q-icon name="color" />
          </q-item-section>
          <q-item-section header>
            <q-item-label class="text-subtitle1">{{ label }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-color
          :value="color"
          @input="color = $event"
          no-header-tabs
          v-bind="$attrs"
          v-on="$listeners"
        />
      </div>
    </q-menu>

    <slot />
  </q-btn>
</template>

<script>
import { isFunction, omit } from "lodash";
import { isDark } from "src/themes";

export default {
  name: "ColorPicker",
  props: ["value", "label", "icon"],
  data() {
    return {
      position: {},
      initialPosition: null,
      $menu: null,
    };
  },
  computed: {
    color: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit("input", value);
      },
    },
    iconColor() {
      const themeColors = this.$store.state.ui.theme.colors;
      return isDark(this.color) ? themeColors.textLight : themeColors.textDark;
    },
    popupListeners() {
      return omit(this.$listeners, "input");
    },
  },
  methods: {
    show() {
      this.$menu = this.$refs.popup.$children[0].$el;
      this.position = {
        left: parseInt(this.$menu.style.left),
        top: parseInt(this.$menu.style.top),
      };
      if (isFunction(this.$listeners.show)) {
        this.show(...arguments);
      }
    },
    move(event) {
      if (event.isFirst) {
        this.initialPosition = { ...this.position };
      }
      this.position.left = this.initialPosition.left + event.offset.x;
      this.position.top = this.initialPosition.top + event.offset.y;
      this.$menu.style.left = this.position.left + "px";
      this.$menu.style.top = this.position.top + "px";
      if (event.isFinal) {
        this.initialPosition = null;
      }
    },
  },
};
</script>

<style lang="scss">
.color-picker {
  position: relative;
  .label {
    cursor: move;
    position: sticky;
    top: 0;
    z-index: 1;
  }
}
</style>
