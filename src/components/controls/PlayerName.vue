<template>
  <smooth-reflow class="column no-wrap">
    <template v-if="isPrivate || isLoggedIn">
      <q-input
        :value="isPrivate ? playerName : username"
        @input="playerName = $event"
        :label="$t('Player Name')"
        :rules="[validateName]"
        :hint="$t('hint.playerName' + (isPrivate ? 'Private' : 'Public'))"
        @keydown.enter.prevent="create"
        :readonly="!isPrivate"
        color="accent"
        filled
      >
        <template v-slot:prepend>
          <q-icon :name="$store.getters.playerIcon(player)" />
        </template>
        <template v-slot:append v-if="!isPrivate && isLoggedIn">
          <q-btn
            @click="logOut"
            :label="$t('Log Out')"
            :loading="loading"
            color="accent"
            dense
            flat
          />
        </template>
      </q-input>
    </template>

    <template v-else>
      <q-btn
        :to="{ name: 'login' }"
        :label="$t('Log In')"
        color="accent"
        text-color="grey-10"
        icon="account"
        style="height: 3.5em"
        v-ripple
        rounded
      />
    </template>
  </smooth-reflow>
</template>

<script>
import { formats } from "../../PTN/Tag";

export default {
  name: "PlayerName",
  props: {
    value: String,
    "is-private": Boolean,
    player: [Number, String]
  },
  data() {
    return {
      isValid: false,
      loading: false
    };
  },
  computed: {
    playerName: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit("input", value);
      }
    },
    user() {
      return this.$store.state.online.user;
    },
    isLoggedIn() {
      return this.user && !this.user.isAnonymous;
    },
    username() {
      return this.$store.getters["online/playerName"]();
    }
  },
  methods: {
    logOut() {
      this.loading = true;
      this.$store
        .dispatch("online/LOG_OUT")
        .then(() => {
          this.loading = false;
        })
        .catch(error => {
          this.loading = false;
          console.error(error);
        });
    },
    validateName(value) {
      return (
        formats.player1.test(value.trim()) ||
        this.$t("error['Invalid player name']")
      );
    },
    validate(value = this.value) {
      if (this.isPrivate) {
        this.isValid = this.validateName(value) === true;
      } else {
        this.isValid = this.isLoggedIn;
      }
    }
  },
  watch: {
    isLoggedIn(isLoggedIn) {
      if (isLoggedIn) {
        if (!this.playerName) {
          this.playerName = this.username;
        }
      }
      this.validate();
    },
    isPrivate() {
      this.validate();
    },
    playerName(value) {
      this.validate(value);
    },
    isValid(isValid) {
      this.$emit("validate", isValid);
    }
  },
  mounted() {
    this.validate();
  }
};
</script>
