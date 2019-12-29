<template>
  <q-table
    ref="table"
    class="online-games"
    card-class="bg-secondary"
    table-class="dim"
    table-header-class="bg-secondary"
    :loading="loading"
    :columns="columns"
    :data="games"
    :row-key="row => row.config.id"
    :rows-per-page-options="[20]"
    :visible-columns="visibleColumns"
    :fullscreen.sync="fullscreen"
    :pagination.sync="pagination"
    :selected.sync="selected"
    :selected-rows-label="selectedText"
    :no-data-label="$t('No Games')"
    selection="multiple"
    v-on="$listeners"
    v-bind="$attrs"
  >
    <template v-slot:top>
      <q-input
        v-model="filter"
        class="col-grow"
        debounce="200"
        color="accent"
        clearable
        filled
        dense
      >
        <template v-slot:before>
          <FullscreenToggle v-model="fullscreen" />
        </template>
        <template v-slot:prepend>
          <q-icon name="search" />
        </template>
        <template v-slot:after>
          <q-btn @click="loadGames" icon="refresh" flat dense />
        </template>
      </q-input>
    </template>

    <template v-slot:header-cell="props">
      <q-th :props="props">
        <q-icon
          v-if="props.col.icon"
          :name="props.col.icon"
          :title="isWide ? '' : props.col.label"
          size="xs"
        />
        <span v-show="!props.col.icon || isWide">
          {{ props.col.label }}
        </span>
      </q-th>
    </template>

    <template v-slot:body-cell-role="props">
      <q-td :props="props">
        <q-icon :name="props.value" size="sm" />
      </q-td>
    </template>

    <template v-slot:body-cell-date="props">
      <q-td :props="props">
        <span :title="props.value | moment('llll')">
          {{ props.value | moment("from") }}
        </span>
      </q-td>
    </template>

    <template v-slot:body-cell-result="props">
      <q-td :props="props">
        <Result :result="props.value" />
      </q-td>
    </template>
  </q-table>
</template>

<script>
import FullscreenToggle from "../controls/FullscreenToggle.vue";

import Result from "../PTN/Result";

import { reject, without } from "lodash";

export default {
  name: "GameTable",
  components: { FullscreenToggle, Result },
  props: ["value"],
  data() {
    return {
      filter: "",
      fullscreen: false,
      loading: false,
      pagination: {
        page: 1,
        rowsPerPage: 20,
        rowsNumber: 0
      },
      columns: [
        {
          name: "role",
          label: this.$t("Role"),
          align: "center",
          field: row => row.config.player,
          format: this.gameIcon
        },
        {
          name: "title",
          label: this.$t("Title"),
          align: "left",
          field: row => row.name
        },
        {
          name: "player1",
          label: this.$t("Player1"),
          icon: "person",
          align: "center",
          field: row => row.tags.player1
        },
        {
          name: "player2",
          label: this.$t("Player2"),
          icon: "person_outline",
          align: "center",
          field: row => row.tags.player2
        },
        {
          name: "size",
          label: this.$t("Size"),
          icon: "grid_on",
          align: "center",
          field: row => row.tags.size,
          format: size => `${size}x${size}`
        },
        {
          name: "date",
          label: this.$t("Date"),
          icon: "event",
          align: "center",
          field: row =>
            new Date(
              row.tags.date.seconds
                ? row.tags.date.seconds * 1e3
                : row.tags.date
            )
        },
        {
          name: "result",
          label: this.$t("Result"),
          icon: "gavel",
          align: "center",
          field: row => row.tags.result
        }
      ]
    };
  },
  computed: {
    selected: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit("input", value);
      }
    },
    games() {
      return this.localGames.concat(reject(this.publicGames, this.isLocal));
    },
    publicGames() {
      return this.$store.state.online.games;
    },
    localGames() {
      return this.$store.state.onlineGames;
    },
    openGames() {
      return this.$store.state.games;
    },
    localGameIDs() {
      return this.localGames.map(game => game.config.id);
    },
    visibleColumns() {
      let columns = this.columns.map(col => col.name);
      return this.isWide ? columns : without(columns, "title");
    },
    isWide() {
      return this.fullscreen && this.$q.screen.gt.sm;
    }
  },
  methods: {
    loadGames() {
      this.loading = true;
      this.$store.dispatch("online/LOAD_GAMES", this.pagination);
    },
    gameIcon(player) {
      return this.$store.getters.gameIcon(player);
    },
    selectedText(count) {
      return this.$tc("Games Selected", count, { count });
    },
    isLocal(game) {
      return this.localGameIDs.includes(game.config.id);
    }
  },
  mounted() {
    if (!this.publicGames.length) {
      this.loadGames();
    }
  },
  watch: {
    publicGames() {
      this.loading = false;
    },
    openGames(oldGames, newGames) {
      oldGames;
      newGames;
      this.selectedGames;
    }
  }
};
</script>

<style lang="stylus">
.online-games
  .q-linear-progress
    color $accent !important
</style>
