<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    content-class="non-selectable"
    v-bind="$attrs"
  >
    <q-card style="width: 400px" class="bg-secondary">
      <q-tabs v-model="tab" active-color="accent" indicator-color="accent">
        <q-tab name="login" :label="$t('Log In')" />
        <q-tab name="register" :label="$t('Register')" />
      </q-tabs>

      <q-separator />

      <q-card-section class="column no-wrap">
        <SmoothReflow>
          <q-input
            v-show="tab === 'register'"
            v-model="playerName"
            ref="playerName"
            key="playerName"
            class="q-mb-md"
            :label="$t('Player Name')"
            :rules="[validateNameFormat, validateNameUniqueness]"
            :hint="$t('hints.playerNamePublic')"
            @keydown.enter.prevent="submit"
            color="accent"
            filled
          />
        </SmoothReflow>

        <div class="q-gutter-y-md">
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
          />
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
            color="accent"
            hide-bottom-space
            filled
          >
            <template v-slot:append>
              <q-icon
                :name="showPassword ? 'visibility' : 'visibility_off'"
                @click="showPassword = !showPassword"
                class="cursor-pointer"
              />
            </template>
          </q-input>
        </div>

        <SmoothReflow>
          <div v-show="error" class="q-mt-md text-negative">
            {{ error }}
          </div>
          <div v-show="success" class="q-mt-md text-positive">
            {{ success }}
          </div>
        </SmoothReflow>
      </q-card-section>

      <q-separator />

      <q-card-actions class="row items-center justify-end q-gutter-sm">
        <q-btn
          v-show="tab === 'login'"
          @click="resetPassword()"
          :label="$t('Reset Password')"
          :disable="!email.trim().length"
          flat
        />
        <div class="col-grow" />
        <q-btn v-close-popup :label="$t('Cancel')" color="accent" flat />
        <q-btn
          v-show="tab === 'login'"
          @click="submit"
          :label="$t('Log In')"
          :disable="!validateLogIn()"
          color="accent"
          flat
        />
        <q-btn
          v-show="tab === 'register'"
          @click="submit"
          :label="$t('Register')"
          :disable="!validateRegister()"
          color="accent"
          flat
        />
      </q-card-actions>

      <q-inner-loading :showing="loading" />
    </q-card>
  </q-dialog>
</template>

<script>
import { formats } from "../../PTN/Tag";

const MIN_NAME_LENGTH = 3;

export default {
  name: "LogIn",
  props: ["value"],
  data() {
    return {
      error: "",
      success: "",
      email: "",
      password: "",
      playerName: "",
      loading: false,
      showPassword: false
    };
  },
  computed: {
    tab: {
      get() {
        return this.$route.params.tab || "login";
      },
      set(tab) {
        this.$router.replace({ params: { tab } });
      }
    },
    user() {
      return this.$store.state.online.user;
    },
    userEmail() {
      return this.user ? this.user.email : "";
    },
    displayName() {
      return this.$store.getters["online/playerName"](this.isPrivate);
    }
  },
  methods: {
    close() {
      this.$emit("input", false);
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
        .then(success => success || this.$t("error['Player exists']"));
    },
    showError(error) {
      const errorMessages = this.$i18n.messages[this.$i18n.locale].error;
      if (error) {
        console.log(error);
        if (typeof error === "string") {
          if (error in errorMessages) {
            this.error = this.$t(`error["${error}"]`);
          } else {
            this.error = error;
          }
        } else if ("code" in error && error.code in errorMessages) {
          this.error = this.$t(`error["${error.code}"]`);
        } else if ("message" in error) {
          if (error.message in errorMessages) {
            this.error = this.$t(`error["${error.message}"]`);
          } else {
            this.error = error.message;
          }
        }
      } else {
        this.error = "";
      }
    },
    showSuccess(message) {
      this.error = "";
      this.success = message || "";
    },
    register() {
      if (!this.validateRegister()) {
        return;
      }
      this.loading = true;
      this.$store
        .dispatch("online/REGISTER", {
          email: this.email,
          password: this.password,
          name: this.playerName.trim()
        })
        .then(() => {
          this.loading = false;
          this.playerName = "";
          this.email = "";
          this.password = "";
          this.close();
        })
        .catch(error => {
          this.loading = false;
          this.showError(error);
        });
    },
    logIn() {
      if (!this.validateLogIn()) {
        return;
      }

      const logIn = () => {
        this.loading = true;
        this.$store
          .dispatch("online/LOG_IN", {
            email: this.email,
            password: this.password
          })
          .then(() => {
            this.close();
            this.loading = false;
            this.email = "";
            this.password = "";
          })
          .catch(error => {
            this.loading = false;
            this.showError(error);
          });
      };

      if (this.$store.state.online.user.privateGames.length) {
        this.$store.getters.confirm({
          title: this.$t("confirm.logInTitle"),
          message: this.$t("confirm.logInMessage"),
          ok: this.$t("confirm.logInOK"),
          cancel: this.$t("Cancel"),
          success: logIn
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
        this.$store.getters.confirm({
          title: this.$t("Confirm"),
          message: this.$t("confirm.resetPassword", { email: this.email }),
          success: () => {
            this.loading = true;
            this.$store
              .dispatch("online/RESET_PASSWORD", this.email)
              .then(() => {
                this.loading = false;
                this.showSuccess(this.$t("confirm.resetPasswordSent"));
              })
              .catch(error => {
                this.loading = false;
                this.showError(error);
              });
          }
        });
      }
    },
    submit() {
      if (this.tab === "register") {
        this.register();
      } else {
        this.logIn();
      }
    }
  },
  mounted() {
    if (this.displayName) {
      this.playerName = this.displayName;
    }
  },
  watch: {
    tab() {
      this.showError();
      this.showSuccess();
    }
  }
};
</script>
