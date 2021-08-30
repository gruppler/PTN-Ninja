<template>
  <small-dialog
    :value="true"
    content-class="non-selectable"
    content-style="width: 350px; max-width: 100%"
    persistent
  >
    <template v-slot:header>
      <dialog-header :icon="icon" :title="title" no-close-btn />
    </template>

    <q-card flat>
      <q-card-section class="q-gutter-y-md">
        <q-input
          v-if="email || mode === 'recoverEmail'"
          v-model="email"
          :label="$t('Email Address')"
          @keydown.enter.prevent="submit"
          autocomplete="email"
          readonly
        >
          <template v-slot:prepend>
            <q-icon name="email" />
          </template>
        </q-input>
        <q-input
          v-if="mode === 'resetPassword'"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          :label="$t('Password')"
          @keydown.enter.prevent="submit"
          autocomplete="new-password"
        >
          <template v-slot:prepend>
            <q-icon name="password" />
          </template>
          <template v-slot:append>
            <q-icon
              :name="showPassword ? 'visibility' : 'visibility_off'"
              @click="showPassword = !showPassword"
              class="q-field__focusable-action"
            />
          </template>
        </q-input>
        <message-output
          ref="errors"
          :error="error"
          :success="success"
          style="min-height: 3em"
        />
      </q-card-section>
      <q-inner-loading :showing="loading" />
    </q-card>

    <template v-if="mode === 'resetPassword'" v-slot:footer>
      <q-card-actions align="right">
        <q-btn
          @click="submit"
          :label="$t('OK')"
          :disable="submitDisabled"
          :loading="submitting"
          color="primary"
          flat
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import onlineStore from "../store/online";

export default {
  name: "PageAuth",
  data() {
    return {
      error: "",
      success: "",
      email: "",
      password: "",
      done: false,
      loading: false,
      submitting: false,
      showPassword: false,
      ...this.$route.query,
    };
  },
  computed: {
    title() {
      switch (this.mode) {
        case "resetPassword":
          return this.$t("New Password");
        case "recoverEmail":
          return this.$t("Recover Email");
        case "verifyEmail":
          return this.$t("Verify Email Address");
        default:
          return "";
      }
    },
    icon() {
      switch (this.mode) {
        case "recoverEmail":
        case "verifyEmail":
          return "email";
        default:
          return "account";
      }
    },
    submitDisabled() {
      if (this.done) {
        return true;
      }
      if (this.mode === "resetPassword") {
        return !(this.password && this.email);
      }
      return true;
    },
  },
  methods: {
    async submit() {
      if (this.mode === "resetPassword") {
        this.submitting = true;
        try {
          await this.$store.dispatch("online/SET_PASSWORD", this);
          this.success = "passwordChanged";
          this.done = true;
        } catch (error) {
          this.error = error;
        }
        this.submitting = false;
      }
    },
  },
  async mounted() {
    this.loading = true;
    if (!this.$store.state.online.user) {
      await this.$store.dispatch("online/INIT");
    }
    try {
      switch (this.mode) {
        case "resetPassword":
          this.email = await this.$store.dispatch(
            "online/VERIFY_PASSWORD_RESET_CODE",
            this.oobCode
          );
          break;
        case "recoverEmail":
          this.email = await this.$store.dispatch(
            "online/RECOVER_EMAIL",
            this.oobCode
          );
          this.success = "emailRecovered";
          break;
        case "verifyEmail":
          await this.$store.dispatch("online/VERIFY_EMAIL", this.oobCode);
          this.success = "emailVerified";
          break;
      }
    } catch (error) {
      this.error = error;
    } finally {
      this.loading = false;
    }
  },
  beforeCreate() {
    if (process.env.DEV && this.$store.state.online) {
      this.$store.unregisterModule("online");
    }
    this.$store.registerModule("online", onlineStore);
  },
};
</script>
