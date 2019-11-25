<template>
  <div class="relative-position">
    <slot />
    <div class="absolute-fit inset-shadow no-pointer-events" />
  </div>
</template>

<script>
export default {
  name: "Recess"
};
</script>

<style></style>
