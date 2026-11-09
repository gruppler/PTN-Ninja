<template>
  <q-list>
    <q-item :to="{ name: signedIn ? 'account' : 'login' }" clickable v-ripple>
      <q-item-section avatar>
        <q-icon name="account" />
      </q-item-section>
      <q-item-section>
        <q-item-label>
          {{ signedIn ? name : $t("settings.notSignedIn") }}
        </q-item-label>
        <q-item-label caption>
          {{ signedIn ? $t("Account") : $t("Log In") }}
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-icon name="forward" />
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script>
export default {
  name: "SettingsAccount",
  computed: {
    user() {
      return this.$store.state.online.user;
    },
    name() {
      return this.user.displayName || this.user.email || this.$t("Account");
    },
    signedIn() {
      return Boolean(this.user && !this.user.isAnonymous);
    },
  },
};
</script>
