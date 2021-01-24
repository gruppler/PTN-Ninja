<template>
  <Notifications v-if="show" :notifications="notifications" />
</template>

<script>
import Notifications from "../general/Notifications";

export default {
  name: "ErrorNotifications",
  components: { Notifications },
  props: ["errors"],
  computed: {
    show() {
      return this.errors && this.errors.length;
    },
    notifications() {
      return this.errors.map((message) => ({
        message,
        color: "negative",
        icon: "error",
        textColor: "textLight",
      }));
    },
  },
};
</script>
