<template>
  <component
    v-bind="$attrs"
    v-on="$listeners"
    :is="tag"
    class="relative-position"
  >
    <slot />
    <div class="absolute-fit inset-shadow no-pointer-events" />
  </component>
</template>

<script>
export default {
  name: "recess",
  props: {
    tag: {
      type: String,
      default: "div"
    }
  }
};
</script>
