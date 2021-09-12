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
    if (process.env.DEV) {
      window.app = this;
    }

    // Map icons
    this.$q.iconMapFn = (name) => {
      const icon = ICONS[name];
      if (icon !== undefined) {
        return { icon };
      }
    };

    // Load theme
    this.$store.dispatch("ui/SET_THEME", this.$store.state.ui.themeID);
  },
};
</script>
