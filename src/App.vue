<template>
  <div id="q-app" class="absolute-fit no-scroll">
    <router-view />
  </div>
</template>

<script>
const icons = {
  "app:qrcode": "img:/statics/icons/qrcode.svg"
};

export default {
  name: "App",
  created() {
    this.$q.iconMapFn = name => {
      const icon = icons[name];
      if (icon !== undefined) {
        return { icon };
      }
    };

    if (process.env.DEV) {
      window.app = this;
    }
  }
};
</script>
