<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    content-class="non-selectable"
    v-bind="$attrs"
  >
    <q-card
      :style="{ width: (showOnline ? 700 : 560) + 'px' }"
      class="bg-secondary"
    >
      <q-tabs v-model="tab" active-color="accent" indicator-color="accent">
        <q-tab name="new" :label="$t('New Game')" />
        <q-tab name="load" :label="$t('Load Game')" />
      </q-tabs>

      <SmoothReflow
        tag="q-tab-panels"
        v-model="tab"
        class="bg-secondary"
        keep-alive
        animated
      >
        <q-tab-panel name="new" class="q-pa-none">
          <Recess>
            <q-card-section style="max-height: calc(100vh - 17rem)">
              <GameInfo
                ref="gameInfo"
                :values="tags"
                :show-all="showAll"
                @save="createGame"
              />
            </q-card-section>
          </Recess>
        </q-tab-panel>

        <q-tab-panel name="load" class="q-pa-none">
          <Recess>
            <q-list separator>
              <q-item
                @click="$store.dispatch('OPEN', close)"
                clickable
                v-ripple
              >
                <q-item-section avatar>
                  <q-icon name="folder_open" />
                </q-item-section>
                <q-item-section>{{ $t("Local") }}</q-item-section>
              </q-item>
              <q-item
                @click="showOnline = !showOnline"
                :class="{ 'text-accent': showOnline }"
                clickable
              >
                <q-item-section avatar>
                  <q-icon name="public" />
                </q-item-section>
                <q-item-section>{{ $t("Online") }}</q-item-section>
                <q-item-section side>
                  <q-icon
                    name="keyboard_arrow_down"
                    class="q-expansion-item__toggle-icon"
                    :class="{ 'rotate-180': showOnline }"
                  />
                </q-item-section>
              </q-item>
              <Recess>
                <GameTable
                  v-if="showOnline"
                  ref="gameTable"
                  v-model="selectedGames"
                />
              </Recess>
            </q-list>
          </Recess>
        </q-tab-panel>
      </SmoothReflow>

      <q-separator />

      <q-card-actions class="row items-center justify-end q-gutter-sm">
        <MoreToggle v-show="tab === 'new'" v-model="showAll" />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          @click="ok"
          :disabled="tab === 'load' && !selectedGames.length"
          color="accent"
          flat
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import GameInfo from "../controls/GameInfo";
import GameTable from "../controls/GameTable";
import MoreToggle from "../controls/MoreToggle.vue";

import Game from "../../PTN/Game";

export default {
  name: "AddGame",
  components: { GameInfo, GameTable, MoreToggle },
  props: ["value"],
  data() {
    return {
      tab: "new",
      tags: {
        player1: this.$store.state.player1,
        player2: this.$store.state.player2,
        size: this.$store.state.size,
        site: this.$t("site_name")
      },
      selectedGames: [],
      showAll: false,
      showOnline: false
    };
  },
  computed: {
    size: {
      get() {
        return this.$store.state.size;
      },
      set(value) {
        this.tags.size = value;
        this.$store.dispatch("SET_UI", ["size", value || ""]);
      }
    },
    player1: {
      get() {
        return this.$store.state.player1;
      },
      set(value) {
        this.tags.player1 = value;
        this.$store.dispatch("SET_UI", ["player1", value || ""]);
      }
    },
    player2: {
      get() {
        return this.$store.state.player2;
      },
      set(value) {
        this.tags.player2 = value;
        this.$store.dispatch("SET_UI", ["player2", value || ""]);
      }
    }
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    createGame({ name, tags }) {
      this.player1 = tags.player1;
      this.player2 = tags.player2;
      this.size = tags.size;

      let game = new Game(`[Size "${this.size}"]\n\n1. `, { name });
      game.setTags(tags, false);
      this.$store.dispatch("ADD_GAME", {
        ptn: game.ptn,
        name: game.name,
        state: game.minState,
        config: game.config
      });
      this.close();
    },
    ok() {
      if (this.tab === "new") {
        this.$refs.gameInfo.save();
      } else {
        if (this.selectedGames.length) {
          // Load online game(s)
          this.selectedGames.forEach(game => {
            this.$store.dispatch("online/LOAD_GAME", game.config);
          });
        }
        this.close();
      }
    }
  }
};
</script>
