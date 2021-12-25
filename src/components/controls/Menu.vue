<template>
  <q-fab
    color="primary"
    :text-color="fg"
    :icon="short ? 'menu_horizontal' : 'menu_vertical'"
    :direction="short ? 'left' : 'up'"
    v-bind="$attrs"
    v-on="$listeners"
  >
    <q-fab-action
      v-for="item in items"
      :key="item.icon"
      :icon="item.icon"
      @click="$emit('input', item.action)"
      color="primary"
      :text-color="fg"
    >
      <hint>{{ item.label }}</hint>
    </q-fab-action>
  </q-fab>
</template>

<script>
export default {
  name: "Menu",
  data() {
    return {
      items: [
        {
          icon: "add",
          label: this.$t("New Game"),
          action: "add",
        },
        {
          icon: "share",
          label: this.$t("Share"),
          action: "share",
        },
        {
          icon: "settings",
          label: this.$t("Preferences"),
          action: "settings",
        },
        {
          icon: "account",
          label: this.$t("Account"),
          action: "account",
        },
        {
          icon: "help",
          label: this.$t("Help"),
          action: "help",
        },
      ],
    };
  },
  computed: {
    short() {
      return this.$q.screen.height <= 440;
    },
    fg() {
      return this.$store.state.ui.theme.primaryDark ? "textLight" : "textDark";
    },
  },
};
</script>
