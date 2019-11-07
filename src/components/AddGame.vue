<template>
  <q-dialog :value="value" @input="$emit('input', $event)" no-route-dismiss>
    <q-card style="width: 500px" class="bg-secondary" dark>
      <q-tabs v-model="tab" active-color="accent" indicator-color="accent">
        <q-tab name="new" :label="$t('New Game')" />
        <q-tab name="load" :label="$t('Load Game')" />
      </q-tabs>

      <q-tab-panels v-model="tab" class="bg-secondary" keep-alive animated dark>
        <q-tab-panel name="new" class="q-pa-none">
          <div class="relative-position">
            <q-card-section class="scroll">
              <GameInfo
                style="max-height: calc(100vh - 24rem); min-height: 4rem"
                ref="gameInfo"
                :values="tags"
                :showAll="showAll"
                @save="createGame"
              />
            </q-card-section>
            <div class="absolute-fit inset-shadow no-pointer-events" />
          </div>
          <q-btn
            class="full-width"
            :label="$t(showAll ? 'Show Less' : 'Show More')"
            @click="showAll = !showAll"
            flat
          />
          <q-separator dark />
          <q-card-actions align="right">
            <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
            <q-btn
              :label="$t('OK')"
              @click="$refs.gameInfo.save()"
              color="accent"
              flat
            />
          </q-card-actions>
        </q-tab-panel>

        <q-tab-panel name="load" class="q-pa-none">
          <q-list separator dark>
            <q-item @click="$refs.fileinput.click()" clickable>
              <q-item-section avatar>
                <q-icon name="folder_open" />
              </q-item-section>
              <q-item-section>
                {{ $t("Local") }}
                <input
                  @input="loadGames"
                  ref="fileinput"
                  type="file"
                  accept=".ptn,.txt"
                  multiple
                  hidden
                />
              </q-item-section>
            </q-item>
            <q-expansion-item icon="cloud" :label="$t('Remote')" group="type">
              <q-card-section>
                <q-list></q-list>
                <div class="absolute-fit inset-shadow no-pointer-events" />
              </q-card-section>
            </q-expansion-item>
          </q-list>
          <div class="absolute-fit inset-shadow no-pointer-events" />
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </q-dialog>
</template>

<script>
import GameInfo from "./GameInfo";

import Game from "../PTN/Game";

export default {
  name: "AddGame",
  components: { GameInfo },
  props: ["value"],
  data() {
    return {
      tab: "new",
      tags: {
        player1: this.$store.state.player1,
        player2: this.$store.state.player2,
        size: this.$store.state.size,
        site: this.$t("site_name"),
        event: this.$t("Offline Play")
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
    loadGames(event) {
      this.$store.dispatch("OPEN_FILES", event.target.files);
      this.close();
    }
  }
};
</script>

<style lang="stylus">
.q-field.size
  width 8em
</style>
