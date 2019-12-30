<template>
  <q-table
    ref="table"
    class="online-games"
    :class="{ fullscreen }"
    card-class="bg-secondary"
    table-class="dim"
    :loading="loading"
    :columns="columns"
    :data="games"
    :row-key="row => row.config.id"
    :rows-per-page-options="[20]"
    :visible-columns="visibleColumns"
    :fullscreen.sync="fullscreen"
    :pagination.sync="pagination"
    selection="single"
    :selected.sync="selected"
    :selected-rows-label="selectedText"
    :loading-label="$t('Loading')"
    :no-data-label="$t('No Games')"
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

    <template v-slot:body="props">
      <q-tr
        :props="props"
        @click="select(props.row)"
        class="non-selectable"
        :class="{
          'text-accent': props.row.isOpen,
          'cursor-pointer': !props.row.isOpen
        }"
        :no-hover="props.row.isOpen"
      >
        <td></td>
        <q-td key="role" :props="props">
          <q-icon :name="gameIcon(props.row.config.player)" size="sm" />
        </q-td>
        <q-td key="title" :props="props">
          {{ props.row.name }}
        </q-td>
        <q-td key="player1" :props="props">
          {{ props.row.tags.player1 }}
        </q-td>
        <q-td key="player2" :props="props">
          {{ props.row.tags.player2 }}
        </q-td>
        <q-td key="size" :props="props">
          {{ props.row.tags.size + "x" + props.row.tags.size }}
        </q-td>
        <q-td key="date" :props="props">
          <span :title="props.row.tags.date | moment('llll')">
            {{ props.row.tags.date | moment("from") }}
          </span>
        </q-td>
        <q-td key="result" :props="props">
          <Result :result="props.row.tags.result" />
        </q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<script>
import FullscreenToggle from "../controls/FullscreenToggle.vue";

import Result from "../PTN/Result";

import { compact, reject, without } from "lodash";

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
        rowsPerPage: 10,
        rowsNumber: 0
      },
      columns: [
        {
          name: "role",
          label: this.$t("Role"),
          align: "center"
        },
        {
          name: "title",
          label: this.$t("Title"),
          align: "left"
        },
        {
          name: "player1",
          label: this.$t("Player1"),
          icon: "person",
          align: "center"
        },
        {
          name: "player2",
          label: this.$t("Player2"),
          icon: "person_outline",
          align: "center"
        },
        {
          name: "size",
          label: this.$t("Size"),
          icon: "grid_on",
          align: "center"
        },
        {
          name: "date",
          label: this.$t("Date"),
          icon: "event",
          align: "center"
        },
        {
          name: "result",
          label: this.$t("Result"),
          icon: "gavel",
          align: "center"
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
      return this.$store.state.online.onlineGames.map(game => ({
        isLocal: true,
        isOpen: this.isOpen(game),
        ...game
      }));
    },
    localGameIDs() {
      return this.localGames.map(game => game.config.id);
    },
    openGameIDs() {
      return compact(this.$store.state.games.map(game => game.config.id));
    },
    visibleColumns() {
      let columns = this.columns.map(col => col.name);
      if (this.fullscreen) {
        return columns;
      } else if (this.$q.screen.gt.sm) {
        return without(columns, "title");
      } else {
        return without(columns, "title", "date");
      }
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
      return this.$store.getters["online/gameIcon"](player);
    },
    select(game) {
      if (this.isOpen(game)) {
        return;
      }
      if (this.selected[0] === game) {
        this.selected.pop();
      } else {
        this.selected.splice(0, 1, game);
      }
    },
    selectedText() {
      return "";
    },
    isLocal(game) {
      return this.localGameIDs.includes(game.config.id);
    },
    isOpen(game) {
      return this.openGameIDs.includes(game.config.id);
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
    }
  }
};
</script>

<style lang="stylus">
$header = 64px
$footer = 48px

.online-games
  tr > :first-child
    display none

  .q-linear-progress
    color $accent !important

  .q-table__middle
    min-height 12rem
    max-height 'calc(50vh - %s)' % ($header + $footer)
  &.fullscreen .q-table__middle
    height 'calc(100vh - %s)' % ($header + $footer)
    max-height @height

  .q-table__top,
  .q-table__bottom,
  thead tr:first-child th
    background-color $secondary

  thead tr th
    position sticky
    z-index 1
  thead tr:first-child th
    top 0

  &.q-table--loading thead tr:last-child th
    top 55px
</style>
