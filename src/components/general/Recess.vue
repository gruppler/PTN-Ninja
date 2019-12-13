<template>
  <div class="relative-position" v-bind="$attrs" v-on="$listeners">
    <slot />
    <div class="absolute-fit inset-shadow no-pointer-events" />
  </div>
</template>

<script>
export default {
  name: "Recess"
};
</script>
