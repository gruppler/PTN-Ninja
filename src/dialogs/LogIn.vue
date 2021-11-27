<template>
  <small-dialog ref="dialog" :value="true" content-class="non-selectable" v-bind="$attrs">
    <template v-slot:header>
      <q-tabs
        v-model="tab"
        active-color="primary"
        indicator-color="primary"
        align="justify"
      >
        <q-tab name="login" :label="$t('Log In')" />
        <q-tab name="register" :label="$t('Register')" />
      </q-tabs>
    </template>

    <q-card>
      <q-card-section class="column no-wrap">
        <smooth-reflow>
          <q-input
            v-show="tab === 'register'"
            v-model="playerName"
            ref="playerName"
            key="playerName"
            class="q-mb-md"
            :label="$t('Player Name')"
            :rules="[validateNameFormat, validateNameUniqueness]"
            :hint="$t('hint.playerNamePublic')"
            @keydown.enter.prevent="submit"
            filled
          >
            <template v-slot:prepend>
              <q-icon name="account" />
            </template>
          </q-input>
        </smooth-reflow>

        <div class="q-gutter-y-md">
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
            :autocomplete="
              (tab === 'register' ? 'new' : 'current') + '-password'
            "
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
        </div>

        <message-output
          :error="error"
          :warning="warning"
          :success="success"
          content-class="q-mt-md"
        />
      </q-card-section>
    </q-card>

    <template v-slot:footer>
      <q-separator />

      <q-card-actions align="right">
        <q-btn
          v-show="tab === 'login'"
          @click="resetPassword()"
          :label="$t('Reset Password')"
          :loading="resetting"
          :disable="!email.trim().length"
          flat
        />
        <div class="col-grow" />
        <q-btn v-close-popup :label="$t('Cancel')" color="primary" flat />
        <q-btn
          v-show="tab === 'login'"
          @click="submit"
          :label="$t('Log In')"
          :loading="submitting"
          :disable="!validateLogIn()"
          color="primary"
          flat
        />
        <q-btn
          v-show="tab === 'register'"
          @click="submit"
          :label="$t('Register')"
          :loading="submitting"
          :disable="!validateRegister()"
          color="primary"
          flat
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import { formats } from "../Game/PTN/Tag";

const MIN_NAME_LENGTH = 3;

export default {
  name: "LogIn",
  data() {
    return {
      error: "",
      success: "",
      email: "",
      password: "",
      playerName: "",
      resetting: false,
      submitting: false,
      showPassword: false,
    };
  },
  computed: {
    tab: {
      get() {
        return this.$route.params.tab || "login";
      },
      set(tab) {
        this.$router.replace({
          params: { tab: tab === "login" ? undefined : tab },
        });
      },
    },
    user() {
      return this.$store.state.online.user;
    },
    userEmail() {
      return this.user ? this.user.email : "";
    },
    warning() {
      if (
        this.tab === "login" &&
        this.user &&
        this.user.isAnonymous &&
        Object.values(this.$store.state.online.privateGames).length
      ) {
        return this.$t("warning.logIn");
      }
      return "";
    },
  },
  methods: {
    close() {
      this.$refs.dialog.hide();
    },
    hasErrors() {
      return this.$refs.playerName && this.$refs.playerName.innerError;
    },
    validateLogIn() {
      return this.email.trim().length && this.password.length;
    },
    validateRegister() {
      return (
        !this.hasErrors() &&
        this.validateNameFormat(this.playerName) === true &&
        this.email.trim().length &&
        this.password.length
      );
    },
    validateNameFormat(value) {
      value = value.trim();
      return (
        (value.length >= MIN_NAME_LENGTH && formats.player1.test(value)) ||
        this.$t("error['Invalid player name']")
      );
    },
    validateNameUniqueness(value) {
      return this.$store
        .dispatch("online/CHECK_USERNAME", value.trim())
        .then((success) => success || this.$t("error['Player exists']"));
    },
    showError(error) {
      this.error = error;
    },
    showSuccess(message) {
      this.error = "";
      this.success = message || "";
    },
    async register() {
      if (!this.validateRegister()) {
        return;
      }
      this.submitting = true;
      try {
        await this.$store.dispatch("online/REGISTER", {
          email: this.email,
          password: this.password,
          name: this.playerName.trim(),
        });
        this.playerName = "";
        this.email = "";
        this.password = "";
        this.$router.replace({ name: "account" });
      } catch (error) {
        this.showError(error);
      }
      this.submitting = false;
    },
    logIn() {
      if (!this.validateLogIn()) {
        return;
      }

      const logIn = async () => {
        this.showError();
        this.submitting = true;
        try {
          await this.$store.dispatch("online/LOG_IN", {
            email: this.email,
            password: this.password,
          });
          this.email = "";
          this.password = "";
          this.$router.replace({ name: "account" });
        } catch (error) {
          this.showError(error);
        }
        this.submitting = false;
      };

      if (Object.values(this.$store.state.online.privateGames).length) {
        this.$store.dispatch("ui/PROMPT", {
          title: this.$t("confirm.logInTitle"),
          message: this.$t("confirm.logInMessage"),
          ok: this.$t("confirm.logInOK"),
          cancel: this.$t("Cancel"),
          success: logIn,
        });
      } else {
        logIn();
      }
    },
    logOut() {
      this.$store.dispatch("online/LOG_OUT");
    },
    resetPassword() {
      if (this.email.trim().length) {
        this.$store.dispatch("ui/PROMPT", {
          title: this.$t("Confirm"),
          message: this.$t("confirm.resetPassword", { email: this.email }),
          success: () => {
            this.resetting = true;
            this.$store
              .dispatch("online/RESET_PASSWORD", this.email)
              .then(() => {
                this.resetting = false;
                this.showSuccess("resetPasswordSent");
              })
              .catch((error) => {
                this.resetting = false;
                this.showError(error);
              });
          },
        });
      }
    },
    submit() {
      if (this.tab === "register") {
        this.register();
      } else {
        this.logIn();
      }
    },
  },
  watch: {
    tab() {
      this.showError();
      this.showSuccess();
    },
  },
  mounted() {
    if (this.user && !this.user.isAnonymous) {
      return this.$router.replace({ name: "account" });
    }
  },
};
</script>
