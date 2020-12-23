<template>
  <small-dialog :value="value" @input="$emit('input', $event)" v-bind="$attrs">
    <template v-slot:header>
      <dialog-header icon="account">{{ $t("Account") }}</dialog-header>
    </template>

    <q-card>
      <q-card-section class="q-gutter-md q-pb-none">
        <q-input v-model="username" :label="$t('Player Name')" readonly filled>
          <template v-slot:prepend>
            <q-icon name="account" />
          </template>
        </q-input>
        <q-input
          v-model="email"
          ref="email"
          key="email"
          type="email"
          autocomplete="email"
          :label="$t('Email Address')"
          @keydown.enter.prevent="submit"
          hide-bottom-space
          filled
        >
          <template v-slot:prepend>
            <q-icon name="email" />
          </template>
        </q-input>
        <q-input
          v-model="password"
          ref="password"
          key="password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          :label="$t('Password')"
          @keydown.enter.prevent="submit"
          hide-bottom-space
          filled
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

        <smooth-reflow>
          <q-btn
            v-if="user && !user.emailVerified"
            @click="verify"
            :label="$t('Verify Email Address')"
            icon="email"
            :loading="loadingVerify"
            color="primary"
            class="full-width q-mb-md text-grey-10"
          />
        </smooth-reflow>
      </q-card-section>
    </q-card>

    <template v-slot:footer>
      <q-separator />

      <message-output
        :error="error"
        :success="success"
        content-class="q-mt-md q-mx-md"
      />

      <q-card-actions align="right">
        <q-btn
          @click="logOut"
          :label="$t('Log Out')"
          :loading="loadingLogOut"
          flat
        />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          @click="submit"
          :label="$t('OK')"
          :loading="loadingSubmit"
          color="primary"
          flat
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
export default {
  name: "Account",
  props: ["value", "player"],
  data() {
    return {
      loadingLogOut: false,
      loadingVerify: false,
      loadingSubmit: false,
      error: "",
      success: "",
      playerName: "",
      email: "",
      password: "",
      showPassword: false,
    };
  },
  computed: {
    user() {
      return this.$store.state.online.user;
    },
    username() {
      return this.user ? this.user.displayName : "";
    },
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    async logOut() {
      this.loadingLogOut = true;
      try {
        await this.$store.dispatch("online/LOG_OUT");
        this.loadingLogOut = false;
        this.$nextTick(() => {
          this.$router.replace({ name: "login" });
        });
      } catch (error) {
        this.error = error;
        console.error(error);
      }
      this.loadingLogOut = false;
    },
    verify() {
      this.loadingVerify = true;
      this.$store
        .dispatch("online/VERIFY")
        .then(() => {
          this.loadingVerify = false;
          this.success = "verifyEmailSent";
        })
        .catch((error) => {
          this.loadingVerify = false;
          this.error = error;
        });
    },
    submit() {
      if (this.email !== this.user.email || this.password) {
        this.loadingSubmit = true;
        this.$store
          .dispatch("online/UPDATE_ACCOUNT", {
            email: this.email,
            password: this.password,
          })
          .then(() => {
            this.loadingSubmit = false;
            this.close();
          })
          .catch((error) => {
            this.loadingSubmit = false;
            this.error = error;
            console.error(error);
          });
      } else {
        this.close();
      }
    },
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        if (this.user && this.user.isAnonymous) {
          return this.$router.replace({ name: "login" });
        }
        this.$store.dispatch("online/RELOAD_USER");
        this.email = this.user ? this.user.email : "";
        this.password = "";
        this.error = "";
        this.success = "";
        this.loadingLogOut = false;
        this.loadingVerify = false;
        this.loadingSubmit = false;
      }
    },
    user(user) {
      this.email = user ? user.email : "";
    },
  },
};
</script>
