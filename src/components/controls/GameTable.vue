<template>
  <q-table
    ref="table"
    class="game-table"
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
    :virtual-scroll="games.length > 50"
    :virtual-scroll-sticky-size-start="75"
    color="primary"
    no-route-fullscreen-exit
    :hide-bottom="!fullscreen"
    v-on="$listeners"
    v-bind="$attrs"
  >
    <template v-slot:top>
      <div class="column fit overflow-hidden relative-position">
        <q-toolbar>
          <!-- View Options -->
          <q-btn
            @click="fullscreen = !fullscreen"
            :icon="fullscreen ? 'list' : 'table'"
            stretch
            flat
          >
            <hint>{{ $t(fullscreen ? "List View" : "Table View") }}</hint>
          </q-btn>

          <q-space />

          <!-- Account -->
          <AccountBtn :login-text="$t('Guest')" stretch flat />

          <template v-if="fullscreen">
            <slot name="fullscreen-header" />
          </template>
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

        <q-linear-progress
          v-show="loading"
          class="table-progress"
          track-color="transparent"
          indeterminate
        />
      </div>
    </template>

    <template v-slot:header-cell="props">
      <q-th :props="props">
        <q-icon
          v-if="props.col.icon"
          :name="props.col.icon"
          :class="{
            'q-mr-xs': props.col.label,
            [props.col.iconClass]: true,
          }"
          size="xs"
        />
        <span>
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
      >
        <td><!-- Hidden checkbox --></td>
        <template v-if="fullscreen">
          <q-td v-for="col in props.cols" :key="col.name" :props="props">
            <template v-if="col.name === 'thumbnail'">
              <GameThumbnail v-bind="col.value" class="rounded-borders" />
            </template>

            <template v-else-if="col.name === 'role'">
              <q-icon v-if="col.value" :name="col.value.icon" size="md">
                <hint>{{ col.value.label }}</hint>
              </q-icon>
            </template>

            <template v-else-if="col.name === 'players'">
              <div v-if="col.value.player1">
                <q-icon
                  :name="col.value.isRandom ? 'random' : playerIcon(1)"
                  size="sm"
                  left
                >
                  <hint>{{
                    $t(col.value.isRandom ? "Random" : "Player1")
                  }}</hint>
                </q-icon>
                {{ col.value.player1 }}
              </div>
              <div v-if="col.value.player2">
                <q-icon
                  :name="col.value.isRandom ? 'random' : playerIcon(2)"
                  size="sm"
                  left
                >
                  <hint>{{
                    $t(col.value.isRandom ? "Random" : "Player2")
                  }}</hint>
                </q-icon>
                {{ col.value.player2 }}
              </div>
            </template>

            <template v-else-if="col.name === 'uiOptions'">
              <div class="row q-gutter-sm justify-center">
                <q-icon
                  v-for="o in col.value"
                  :key="o.key"
                  :name="o.icon"
                  size="sm"
                >
                  <hint>{{ $t(o.label) }}</hint>
                </q-icon>
              </div>
            </template>

            <template v-else-if="col.name === 'date'">
              <relative-time :value="col.value" />
            </template>

            <template v-else-if="col.name === 'result'">
              <Result :result="col.value" />
            </template>

            <template v-else>{{ col.value }}</template>
          </q-td>
        </template>
        <td v-else style="max-width: 100vw" :colspan="visibleColumns.length">
          <GameSelectorOption class="q-pa-none" :option="props.row" />
        </td>
      </q-tr>
    </template>

    <template v-slot:bottom v-if="fullscreen">
      <slot name="fullscreen-footer" />
    </template>
  </q-table>
</template>

<script>
import AccountBtn from "../general/AccountBtn.vue";
import GameSelectorOption from "./GameSelectorOption.vue";
import GameThumbnail from "./GameThumbnail.vue";
import ListSelect from "./ListSelect.vue";
import Result from "../PTN/Result";

import { uiOptions } from "../../dialogs/GameInfo";
import { compact, sortBy, without } from "lodash";

const MAX_SELECTED = Infinity;

