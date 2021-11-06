<template>
  <small-dialog :value="true" content-class="non-selectable" v-bind="$attrs">
    <template v-slot:header>
      <q-tabs
        v-model="tab"
        active-color="primary"
        indicator-color="primary"
        align="justify"
      >
        <q-tab name="new" :label="$t('New Game')" />
        <q-tab name="load" :label="$t('Load Game')" />
      </q-tabs>
    </template>

    <q-card>
      <smooth-reflow>
        <q-tab-panels v-model="tab" keep-alive animated>
          <q-tab-panel name="new" class="q-pa-none">
            <q-card-section class="q-pa-none">
              <GameInfo
                ref="gameInfo"
                class="q-pa-md"
                :values="tags"
                :show-all="showAll"
                @submit="createGame"
              />
            </q-card-section>
          </q-tab-panel>

          <q-tab-panel name="load" class="q-pa-none">
            <q-list separator>
              <q-item
                @click="$store.dispatch('ui/OPEN', close)"
                clickable
                v-ripple
              >
                <q-item-section avatar>
                  <q-icon name="browse_files" />
                </q-item-section>
                <q-item-section>{{ $t("Local") }}</q-item-section>
              </q-item>
              <q-item
                @click="toggleOnline"
                :class="{ 'text-primary': showOnline }"
                clickable
                v-ripple
              >
                <q-item-section avatar>
                  <q-icon name="online" />
                </q-item-section>
                <q-item-section>{{ $t("Online") }}</q-item-section>
                <q-item-section side>
                  <q-icon
                    name="arrow_drop_down"
                    class="q-expansion-item__toggle-icon"
                    :class="{ 'rotate-180': showOnline }"
                  />
                </q-item-section>
              </q-item>
              <recess>
                <!-- <GameTable
                  v-if="showOnline"
                  ref="gameTable"
                  v-model="selectedGames"
                /> -->
                <div v-if="showOnline" class="q-pa-md text-center">
                  {{ $t("Coming soon") }}
                </div>
              </recess>
            </q-list>
          </q-tab-panel>
        </q-tab-panels>
      </smooth-reflow>
    </q-card>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <MoreToggle v-show="tab === 'new'" v-model="showAll" />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          @click="ok"
          :disabled="tab === 'load' && !selectedGames.length"
          color="primary"
          flat
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import GameInfo from "../components/controls/GameInfo";
// import GameTable from "../components/controls/GameTable";
import MoreToggle from "../components/controls/MoreToggle.vue";

import Game from "../Game";

export default {
  name: "AddGame",
  components: { GameInfo, /* GameTable, */ MoreToggle },
  data() {
    return {
      tags: {
        player1: this.$store.state.ui.player1,
        player2: this.$store.state.ui.player2,
        size: this.$store.state.ui.size,
        site: this.$t("site_name"),
      },
      selectedGames: [],
      showAll: false,
    };
  },
  computed: {
    tab: {
      get() {
        return this.$route.params.tab || "new";
      },
      set(tab) {
        this.$router.replace({ params: { tab } });
      },
    },
    showOnline: {
      get() {
        return !!this.$route.params.online;
      },
      set(online) {
        this.$router.replace({ params: { online: online ? "online" : null } });
      },
    },
    size: {
      get() {
        return this.$store.state.ui.size;
      },
      set(value) {
        this.tags.size = value;
        this.$store.dispatch("ui/SET_UI", ["size", value || ""]);
      },
    },
    player1: {
      get() {
        return this.$store.state.ui.player1;
      },
      set(value) {
        this.tags.player1 = value;
        this.$store.dispatch("ui/SET_UI", ["player1", value || ""]);
      },
    },
    player2: {
      get() {
        return this.$store.state.ui.player2;
      },
      set(value) {
        this.tags.player2 = value;
        this.$store.dispatch("ui/SET_UI", ["player2", value || ""]);
      },
    },
  },
  methods: {
    close() {
      this.$router.back();
    },
    createGame({ name, tags }) {
      this.player1 = tags.player1;
      this.player2 = tags.player2;
      this.size = tags.size;

      let game = new Game({ name, tags });

      game.warnings.forEach((warning) =>
        this.$store.dispatch("NOTIFY_WARNING", warning)
      );

      this.$store.dispatch("game/ADD_GAME", game);

      this.close();
    },
    async toggleOnline() {
      await this.$nextTick(() => (this.showOnline = !this.showOnline));
    },
    ok() {
      if (this.tab === "new") {
        this.$refs.gameInfo.submit();
      } else {
        if (this.selectedGames.length) {
          // Load online game(s)
          this.selectedGames.forEach((game) => {
            this.$store
              .dispatch("online/LOAD_GAME", game.config.id)
              .catch((error) => {
                this.$store.dispatch("ui/NOTIFY_ERROR", error);
              });
          });
          this.selectedGames = [];
        }
        this.close();
      }
    },
  },
};
</script>
