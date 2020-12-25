<template>
  <q-table
    ref="table"
    class="online-games"
    :class="{ fullscreen }"
    table-class="dim"
    :columns="columns"
    :data="games"
    :row-key="(row) => row.config.id"
    :visible-columns="visibleColumns"
    :fullscreen.sync="fullscreen"
    :pagination.sync="pagination"
    :selection="selectionMode || 'multiple'"
    :selected.sync="selected"
    :loading="loading"
    hide-bottom
    v-on="$listeners"
    v-bind="$attrs"
  >
    <template v-slot:top>
      <div class="full-width row no-wrap">
        <FullscreenToggle
          v-model="fullscreen"
          class="q-px-xs q-mr-sm"
          flat
          dense
        />

        <q-input
          ref="search"
          v-model="filter"
          debounce="200"
          class="col col-sm-6"
          @focus="focusSearch"
          autocomplete="off"
          clearable
          filled
          dense
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>

        <div class="col-grow" />

        <q-btn
          icon="account"
          :label="user && !user.isAnonymous ? user.displayName : $t('Log In')"
          :to="{ name: user && !user.isAnonymous ? 'account' : 'login' }"
          color="primary"
          :dense="$q.screen.lt.md"
          class="q-ml-sm"
          flat
        />
      </div>
    </template>

    <template v-slot:header-cell="props">
      <q-th :props="props">
        <q-icon
          v-if="props.col.icon"
          :name="props.col.icon"
          :title="isWide ? '' : props.col.label"
          :class="{
            'q-mr-xs': isWide && props.col.label,
            [props.col.iconClass]: true,
          }"
          size="xs"
        />
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
          'text-accent': props.row.isActive,
          'cursor-pointer': !props.row.isActive,
        }"
        :no-hover="props.row.isActive"
        :key="props.row.id"
        :title="isWide ? '' : props.row.name"
      >
        <td></td>
        <q-td key="role" :props="props">
          <q-icon
            v-if="props.row.player || props.row.isActive"
            :name="playerIcon(props.row.player, props.row.config.isPrivate)"
            :title="roleText(props.row.player)"
            size="md"
          />
        </q-td>
        <q-td key="name" :props="props">
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
          <relative-time :value="props.row.tags.date" :invert="fullscreen" />
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

import { compact, differenceBy, without } from "lodash";

const MAX_SELECTED = Infinity;

export default {
  name: "GameTable",
  components: { FullscreenToggle, Result },
  props: ["value", "selection-mode"],
  data() {
    return {
      error: "",
      filter: "",
      loading: false,
      pagination: {
        rowsPerPage: 0,
        sortBy: "date",
      },
      columns: [
        {
          name: "role",
          label: this.$t("Role"),
          icon: "account",
          align: "center",
        },
        {
          name: "name",
          label: this.$t("Name"),
          icon: "file",
          align: "left",
        },
        {
          name: "player1",
          label: this.$t("Player1"),
          icon: this.playerIcon(1),
          align: "center",
        },
        {
          name: "player2",
          label: this.$t("Player2"),
          icon: this.playerIcon(2),
          align: "center",
        },
        {
          name: "players",
          label: this.$t("Players"),
          icon: "players",
          align: "left",
        },
        {
          name: "size",
          label: this.$t("Size"),
          icon: "size",
          iconClass: "flip-vertical",
          align: "center",
        },
        {
          name: "date",
          label: this.$t("DateTime"),
          icon: "date_time",
          align: "center",
        },
        {
          name: "result",
          label: this.$t("Result"),
          icon: "result",
          align: "center",
        },
      ],
    };
  },
  computed: {
    user() {
      return this.$store.state.online.user;
    },
    fullscreen: {
      get() {
        return !!this.$route.params.fullscreen;
      },
      set(value) {
        if (value) {
          if (!this.$route.params.fullscreen) {
            this.$router.push({ params: { fullscreen: "fullscreen" } });
          }
        } else {
          if (this.$route.params.fullscreen) {
            this.$router.go(-1);
            this.$router.replace({ params: { fullscreen: null } });
          }
        }
      },
    },
    maxSelected() {
      return this.selectionMode === "single" ? 1 : MAX_SELECTED;
    },
    selected: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit("input", value);
      },
    },
    games() {
      return this.playerGames
        .concat(
          differenceBy(
            this.publicGames,
            this.playerGames,
            (game) => game.config.id
          )
        )
        .map((game) => ({
          ...game,
          isActive: this.isActive(game),
          player: game.config.player,
        }));
    },
    publicGames() {
      return Object.values(this.$store.state.online.publicGames).sort(
        this.sortGames
      );
    },
    playerGames() {
      return Object.values(this.$store.state.online.playerGames).sort(
        this.sortGames
      );
    },
    activeGameIDs() {
      return compact(this.$store.state.games.map((game) => game.config.id));
    },
    visibleColumns() {
      let columns = this.columns.map((col) => col.name);
      if (this.fullscreen) {
        return without(columns, "players");
      } else if (this.$q.screen.gt.sm) {
        return without(columns, "name", "player1", "player2");
      } else {
        return without(columns, "name", "player1", "player2", "date");
      }
    },
    isWide() {
      return this.fullscreen && this.$q.screen.gt.sm;
    },
  },
  methods: {
    sortGames(a, b) {
      return b.tags.date - a.tags.date;
    },
    playerIcon(player, isPrivate) {
      return this.$store.getters.playerIcon(player, isPrivate);
    },
    roleText(player) {
      return player !== undefined
        ? this.$t(
            {
              1: "Player1",
              2: "Player2",
              0: "Spectator",
            }["" + player] || ""
          )
        : "";
    },
    focusSearch() {
      if (this.$q.screen.lt.md) {
        this.fullscreen = true;
        this.$nextTick(this.$refs.search.focus);
      }
    },
    select(game) {
      if (game.isActive) {
        return;
      }

      const index = this.selected.findIndex(
        (g) => g.config.id === game.config.id
      );
      if (index >= 0) {
        this.selected.splice(index, 1);
      } else {
        this.selected.unshift(game);
        if (this.selected.length > this.maxSelected) {
          this.selected.splice(this.maxSelected);
        }
      }
    },
    isActive(game) {
      return this.activeGameIDs.includes(game.config.id);
    },
  },
  mounted() {
    if (this.user) {
      this.$store.dispatch("online/LISTEN_PLAYER_GAMES");
    }
    this.$store.dispatch("online/LISTEN_PUBLIC_GAMES");
  },
  beforeDestroy() {
    this.$store.dispatch("online/UNLISTEN_PLAYER_GAMES");
    this.$store.dispatch("online/UNLISTEN_PUBLIC_GAMES");
  },
  watch: {
    "user.uid"() {
      this.$store.dispatch("online/LISTEN_PLAYER_GAMES");
    },
  },
};
</script>

<style lang="scss">
$header: 64px;

.online-games {
  tr > :first-child {
    display: none;
  }

  .q-table__middle {
    min-height: 12rem;
    max-height: calc(50vh - #{$header + $toolbar-min-height});
  }
  &.fullscreen .q-table__middle {
    height: calc(100vh - #{$header});
    max-height: calc(100vh - #{$header});
  }

  .q-table__top,
  .q-table__bottom,
  thead tr:first-child th {
    background-color: $ui;
    background-color: var(--q-color-ui);
  }

  thead tr th {
    position: sticky;
    z-index: 1;
  }
  thead tr:first-child th {
    top: 0;
  }

  &.q-table--loading thead tr:last-child th {
    top: 55px;
  }
}
</style>