export default {
  name: "GameTable",
  components: {
    AccountBtn,
    GameSelectorOption,
    GameThumbnail,
    ListSelect,
    Result,
  },
  props: ["value", "selection-mode"],
  data() {
    return {
      error: "",
      loading: false,
      listeners: [],
      pagination: {
        rowsPerPage: 0,
        sortBy: "date",
      },
      filterOptions: [
        {
          value: "recent",
          icon: "recent",
          label: this.$t("Recent"),
        },
        {
          value: "open",
          icon: "open_game",
          label: this.$t("Open"),
        },
        {
          value: "ongoing",
          icon: "ongoing",
          label: this.$t("Ongoing"),
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
      uiOptions,
      columns: [
        {
          name: "thumbnail",
          field: (game) => ({
            tps: game.state.tps,
            hl: game.state.ply,
            plyIsDone: game.state.plyIsDone,
            config: game.config,
          }),
          align: "left",
        },
        {
          name: "role",
          label: this.$t("Role"),
          icon: "account",
          field: (game) => {
            let isRandom = game.config.playerSeat === "random";
            return {
              label: isRandom ? "?" : this.roleText(game.config.player),
              icon: this.playerIcon(
                isRandom ? "random" : game.config.player,
                game.config.isPrivate
              ),
            };
          },
          align: "center",
        },
        {
          name: "name",
          label: this.$t("Name"),
          icon: "file",
          align: "left",
        },
        {
          name: "players",
          label: this.$t("Players"),
          icon: "players",
          field: (game) => ({
            player1: game.tags.player1,
            player2: game.tags.player2,
            isRandom:
              game.config.isOnline &&
              game.config.isOpen &&
              game.config.playerSeat === "random",
          }),
          align: "left",
        },
        {
          name: "size",
          label: this.$t("Size"),
          icon: "size",
          iconClass: "flip-vertical",
          field: (game) => game.tags.size,
          format: (size) => size + "x" + size,
          align: "center",
        },
        {
          name: "komi",
          label: this.$t("Komi"),
          icon: "komi",
          field: (game) => game.tags.komi,
          align: "center",
        },
        {
          name: "uiOptions",
          label: this.$t("UI Options"),
          icon: "ui",
          field: "uiOptions",
          align: "center",
        },
        {
          name: "date",
          label: this.$t("DateTime"),
          icon: "date_time",
          field: "createdAt",
          align: "center",
        },
        {
          name: "result",
          label: this.$t("Result"),
          icon: "result",
          field: (game) => game.tags.result,
          align: "center",
        },
      ],
    };
  },
  computed: {
    filter: {
      get() {
        return this.$route.params.filter || "recent";
      },
      set(filter) {
        this.$router.replace({
          params: {
            filter,
            fullscreen: this.fullscreen ? "fullscreen" : undefined,
          },
        });
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
            this.$router.replace({
              params: { filter: this.filter, fullscreen: "table" },
            });
          }
        } else {
          if (this.$route.params.fullscreen) {
            this.$router.replace({
              params: { filter: this.filter, fullscreen: undefined },
            });
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
      let games = sortBy(
        Object.values(this.$store.state.online.gamesPublic).map((game) => ({
          ...game,
          value: game.config.id,
          isActive: this.isActive(game),
          uiOptions: uiOptions.filter((o) => game.config[o.key]),
        })),
        "createdAt"
      );

      switch (this.filter) {
        case "open":
          games = games.filter(
            (game) => !game.config.hasEnded && game.config.isOpen
          );
          break;
        case "ongoing":
          games = games
            .filter((game) => !game.config.hasEnded && !game.config.isOpen)
            .reverse();
          break;
        case "recent":
          games = games
            .filter((game) => game.config.hasEnded && !game.config.isOpen)
            .reverse();
          break;
        case "analysis":
          games = games.filter((game) => game.isAnalysis).reverse();
          break;
        case "puzzle":
          games = games.filter((game) => game.isPuzzle).reverse();
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
      if (["recent", "open", "ongoing"].includes(this.filter)) {
        columns = without(columns, "name");
      }
      if (["open", "ongoing"].includes(this.filter)) {
        columns = without(columns, "result");
      }
      return columns;
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
  },
  async created() {
    this.loading = true;
    if (!this.$route.params.filter) {
      this.$router.replace({
        params: {
          filter: this.filter,
          fullscreen: this.fullscreen ? "fullscreen" : undefined,
        },
      });
    }

    const next = () => {
      this.loading = false;
    };
    const error = (error) => {
      this.$store.dispatch("ui/NOTIFY_ERROR", error);
    };

    const limit = 100;
    const pagination = {
      sortBy: "createdAt",
      descending: true,
    };

    this.listeners.push(
      // Recent
      await this.$store.dispatch("online/LISTEN_PUBLIC_GAMES", {
        where: [],
        limit,
        pagination,
        next,
        error,
      }),

      // Open
      await this.$store.dispatch("online/LISTEN_PUBLIC_GAMES", {
        where: ["config.isOpen", "==", true],
        next,
        error,
      }),

      // Ongoing
      await this.$store.dispatch("online/LISTEN_PUBLIC_GAMES", {
        where: ["config.hasEnded", "!=", true],
        next,
        error,
      })
    );
  },
  beforeDestroy() {
    // Unlisten
    this.listeners.forEach((listener) => {
      this.$store.dispatch("online/UNLISTEN", listener);
    });
  },
  watch: {
    "user.uid"() {
      // this.$store.dispatch("online/LISTEN_PLAYER_GAMES");
    },
  },
};
</script>

<style lang="scss">
$header: 64px;

.game-table {
  thead {
    display: none;
  }
  &.fullscreen thead {
    display: table-header-group;
  }

  thead tr:first-child > th:first-child,
  tbody tr > td:first-child {
    display: none;
  }

  tr.selected * {
    color: $primary;
    color: var(--q-color-primary);
  }

  .q-table__top {
    padding: 0;
  }
  &:not(.fullscreen) .q-table__top {
    box-shadow: $shadow-2;
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

  thead th:first-child {
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .q-linear-progress.table-progress {
    position: absolute;
    height: 2px;
    bottom: 0;
  }
}
</style>
