<template>
  <small-dialog :value="true" content-class="non-selectable" v-bind="$attrs">
    <template v-slot:header>
      <dialog-header icon="analysis" :title="$t('New Analysis')">
        <template v-slot:buttons>
          <!-- Online Games -->
          <q-btn
            icon="online"
            :to="{ name: 'load-online', params: { filter: 'analysis' } }"
            replace
            dense
            flat
          >
            <hint>{{ $tc("Analysis", 100) }}</hint>
          </q-btn>
        </template>
      </dialog-header>
    </template>

    <q-card style="width: 330px; max-width: 100%">
      <smooth-reflow tag="recess" class="col">
        <q-list> </q-list>

        <q-inner-loading :showing="loading" />
      </smooth-reflow>
    </q-card>

    <template v-slot:footer>
      <q-separator />

      <message-output :error="error" content-class="q-ma-md" />

      <q-card-actions align="right">
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          @click="create"
          :label="$t('Create')"
          :disabled="!isPlayerValid || !isOpponentValid"
          :loading="loading"
          color="primary"
          flat
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import { cloneDeep } from "lodash";

export default {
  name: "AnalysisOnline",
  data() {
    const user = this.$store.state.online.user;
    const config = cloneDeep(this.$store.state.ui.onlineConfig);
    if (!user || user.isAnonymous) {
      config.isPrivate = true;
    }
    return {
      config,
      error: "",
      isPlayerValid: false,
      isOpponentValid: false,
      opponentName: "",
      loading: false,
    };
  },
  computed: {
    isLoggedIn() {
      return this.user && !this.user.isAnonymous;
    },
    user() {
      return this.$store.state.online.user;
    },
    playerBGColor() {
      switch (this.config.playerSeat) {
        case 1:
          return "player1";
        case 2:
          return "player2";
        default:
          return "primary";
      }
    },
    playerTextColor() {
      switch (this.config.playerSeat) {
        case 1:
          return "player2";
        case 2:
          return "player1";
        default:
          return "textDark";
      }
    },
  },
  methods: {
    playerIcon(player) {
      return this.$store.getters["ui/playerIcon"](player);
    },
    async create() {
      if (!this.isPlayerValid || !this.isOpponentValid) {
        return;
      }

      try {
        this.error = null;
        this.loading = true;
        const id = await this.$store.dispatch("online/CREATE_GAME", {
          game: this.$game,
          config: {
            isPrivate: this.config.isPrivate,
            playerSeat: this.config.playerSeat,
            playerName: this.config.isPrivate ? this.config.playerName : "",
            opponentName: this.opponentName,
            scratchboard: this.config.scratchboard,
            flatCounts: this.config.flatCounts,
            showRoads: this.config.showRoads,
            stackCounts: this.config.stackCounts,
          },
        });
        await this.$store.dispatch("online/LOAD_GAME", {
          id,
          isPrivate: this.config.isPrivate,
        });
        this.close();
      } catch (error) {
        this.error = error;
      } finally {
        this.loading = false;
      }
    },
  },
  watch: {
    isLoggedIn(isLoggedIn) {
      if (isLoggedIn) {
        this.config.isPrivate = false;
      }
    },
    config: {
      handler(config) {
        this.$store.dispatch("ui/SET_UI", ["onlineConfig", cloneDeep(config)]);
      },
      deep: true,
    },
  },
};
</script>
