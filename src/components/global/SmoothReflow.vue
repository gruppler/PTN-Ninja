<template>
  <component v-bind="$attrs" v-on="$listeners" :is="tag">
    <slot />
  </component>
</template>

<script>
import smoothReflow from "vue-smooth-reflow";
import { defaults } from "lodash";

export default {
  name: "smooth-reflow",
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
