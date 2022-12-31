<template>
  <large-dialog ref="dialog" :value="true" no-backdrop-dismiss v-bind="$attrs">
    <template v-slot:header>
      <dialog-header icon="online" :title="$t('Online')">
        <template v-slot:buttons>
          <q-btn icon="add" @click="add" dense flat>
            <hint>{{ $t("Create") }}</hint>
          </q-btn>
        </template>
      </dialog-header>
    </template>

    <GameTable ref="gameTable" v-model="selectedGames" class="fit" />

    <template v-slot:footer>
      <q-separator />

      <message-output :error="error" />

      <q-card-actions align="right">
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          @click="$refs.gameInfo.submit()"
          :loading="loading"
          :disabled="$refs.gameInfo && $refs.gameInfo.hasError"
          :flat="!selectedGames.length"
          color="primary"
        />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import GameTable from "../components/controls/GameTable";

export default {
  name: "LoadOnline",
  components: { GameTable },
  data() {
    return {
      loading: false,
      error: "",
      selectedGames: [],
    };
  },
  methods: {
    add() {
      if (this.$refs.gameTable) {
        switch (this.$refs.gameTable.filter) {
          case "puzzle":
            this.$router.replace({ name: "puzzle-online" });
            break;
          case "analysis":
            this.$router.replace({ name: "analysis-online" });
            break;
          default:
            this.$router.replace({ name: "play-online" });
        }
      } else {
        this.$router.replace({ name: "play-online" });
      }
    },
    close() {
      this.$refs.dialog.hide();
    },
    async ok() {
      this.selectedGames.forEach((game) => {
        this.$store
          .dispatch("online/LOAD_GAME", game.config.id)
          .catch((error) => {
            this.notifyError(error);
          });
      });
      this.selectedGames = [];

      this.close();
    },
  },
};
</script>
