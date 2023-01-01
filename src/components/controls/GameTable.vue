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
    color="primary"
    hide-bottom
    v-on="$listeners"
    v-bind="$attrs"
  >
    <template v-slot:top>
      <div class="column fit overflow-hidden">
        <q-toolbar>
          <!-- List View Options -->

          <q-space />

          <!-- Account -->
          <AccountBtn :login-text="$t('Guest')" rounded flat />
        </q-toolbar>

        <!-- Filter -->
        <q-btn-toggle
          v-if="$q.screen.width >= 440"
          class="highlight no-border-radius justify-center"
          v-model="filter"
          :options="filterOptions"
          :ripple="false"
          stack
        />
        <ListSelect
          v-else
          v-model="filter"
          :options="filterOptions"
          filled
          square
        />
      </div>
    </template>

    <template v-slot:header-cell="props">
      <q-th :props="props">
        <q-icon
          v-if="props.col.icon"
          :name="props.col.icon"
          :class="{
            'q-mr-xs': isWide && props.col.label,
            [props.col.iconClass]: true,
          }"
          size="xs"
        />
        <span v-show="(!props.col.icon && !props.col.icons) || isWide">
          {{ props.col.label }}
        </span>
        <hint v-if="!isWide">{{ props.col.label }}</hint>
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
      >
        <td></td>
        <template v-if="fullscreen">
          <q-td key="role" :props="props">
            <q-icon
              v-if="props.row.player || props.row.isActive"
              :name="playerIcon(props.row.player, props.row.config.isPrivate)"
              size="md"
            >
              <hint>{{ roleText(props.row.player) }}</hint>
            </q-icon>
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
            <relative-time :value="props.row.tags.date" />
          </q-td>
          <q-td key="result" :props="props">
            <Result :result="props.row.tags.result" />
          </q-td>
          <hint v-if="!isWide">{{ props.row.name }}</hint>
        </template>
        <td v-else style="max-width: 100vw" :colspan="visibleColumns.length">
          <GameSelectorOption class="q-pa-none" :option="props.row" />
        </td>
      </q-tr>
    </template>
  </q-table>
</template>

<script>
import GameSelectorOption from "./GameSelectorOption.vue";
import AccountBtn from "../general/AccountBtn.vue";
import ListSelect from "../controls/ListSelect.vue";
import Result from "../PTN/Result";

import { compact, without } from "lodash";

const MAX_SELECTED = Infinity;

export default {
  name: "GameTable",
  components: { GameSelectorOption, AccountBtn, ListSelect, Result },
  props: ["value", "selection-mode"],
  data() {
    return {
      error: "",
      loading: false,
      listener: null,
      pagination: {
        rowsPerPage: 0,
        sortBy: "date",
      },
      filterOptions: [
        {
          value: "ongoing",
          icon: "ongoing",
          label: this.$t("Ongoing"),
        },
        {
          value: "open",
          icon: "open_game",
          label: this.$t("Open"),
        },
        {
          value: "recent",
          icon: "recent",
          label: this.$t("Recent"),
        },
        {
          value: "analysis",
          icon: "analysis",
          label: this.$tc("Analysis", 100),
        },
        {
          value: "puzzle",
          icon: "puzzle",
          label: this.$tc("Puzzle", 100),
        },
      ],
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
    filter: {
      get() {
        return this.$route.params.filter || "ongoing";
      },
      set(filter) {
        this.$router.replace({ params: { filter } });
      },
    },
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
      let games = Object.values(this.$store.state.online.gamesPublic).map(
        (game) => ({
          ...game,
          value: game.config.id,
          isActive: this.isActive(game),
        })
      );

      switch (this.filter) {
        case "ongoing":
          games = games.filter(
            (game) => !game.config.hasEnded && !game.config.isOpen
          );
          break;
        case "open":
          games = games.filter(
            (game) => !game.config.hasEnded && game.config.isOpen
          );
          break;
        case "recent":
          games = games.filter(
            (game) => game.config.hasEnded && !game.config.isOpen
          );
          break;
        default:
          [];
      }
      return games;
    },
    activeGameIDs() {
      return compact(this.$store.state.game.list.map((game) => game.config.id));
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
    playerIcon(player, isPrivate) {
      return this.$store.getters["ui/playerIcon"](player, isPrivate);
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
    async init() {
      this.loading = true;

      const next = () => {
        this.loading = false;
      };
      const error = (error) => {
        this.$store.dispatch("ui/NOTIFY_ERROR", error);
      };

      // Unlisten
      if (this.listener) {
        await this.$store.dispatch("online/UNLISTEN", this.listener);
        this.listener = null;
      }

      const limit = 100;
      const pagination = {
        sortBy: "updatedAt",
        descending: true,
      };

      switch (this.filter) {
        case "ongoing":
          this.listener = this.$store.dispatch("online/LISTEN_PUBLIC_GAMES", {
            where: ["config.hasEnded", "!=", true],
            next,
            error,
          });
        case "open":
          this.listener = this.$store.dispatch("online/LISTEN_PUBLIC_GAMES", {
            where: ["config.isOpen", "==", true],
            next,
            error,
          });
        case "recent":
          this.listener = this.$store.dispatch("online/LISTEN_PUBLIC_GAMES", {
            limit,
            pagination,
            next,
            error,
          });
        case "analysis":
          break;
        case "puzzle":
          break;
      }
    },
  },
  mounted() {
    this.init();
  },
  beforeDestroy() {
    // Unlisten
    if (this.listener) {
      this.$store.dispatch("online/UNLISTEN", this.listener);
    }
  },
  watch: {
    "user.uid"() {
      // this.$store.dispatch("online/LISTEN_PLAYER_GAMES");
    },
    async filter() {
      this.init();
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

  .q-table__top {
    padding: 0;
  }
  .q-table__middle {
    height: 100%;
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
