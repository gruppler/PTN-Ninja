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

    <GameTable ref="gameTable" v-model="selectedGames" class="fit">
      <template v-slot:fullscreen-footer>
        <q-footer class="bg-accent" elevated>
          <q-separator />

          <message-output :error="error" />

          <q-card-actions align="right">
            <div v-if="selectedGames.length">
              {{ $tc("n_games", selectedGames.length) }}
            </div>
            <q-space />
            <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
            <q-btn
              @click="ok"
              :label="$t('OK')"
              :loading="loading"
              :disabled="!selectedGames.length"
              :flat="!selectedGames.length"
              color="primary"
            />
          </q-card-actions>
        </q-footer>
      </template>
    </GameTable>

    <template v-slot:footer>
      <q-separator />

      <message-output :error="error" />

      <q-card-actions align="right">
        <div v-if="selectedGames.length">
          {{ $tc("n_games", selectedGames.length) }}
        </div>
        <q-space />
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          @click="ok"
          :label="$t('OK')"
          :loading="loading"
          :disabled="!selectedGames.length"
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
      if (!this.$refs.gameTable) {
        return;
      }
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
    },
    close() {
      this.$refs.dialog.hide();
    },
    async ok() {
      await this.$store
        .dispatch(
          "online/LOAD_GAMES",
          this.selectedGames.map((option) => option.value)
        )
        .catch((error) => {
          this.notifyError(error);
        });

      this.selectedGames = [];
      this.close();
    },
  },
};
</script>
