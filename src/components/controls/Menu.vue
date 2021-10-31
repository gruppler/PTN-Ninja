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
    />
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
          action: "add",
        },
        {
          icon: "share",
          action: "share",
        },
        {
          icon: "settings",
          action: "settings",
        },
        // {
        //   icon: "account",
        //   action: "account",
        // },
        {
          icon: "help",
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
