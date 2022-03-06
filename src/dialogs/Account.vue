<template>
  <small-dialog ref="dialog" :value="true" v-bind="$attrs">
    <template v-slot:header>
      <dialog-header>
        <template v-slot:icon>
          <PlayerAvatar :value="username" />
        </template>
        {{ $t("Account") }}
      </dialog-header>
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
          :label="$t('New Password')"
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
            :loading="verifying"
            color="primary"
            class="full-width q-mb-md text-textDark"
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
          :loading="loggingOut"
          color="primary"
          flat
        />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          @click="submit"
          :label="$t('OK')"
          :loading="submitting"
          color="primary"
          flat
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import PlayerAvatar from "../components/general/PlayerAvatar";

export default {
  name: "Account",
  components: { PlayerAvatar },
  data() {
    return {
      loggingOut: false,
      verifying: false,
      submitting: false,
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
      this.$refs.dialog.hide();
    },
    async logOut() {
      this.loggingOut = true;
      try {
        await this.$store.dispatch("online/LOG_OUT");
        this.loggingOut = false;
      } catch (error) {
        this.error = error;
        console.error(error);
      }
      this.loggingOut = false;
    },
    verify() {
      this.verifying = true;
      this.$store
        .dispatch("online/VERIFY")
        .then(() => {
          this.verifying = false;
          this.success = "verifyEmailSent";
        })
        .catch((error) => {
          this.verifying = false;
          this.error = error;
        });
    },
    submit() {
      if (this.email !== this.user.email || this.password) {
        this.submitting = true;
        this.$store
          .dispatch("online/UPDATE_ACCOUNT", {
            email: this.email,
            password: this.password,
          })
          .then(() => {
            this.submitting = false;
            this.close();
          })
          .catch((error) => {
            this.submitting = false;
            this.error = error;
            console.error(error);
          });
      } else {
        this.close();
      }
    },
  },
  watch: {
    user(user) {
      if (user && user.isAnonymous) {
        return this.$router.replace({ name: "login" });
      }
      this.email = user ? user.email : "";
    },
  },
  mounted() {
    this.email = this.user ? this.user.email : "";
    this.password = "";
    this.error = "";
    this.success = "";
    this.loggingOut = false;
    this.verifying = false;
    this.submitting = false;
  },
};
</script>
