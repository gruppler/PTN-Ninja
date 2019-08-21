<template>
  <q-dialog :value="value" @input="$emit('input', $event)">
    <q-card style="width: 500px" class="bg-secondary" dark>
      <q-tabs v-model="tab" active-color="accent" indicator-color="accent">
        <q-tab name="new" :label="$t('New_Game')" />
        <q-tab name="load" :label="$t('Load_Game')" />
      </q-tabs>

      <q-tab-panels
        v-model="tab"
        class="bg-secondary text-accent"
        animated
        dark
      >
        <q-tab-panel name="new" class="q-pa-none">
          <q-list separator dark>
            <q-expansion-item
              icon="folder_open"
              :label="$t('Local')"
              group="new"
              default-opened
            >
              <q-card-section class="q-pt-none">
                <q-input
                  v-model="size"
                  type="number"
                  :min="3"
                  :max="8"
                  :label="$t('Size')"
                  @keyup.enter="createGame"
                  color="accent"
                  dark
                >
                  <template v-slot:prepend>
                    <q-icon name="grid_on" />
                  </template>
                </q-input>

                <div class="row">
                  <div class="col">
                    <q-input
                      v-model="player1"
                      :label="$t('Player1')"
                      @keyup.enter="createGame"
                      color="accent"
                      dark
                    >
                      <template v-slot:prepend>
                        <q-icon name="person" />
                      </template>
                    </q-input>

                    <q-input
                      v-model="player2"
                      :label="$t('Player2')"
                      @keyup.enter="createGame"
                      color="accent"
                      dark
                    >
                      <template v-slot:prepend>
                        <q-icon name="person_outline" />
                      </template>
                    </q-input>
                  </div>
                  <q-btn @click="swapPlayers" icon="swap_vert" dense flat />
                </div>
              </q-card-section>
            </q-expansion-item>
            <q-expansion-item icon="cloud" :label="$t('Remote')" group="new">
              <q-card-section class="q-pt-none">
                <q-input
                  v-model="size"
                  type="number"
                  :min="3"
                  :max="8"
                  :label="$t('Size')"
                  @keyup.enter="createGame"
                  color="accent"
                  dark
                >
                  <template v-slot:prepend>
                    <q-icon name="grid_on" />
                  </template>
                </q-input>
              </q-card-section>
            </q-expansion-item>
          </q-list>
          <q-separator dark />
          <q-card-actions align="right">
            <q-btn :label="$t('OK')" @click="createGame" flat />
            <q-btn :label="$t('Cancel')" flat v-close-popup />
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
            <q-expansion-item icon="cloud" :label="$t('Remote')">
              <q-list></q-list>
            </q-expansion-item>
          </q-list>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </q-dialog>
</template>

<script>
import Game from "./PTN/Game";

import { each } from "lodash";

export default {
  name: "NewGame",
  props: ["value"],
  data() {
    return {
      tab: "new"
    };
  },
  computed: {
    size: {
      get() {
        return this.$store.state.size;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["size", value]);
      }
    },
    player1: {
      get() {
        return this.$store.state.player1;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["player1", value]);
      }
    },
    player2: {
      get() {
        return this.$store.state.player2;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["player2", value]);
      }
    }
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    createGame() {
      let game = new Game(
        '[Date ""]\n' +
          `[Player1 "${this.player1}"]\n` +
          `[Player2 "${this.player2}"]\n` +
          `[Size "${this.size}"]\n` +
          '[Result ""]\n' +
          "\n" +
          "1. "
      );
      this.$store.dispatch("ADD_GAME", game);
      this.close();
    },
    loadGames(event) {
      each(event.target.files, file => this.$store.dispatch("OPEN_FILE", file));
      this.close();
    },
    swapPlayers() {
      const player1 = this.player1;
      this.player1 = this.player2;
      this.player2 = player1;
    }
  }
};
</script>

<style></style>
