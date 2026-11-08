<template>
  <large-dialog
    ref="dialog"
    content-class="load-online"
    :value="true"
    no-backdrop-dismiss
    v-bind="$attrs"
  >
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
      <template v-slot:fullscreen-header>
        <q-btn icon="add" @click="add" stretch flat>
          <hint>{{ $t("Create") }}</hint>
        </q-btn>
        <q-btn icon="close" stretch flat v-close-popup>
          <hint>{{ $t("Close") }}</hint>
        </q-btn>
      </template>

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
              :disable="!selectedGames.length"
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
          :disable="!selectedGames.length"
          :flat="!selectedGames.length"
          color="primary"
        />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import GameTable from "../components/controls/GameTable";
import { openOnlineGame } from "../utilities";

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
      this.$router.replace({
        name: "add",
        params: { tab: "new", type: "online" },
      });
    },
    close() {
      this.$refs.dialog.hide();
    },
    async ok() {
      this.loading = true;
      // Only the game left open (the last one) is offered to join
      let offerJoin = false;
      for (const game of this.selectedGames) {
        try {
          offerJoin = await openOnlineGame({
            id: game.config.id,
            isPrivate: game.config.isPrivate,
          });
        } catch (error) {
          offerJoin = false;
          this.notifyError(error);
        }
      }
      this.loading = false;

      this.selectedGames = [];
      if (offerJoin) {
        // Leave this dialog without going back, then show the prompt
        await this.$router.replace("/").catch(() => {});
        this.$router.push({ name: "join" });
      } else {
        this.close();
      }
    },
  },
};
</script>

<style lang="scss">
.load-online {
  .game-table:not(.fullscreen) {
    margin-bottom: 52px;

    .q-table__top {
      position: sticky;
      z-index: 1;
      top: 64px;
    }
  }
}
</style>
