<template>
  <div id="q-app" class="absolute-fit no-scroll">
    <router-view />
  </div>
</template>

<script>
import ICONS from "./icons";

export default {
  name: "App",
  created() {
    this.$q.iconMapFn = name => {
      const icon = ICONS[name];
      if (icon !== undefined) {
        return { icon };
      }
    };
  }
};
</script>
