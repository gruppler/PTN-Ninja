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
    :selection="selectionMode || 'multiple'"
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

    <template v-slot:bottom-left>
      <div class="negative" v-show="isMaxed"></div>
      {{ $t("error.OnlineGamesLimit") }}
    </template>

    <template v-slot:header-cell="props">
      <q-th :props="props">
        <q-icon
          v-if="props.col.icon"
          :name="props.col.icon"
          :title="isWide ? '' : props.col.label"
          size="xs"
        />
        <template v-if="props.col.icons">
          <q-icon
            v-for="(icon, i) in props.col.icons"
            :name="icon"
            :title="isWide ? '' : props.col.label"
            :key="'p' + i"
            size="xs"
          />
        </template>
        <span v-show="(!props.col.icon && !props.col.icons) || isWide">
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
        :key="props.row.id"
        :title="isWide ? '' : props.row.name"
      >
        <td></td>
        <q-td key="role" :props="props">
          <q-icon
            :name="playerIcon(props.row.config.player)"
            :title="roleText(props.row.config.player)"
            size="md"
          />
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
        <q-td key="players" :props="props">
          <div v-if="props.row.tags.player1">
            <q-icon :name="playerIcon(1)" size="sm" />
            {{ props.row.tags.player1 }}
          </div>
          <div v-if="props.row.tags.player2">
            <q-icon :name="playerIcon(2)" size="sm" />
            {{ props.row.tags.player2 }}
          </div>
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
      <q-tr v-show="props.expand && !isWide" :props="props">
        <q-td colspan="100%" :props="props">
          {{ props.row.name }}
        </q-td>
        <q-td v-show="!visibleColumns.includes('date')" :props="props">
          <div :title="props.row.tags.date | moment('llll')">
            {{ props.row.tags.date | moment("from") }}
          </div>
        </q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<script>
import FullscreenToggle from "../controls/FullscreenToggle.vue";

import Result from "../PTN/Result";

import { compact, reject, without } from "lodash";

const MAX_SELECTED = 3;
const MAX_ONLINE = 5;

export default {
  name: "GameTable",
  components: { FullscreenToggle, Result },
  props: ["value", "selection-mode"],
  data() {
    return {
      filter: "",
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
          icon: this.playerIcon(1),
          align: "center"
        },
        {
          name: "player2",
          label: this.$t("Player2"),
          icon: this.playerIcon(2),
          align: "center"
        },
        {
          name: "players",
          label: this.$t("Players"),
          icons: [this.playerIcon(1), this.playerIcon(2)],
          align: "left"
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
    fullscreen: {
      get() {
        return !!this.$route.params.fullscreen;
      },
      set(value) {
        if (value) {
          if (!this.$route.params.fullscreen) {
            this.$router.push({ params: { fullscreen: "online" } });
          }
        } else {
          if (this.$route.params.fullscreen) {
            this.$router.go(-1);
            this.$router.replace({ params: { fullscreen: null } });
          }
        }
      }
    },
    isMaxed() {
      return this.selected.length + this.localGames.length >= this.maxSelected;
    },
    maxSelected() {
      return this.selectionMode === "single"
        ? 1
        : Math.min(
            MAX_SELECTED,
            MAX_ONLINE - this.selected.length + this.localGames.length
          );
    },
    error() {
      return this.isMaxed ? this.$t("error.OnlineGamesLimit") : "";
    },
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
        return without(columns, "players");
      } else if (this.$q.screen.gt.sm) {
        return without(columns, "title", "player1", "player2");
      } else {
        return without(columns, "title", "player1", "player2", "date");
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
    playerIcon(player) {
      return this.$store.getters.playerIcon(player);
    },
    roleText(player) {
      return player !== undefined
        ? this.$t(
            {
              1: "Player1",
              2: "Player2",
              0: "Spectator"
            }["" + player] || ""
          )
        : "";
    },
    select(game) {
      if (this.isOpen(game)) {
        return;
      }
      const index = this.selected.indexOf(game);
      if (index >= 0) {
        this.selected.splice(index, 1);
      } else {
        this.selected.unshift(game);
        if (this.selected.length > this.maxSelected) {
          this.selected.splice(this.maxSelected);
        }
      }
    },
    selectedText(count) {
      return count
        ? this.$tc("count.xGamesSelected", this.selected.length, {
            x: this.selected.length
          })
        : "";
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
