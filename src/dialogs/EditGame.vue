<template>
  <large-dialog
    ref="dialog"
    :value="true"
    no-backdrop-dismiss
    :min-height="showAll ? 750 : 495"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="edit" :title="$t('Edit Game')">
        <template v-slot:buttons>
          <q-btn
            icon="info"
            @click="$router.replace({ name: 'info-view' })"
            class="q-field__focusable-action q-mr-sm"
            dense
            flat
          >
            <tooltip>{{ $t("View Game Info") }}</tooltip>
          </q-btn>
        </template>
      </dialog-header>
    </template>

    <q-card-section>
      <GameInfo
        ref="gameInfo"
        :game="$game"
        :show-all="showAll"
        @submit="save"
        @hasChanges="hasChanges = $event"
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
          :label="$t('Save')"
          @click="$refs.gameInfo.submit()"
          :loading="loading"
          :disabled="$refs.gameInfo && $refs.gameInfo.hasError"
          :flat="!hasChanges"
          color="primary"
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
      hasChanges: false,
    };
  },
  methods: {
    reset() {
      this.$store.dispatch("ui/PROMPT", {
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetGame"),
        success: () => {
          this.$refs.gameInfo.init();
        },
      });
    },
    close() {
      this.$refs.dialog.hide();
    },
    async save({ name, tags, changes }) {
      this.$store.dispatch("game/RENAME_CURRENT_GAME", name);

      if (this.hasChanges) {
        this.$store.dispatch("game/SET_TAGS", changes);
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
