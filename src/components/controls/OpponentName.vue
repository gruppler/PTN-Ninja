<template>
  <q-input
    v-bind="$attrs"
    v-on="$listeners"
    v-model="playerName"
    :label="$t('Opponent Name')"
    :rules="[validateName]"
    :hint="$t('hint.optional')"
    :loading="loading"
    filled
  >
    <template v-slot:prepend>
      <PlayerAvatar
        v-if="!isPrivate && playerName"
        :value="playerName"
        size="sm"
      />
      <q-icon
        v-else
        :name="$store.getters['ui/playerIcon'](player, isPrivate)"
      />
    </template>
  </q-input>
</template>

<script>
import PlayerAvatar from "../general/PlayerAvatar";

import { formats } from "../../Game/PTN/Tag";

export default {
  name: "OpponentName",
  components: { PlayerAvatar },
  props: {
    value: String,
    isPrivate: Boolean,
    player: [Number, String],
  },
  data() {
    return {
      isValid: false,
      loading: false,
    };
  },
  computed: {
    playerName: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit("input", value);
      },
    },
    user() {
      return this.$store.state.online.user;
    },
    isLoggedIn() {
      return this.user && !this.user.isAnonymous;
    },
  },
  methods: {
    validateName(value) {
      return (
        !value ||
        formats.player1.test(value.trim()) ||
        this.$t("error['Invalid player name']")
      );
    },
    async validate(value = this.value) {
      if (this.validateName(value) !== true) {
        this.isValid = false;
      } else if (value && !this.isPrivate) {
        try {
          this.loading = true;
          this.isValid = await this.$store.dispatch(
            "online/USER_EXISTS",
            value.trim()
          );
        } catch (error) {
          console.error(error);
        } finally {
          this.loading = false;
        }
      } else {
        this.isValid = true;
      }
    },
  },
  watch: {
    isPrivate() {
      this.validate();
    },
    playerName(value) {
      this.validate(value);
    },
    isValid(isValid) {
      this.$emit("validate", isValid);
    },
  },
  mounted() {
    this.validate();
  },
};
</script>
