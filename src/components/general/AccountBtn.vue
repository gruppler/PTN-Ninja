<template>
  <q-btn :to="route" v-bind="$attrs">
    <template v-if="user && !user.isAnonymous">
      <PlayerAvatar :value="user.displayName" size="md" class="on-left" />
      <span class="ellipsis">{{ user.displayName }}</span>
    </template>
    <template v-else>
      <q-icon name="account" left />
      {{ loginText || $t("Log In") }}
    </template>
  </q-btn>
</template>

<script>
import PlayerAvatar from "./PlayerAvatar";

export default {
  name: "AccountBtn",
  components: { PlayerAvatar },
  props: ["loginText"],
  computed: {
    user() {
      return this.$store.state.online.user;
    },
    route() {
      return {
        name: this.user && !this.user.isAnonymous ? "account" : "login",
      };
    },
  },
};
</script>
