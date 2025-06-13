<template>
  <Notifications v-if="show" :notifications="notifications" />
</template>

<script>
import Notifications from "../general/Notifications";

export default {
  name: "ErrorNotifications",
  components: { Notifications },
  props: ["errors"],
  data() {
    return {
      show: this.errors.length > 0,
    };
  },
  computed: {
    notifications() {
      const errors = [...this.errors];
      if (this.currentError) {
        errors.push(this.currentError);
      }
      return errors.map((message) => ({
        message,
        color: "negative",
        icon: "error",
        textColor: "textLight",
        position: "bottom",
      }));
    },
    currentError() {
      return this.$store.state.game.error;
    },
  },
  watch: {
    notifications(errors) {
      this.show = errors.length > 0;
    },
  },
};
</script>
