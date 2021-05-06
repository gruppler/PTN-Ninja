<template>
  <small-dialog
    :value="value"
    @input="$emit('input', $event)"
    content-class="non-selectable"
    v-bind="$attrs"
  >
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
                @click="$store.dispatch('OPEN', close)"
                clickable
                v-ripple
              >
                <q-item-section avatar>
                  <q-icon name="browse_files" />
                </q-item-section>
                <q-item-section>{{ $t("Local") }}</q-item-section>
              </q-item>
              <q-expansion-item
                group="type"
                :label="$t('Online')"
                icon="online"
              >
                <recess>
                  <q-list>
                    <q-item>
                      <q-item-section align="center">
                        {{ $t("Coming soon") }}
                      </q-item-section>
                    </q-item>
                  </q-list>
                </recess>
              </q-expansion-item>
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
          v-show="tab === 'new'"
          :label="$t('OK')"
          @click="ok"
          color="primary"
          flat
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import GameInfo from "../controls/GameInfo";
import MoreToggle from "../controls/MoreToggle.vue";

import Game from "../../PTN/Game";

export default {
  name: "AddGame",
  components: { GameInfo, MoreToggle },
  props: ["value"],
  data() {
    return {
      tags: {
        player1: this.$store.state.player1,
        player2: this.$store.state.player2,
        size: this.$store.state.size,
        site: this.$t("site_name"),
      },
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
    size: {
      get() {
        return this.$store.state.size;
      },
      set(value) {
        this.tags.size = value;
        this.$store.dispatch("SET_UI", ["size", value || ""]);
      },
    },
    player1: {
      get() {
        return this.$store.state.player1;
      },
      set(value) {
        this.tags.player1 = value;
        this.$store.dispatch("SET_UI", ["player1", value || ""]);
      },
    },
    player2: {
      get() {
        return this.$store.state.player2;
      },
      set(value) {
        this.tags.player2 = value;
        this.$store.dispatch("SET_UI", ["player2", value || ""]);
      },
    },
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    createGame({ name, tags }) {
      this.player1 = tags.player1;
      this.player2 = tags.player2;
      this.size = tags.size;

      let game = new Game("", { name, tags });

      // game.warnings.forEach((warning) =>
      //   this.$store.dispatch("NOTIFY_WARNING", warning)
      // );

      this.$store.dispatch("ADD_GAME", {
        ptn: game.ptn,
        name: game.name,
        state: game.minState,
      });

      this.close();
    },
    ok() {
      if (this.tab === "new") {
        this.$refs.gameInfo.submit();
      } else {
        // Load online game
      }
    },
  },
};
</script>
