<template>
  <large-dialog
    :value="true"
    no-backdrop-dismiss
    :min-height="showAll ? 750 : 495"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="edit">{{ $t("Edit Game") }}</dialog-header>
    </template>

    <q-card-section>
      <GameInfo
        ref="gameInfo"
        :game="$game"
        :show-all="showAll"
        @submit="save"
      />
    </q-card-section>

    <template v-slot:footer>
      <q-separator />

      <message-output :error="error" />

      <q-card-actions align="right">
        <MoreToggle v-model="showAll" />
        <q-btn :label="$t('Reset')" @click="reset" flat />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          @click="$refs.gameInfo.submit()"
          :loading="loading"
          :disabled="$refs.gameInfo && $refs.gameInfo.hasError"
          color="primary"
          flat
        />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import GameInfo from "../components/controls/GameInfo";
import MoreToggle from "../components/controls/MoreToggle.vue";

export default {
  name: "EditGame",
  components: { GameInfo, MoreToggle },
  data() {
    return {
      loading: false,
      error: "",
      showAll: false,
    };
  },
  methods: {
    reset() {
      this.$store.dispatch("ui/PROMPT", {
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetForm"),
        success: () => {
          this.$refs.gameInfo.init();
        },
      });
    },
    close() {
      this.$router.back();
    },
    async save({ name, tags }) {
      this.$store.dispatch("game/RENAME_CURRENT_GAME", name);

      let changedTags = {};
      Object.keys(tags).forEach((key) => {
        const value = tags[key];
        if (value !== this.$game.tag(key)) {
          changedTags[key] = value;
        }
      });
      if (Object.keys(changedTags).length) {
        this.$store.dispatch("game/SET_TAGS", changedTags);
      }

      if (this.$game.config.id) {
        this.loading = true;
        try {
          await this.$store.dispatch("online/UPDATE_GAME", this.$game.json);
          this.loading = false;
        } catch (error) {
          this.loading = false;
          this.error = error;
        }
      }
      this.showAll = false;
      this.close();
    },
  },
};
</script>
