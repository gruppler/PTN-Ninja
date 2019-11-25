<template>
  <component :is="tag">
    <slot />
  </component>
</template>

<script>
import { defaults } from "lodash";
import smoothReflow from "vue-smooth-reflow";
export default {
  name: "SmoothReflow",
  mixins: [smoothReflow],
  props: {
    tag: {
      type: String,
      default: "div"
    },
    options: Object
  },
  mounted() {
    this.$smoothReflow(
      defaults(this.options, {
        transition: ".3s cubic-bezier(.25, .8, .5, 1)"
      })
    );
  }
};
</script>
