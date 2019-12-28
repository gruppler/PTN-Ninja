<template>
  <q-table
    ref="table"
    class="online-games"
    card-class="bg-secondary"
    table-class="bg-blue-grey-9"
    table-header-class="bg-secondary"
    :loading="loading"
    :columns="columns"
    :data="onlineGames"
    :row-key="row => row.config.id"
    :rows-per-page-options="[20]"
    :visible-columns="visibleColumns"
    :fullscreen.sync="fullscreen"
    :pagination.sync="pagination"
    :selected.sync="selected"
    :selected-rows-label="selectedText"
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
          <FullscreenToggle
            @click="fullscreen = !fullscreen"
            :value="fullscreen"
          />
        </template>
        <template v-slot:prepend>
          <q-icon name="search" />
        </template>
      </q-input>
    </template>

    <template v-slot:header-cell="props">
      <q-th :props="props">
        <q-icon
          v-if="props.col.icon"
          :name="props.col.icon"
          :title="fullscreen ? '' : props.col.label"
          size="xs"
        />
        <span v-show="!props.col.icon || fullscreen">
          {{ props.col.label }}
        </span>
      </q-th>
    </template>

    <template v-slot:body-cell-status="props">
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

import { without } from "lodash";

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
        sortBy: "date",
        descending: true,
        page: 1,
        rowsPerPage: 20,
        rowsNumber: 0
      },
      columns: [
        {
          name: "status",
          label: this.$t("Status"),
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
          field: row => new Date(row.tags.date + " " + row.tags.time)
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
    localOnlineGames() {
      return this.$store.state.onlineGames;
    },
    openOnlineGames() {
      return this.$store.state.online.openGames;
    },
    onlineGames() {
      return this.localOnlineGames.concat();
    },
    openGames() {
      return this.$store.state.games.map(game => game.name);
    },
    visibleColumns() {
      let columns = this.columns.map(col => col.name);
      return this.fullscreen ? columns : without(columns, "title");
    }
  },
  methods: {
    gameIcon(player) {
      return this.$store.getters.gameIcon(player);
    },
    selectedText(count) {
      return this.$tc("Games Selected", count, { count });
    }
  }
};
</script>
