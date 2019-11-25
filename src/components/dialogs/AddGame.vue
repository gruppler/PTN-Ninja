<template>
  <q-dialog :value="value" @input="$emit('input', $event)" no-route-dismiss>
    <q-card style="width: 500px" class="bg-secondary" dark>
      <q-tabs v-model="tab" active-color="accent" indicator-color="accent">
        <q-tab name="new" :label="$t('New Game')" />
        <q-tab name="load" :label="$t('Load Game')" />
      </q-tabs>

      <SmoothReflow>
        <q-tab-panels
          v-model="tab"
          class="bg-secondary"
          keep-alive
          swipeable
          animated
          dark
        >
          <q-tab-panel name="new" class="q-pa-none">
            <Recess>
              <q-card-section
                class="scroll"
                style="max-height: calc(100vh - 17rem); min-height: 8rem"
              >
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
              <q-list separator dark>
                <q-item @click="$store.dispatch('OPEN', close)" clickable>
                  <q-item-section avatar>
                    <q-icon name="folder_open" />
                  </q-item-section>
                  <q-item-section>{{ $t("Local") }}</q-item-section>
                </q-item>
                <q-expansion-item
                  icon="cloud"
                  :label="$t('Remote')"
                  group="type"
                >
                  <Recess>
                    <q-list>
                      <q-item>
                        <q-item-section align="center">
                          {{ $t("Coming soon") }}
                        </q-item-section>
                      </q-item>
                    </q-list>
                  </Recess>
                </q-expansion-item>
              </q-list>
            </Recess>
          </q-tab-panel>
        </q-tab-panels>
      </SmoothReflow>

      <q-separator dark />

      <q-card-actions class="row items-center justify-end q-gutter-sm">
        <MoreToggle v-show="tab === 'new'" v-model="showAll" />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
        <q-btn :label="$t('OK')" @click="ok" color="accent" flat />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import GameInfo from "../controls/GameInfo";

import MoreToggle from "../general/MoreToggle.vue";
import Recess from "../general/Recess";
import SmoothReflow from "../general/SmoothReflow";

import Game from "../../PTN/Game";

export default {
  name: "AddGame",
  components: { GameInfo, MoreToggle, Recess, SmoothReflow },
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
      showAll: false
    };
  },
  computed: {
    size: {
      get() {
        return this.$store.state.size;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["size", value || ""]);
      }
    },
    player1: {
      get() {
        return this.$store.state.player1;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["player1", value || ""]);
      }
    },
    player2: {
      get() {
        return this.$store.state.player2;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["player2", value || ""]);
      }
    }
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    createGame({ name, tags }) {
      this.tags = tags;
      this.player1 = tags.player1;
      this.player2 = tags.player2;
      this.size = tags.size;

      let game = new Game(`[Size "${this.size}"]\n\n1. `, { name });
      game.setTags(tags, false);
      this.$store.dispatch("ADD_GAME", {
        ptn: game.ptn,
        name: game.name,
        state: game.minState
      });
      this.close();
    },
    ok() {
      if (this.tab === "new") {
        this.$refs.gameInfo.save();
      } else {
        // Load online game
      }
    }
  }
};
</script>

<style lang="stylus">
.q-field.size
  width 8em
</style>
