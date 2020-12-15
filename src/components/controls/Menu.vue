<template>
  <q-fab
    color="accent"
    text-color="grey-10"
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
      color="accent"
      text-color="grey-10"
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
  },
};
</script>
