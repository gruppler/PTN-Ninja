<template>
  <q-dialog :value="value" @input="$emit('input', $event)" v-bind="$attrs">
    <q-card style="width: 300px" class="bg-secondary">
      <dialog-header>{{ $t("Account") }}</dialog-header>

      <q-separator />

      <q-card-section>
        <div class="q-gutter-y-md">
          <q-input
            v-model="username"
            :label="$t('Player Name')"
            color="accent"
            readonly
            filled
          >
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
            color="accent"
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
            color="accent"
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
        </div>

        <smooth-reflow>
          <q-btn
            v-if="user && !user.emailVerified"
            @click="verify"
            :label="$t('Verify Email Address')"
            icon="email"
            :loading="loadingVerify"
            color="accent"
            class="full-width q-mt-md"
            flat
          />
        </smooth-reflow>

        <message-output
          :error="error"
          :success="success"
          content-class="q-mt-md"
        />
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn
          @click="logOut"
          :label="$t('Log Out')"
          :loading="loadingLogOut"
          color="accent"
          flat
        />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
        <q-btn
          @click="submit"
          :label="$t('OK')"
          :loading="loadingSubmit"
          color="accent"
          flat
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
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
    logOut() {
      this.loadingLogOut = true;
      this.$store
        .dispatch("online/LOG_OUT")
        .then(() => {
          this.loadingLogOut = false;
          this.close();
        })
        .catch((error) => {
          this.loadingLogOut = false;
          this.error = error;
          console.error(error);
        });
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
