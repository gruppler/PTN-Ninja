<template>
  <component :is="tag">
    <slot />
  </component>
</template>

<script>
import smoothReflow from "vue-smooth-reflow";
import { defaults } from "lodash";

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
